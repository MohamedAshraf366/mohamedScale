
-- ============================================================
-- PHASE 1: DB FOUNDATIONS
-- ============================================================
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS supplier_role text NOT NULL DEFAULT 'selected'
    CHECK (supplier_role IN ('selected','quality'));

ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS pricing_trace jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_quotations_one_draft_per_opportunity
  ON public.quotations (opportunity_id, is_soft)
  WHERE status = 'draft' AND opportunity_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_quotations_one_draft_per_order
  ON public.quotations (order_id, is_soft)
  WHERE status = 'draft' AND order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_quotation_valid_until()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.valid_until IS NULL THEN
    NEW.valid_until := (COALESCE(NEW.created_at, now())::date + INTERVAL '7 days')::date;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'sent'
     AND OLD.status IS DISTINCT FROM 'sent'
     AND NEW.valid_until IS NULL THEN
    NEW.valid_until := (COALESCE(NEW.sent_at, now())::date + INTERVAL '7 days')::date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotations_set_valid_until ON public.quotations;
CREATE TRIGGER trg_quotations_set_valid_until
  BEFORE INSERT OR UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.set_quotation_valid_until();

UPDATE public.quotations
   SET valid_until = (created_at::date + INTERVAL '7 days')::date
 WHERE valid_until IS NULL;

CREATE OR REPLACE FUNCTION public.enforce_quotation_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.pricing_locked_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.subtotal IS DISTINCT FROM OLD.subtotal
     OR NEW.delivery_total IS DISTINCT FROM OLD.delivery_total
     OR NEW.total IS DISTINCT FROM OLD.total
     OR NEW.delivery_mode IS DISTINCT FROM OLD.delivery_mode
     OR NEW.supplier_role IS DISTINCT FROM OLD.supplier_role
     OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
     OR NEW.code IS DISTINCT FROM OLD.code
     OR NEW.is_soft IS DISTINCT FROM OLD.is_soft
     OR NEW.quote_type IS DISTINCT FROM OLD.quote_type
     OR NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id
     OR NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.customer_account_id IS DISTINCT FROM OLD.customer_account_id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.metadata IS DISTINCT FROM OLD.metadata
     OR NEW.est_delivery_date IS DISTINCT FROM OLD.est_delivery_date
     OR NEW.pricing_locked_at IS DISTINCT FROM OLD.pricing_locked_at
     OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
  THEN
    IF (auth.jwt() ->> 'role') = 'service_role' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Quotation % is locked (pricing_locked_at set). Commercial fields are immutable. Use Revise to create a new draft.', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotations_immutable ON public.quotations;
CREATE TRIGGER trg_quotations_immutable
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_quotation_immutability();

CREATE OR REPLACE FUNCTION public.enforce_quotation_items_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_qid uuid := COALESCE(NEW.quotation_id, OLD.quotation_id);
  v_locked timestamptz;
BEGIN
  SELECT pricing_locked_at INTO v_locked FROM public.quotations WHERE id = v_qid;
  IF v_locked IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'Quotation % is locked — items cannot be modified.', v_qid
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_quotation_items_immutable ON public.quotation_items;
CREATE TRIGGER trg_quotation_items_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON public.quotation_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_quotation_items_immutability();

UPDATE public.pdf_templates
   SET settings = jsonb_set(settings, '{footer_left}', '"Generated {{date}}"'::jsonb, true),
       updated_at = now()
 WHERE settings->>'footer_left' LIKE '%{{version}}%'
    OR settings->>'footer_left' LIKE '%Version%';

-- ============================================================
-- PHASE 2: RESOLVER UNIFICATION
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_line_pricing(
  _material_id uuid,
  _zone_code text,
  _qty numeric DEFAULT 1,
  _supplier_account_id uuid DEFAULT NULL,
  _item_override_margin numeric DEFAULT NULL,
  _global_margin numeric DEFAULT 0,
  _requested_role text DEFAULT 'selected'
)
RETURNS TABLE(
  supplier_account_id uuid,
  supplier_material_id uuid,
  unit_price numeric,
  delivery_per_unit numeric,
  margin_pct numeric,
  landed_unit_price numeric,
  zone_resolved boolean,
  reason text,
  role_used text,
  was_fallback boolean
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_material_code text;
  v_resolved jsonb;
  v_supplier_id uuid;
  v_role_used text;
  v_was_fallback boolean := false;
  v_supplier_material_id uuid;
  v_unit_price numeric;
  v_delivery_per_unit numeric := 0;
  v_margin numeric;
  v_subcategory_id uuid;
  v_sub_margin numeric;
  v_rate_price numeric;
  v_rate_moq numeric;
BEGIN
  IF _zone_code IS NULL OR _zone_code = '' THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric,
                        false, 'zone_missing'::text, NULL::text, false;
    RETURN;
  END IF;

  SELECT code, subcategory_id INTO v_material_code, v_subcategory_id
  FROM public.materials WHERE id = _material_id;

  IF v_material_code IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric,
                        true, 'material_not_found'::text, NULL::text, false;
    RETURN;
  END IF;

  v_resolved := to_jsonb(public.resolve_supplier(v_material_code, _zone_code, COALESCE(_requested_role, 'selected')));
  v_supplier_id := NULLIF(v_resolved->>'supplier_id','')::uuid;
  v_role_used := v_resolved->>'role_used';
  v_was_fallback := COALESCE((v_resolved->>'was_fallback')::boolean, false);

  IF v_supplier_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric,
                        true, 'no_supplier_for_zone'::text, NULL::text, false;
    RETURN;
  END IF;

  SELECT sm.id, sm.unit_price
    INTO v_supplier_material_id, v_unit_price
    FROM public.supplier_materials sm
   WHERE sm.supplier_account_id = v_supplier_id
     AND sm.material_id = _material_id
   ORDER BY (sm.status = 'approved') DESC NULLS LAST, sm.updated_at DESC
   LIMIT 1;

  IF v_supplier_material_id IS NULL OR v_unit_price IS NULL THEN
    RETURN QUERY SELECT v_supplier_id, NULL::uuid, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric,
                        true, 'no_valid_supplier_quote'::text, v_role_used, v_was_fallback;
    RETURN;
  END IF;

  SELECT dr.price_per_moq, dr.moq
    INTO v_rate_price, v_rate_moq
    FROM public.delivery_rates dr
   WHERE dr.supplier_account_id = v_supplier_id
     AND _zone_code = ANY(COALESCE(dr.zone_codes, ARRAY[]::text[]))
   ORDER BY dr.updated_at DESC
   LIMIT 1;

  IF v_rate_price IS NULL THEN
    RETURN QUERY SELECT v_supplier_id, v_supplier_material_id, v_unit_price, NULL::numeric, NULL::numeric, NULL::numeric,
                        true, 'no_delivery_rate'::text, v_role_used, v_was_fallback;
    RETURN;
  END IF;

  IF v_rate_moq IS NOT NULL AND v_rate_moq > 0 AND _qty IS NOT NULL AND _qty > 0 THEN
    v_delivery_per_unit := (ceil(_qty::numeric / v_rate_moq) * v_rate_price) / _qty;
  ELSE
    v_delivery_per_unit := 0;
  END IF;

  IF _item_override_margin IS NOT NULL AND _item_override_margin > 0 THEN
    v_margin := _item_override_margin;
  ELSE
    SELECT default_margin_pct INTO v_sub_margin
      FROM public.subcategory_margin_defaults
     WHERE subcategory_id = v_subcategory_id;
    v_margin := COALESCE(NULLIF(v_sub_margin, 0), _global_margin);
  END IF;

  RETURN QUERY SELECT
    v_supplier_id,
    v_supplier_material_id,
    v_unit_price,
    v_delivery_per_unit,
    v_margin,
    (v_unit_price + v_delivery_per_unit) * (1 + COALESCE(v_margin,0) / 100),
    true,
    'ok'::text,
    v_role_used,
    v_was_fallback;
END;
$$;

-- ============================================================
-- PHASE 5: REVISE RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.revise_quotation(_quotation_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src public.quotations%ROWTYPE;
  v_new_id uuid;
  v_existing_draft uuid;
BEGIN
  SELECT * INTO v_src FROM public.quotations WHERE id = _quotation_id;
  IF v_src.id IS NULL THEN
    RAISE EXCEPTION 'Quotation % not found', _quotation_id;
  END IF;

  IF v_src.opportunity_id IS NOT NULL THEN
    SELECT id INTO v_existing_draft FROM public.quotations
     WHERE opportunity_id = v_src.opportunity_id
       AND is_soft = v_src.is_soft
       AND status = 'draft'
     LIMIT 1;
  ELSIF v_src.order_id IS NOT NULL THEN
    SELECT id INTO v_existing_draft FROM public.quotations
     WHERE order_id = v_src.order_id
       AND is_soft = v_src.is_soft
       AND status = 'draft'
     LIMIT 1;
  END IF;
  IF v_existing_draft IS NOT NULL THEN
    RETURN v_existing_draft;
  END IF;

  INSERT INTO public.quotations(
    customer_account_id, project_id, opportunity_id, order_id,
    quote_type, is_soft, supplier_role, delivery_mode, currency,
    status, version, est_delivery_date, notes, metadata
  ) VALUES (
    v_src.customer_account_id, v_src.project_id, v_src.opportunity_id, v_src.order_id,
    v_src.quote_type, v_src.is_soft, v_src.supplier_role, v_src.delivery_mode, v_src.currency,
    'draft', COALESCE(v_src.version,1) + 1, v_src.est_delivery_date, v_src.notes,
    COALESCE(v_src.metadata, '{}'::jsonb)
  ) RETURNING id INTO v_new_id;

  INSERT INTO public.quotation_items(
    quotation_id, material_id, supplier_material_id, supplier_account_id,
    quantity, uom, moq, unit_price, delivery_price, line_total,
    effective_margin_pct, position, status, is_custom_item, custom_name,
    custom_description, item_kind, parent_line_id, addon_definition_id, notes, metadata
  )
  SELECT
    v_new_id, material_id, supplier_material_id, supplier_account_id,
    quantity, uom, moq, unit_price, delivery_price, line_total,
    effective_margin_pct, position, 'active', is_custom_item, custom_name,
    custom_description, item_kind, parent_line_id, addon_definition_id, notes,
    COALESCE(metadata, '{}'::jsonb)
  FROM public.quotation_items
  WHERE quotation_id = _quotation_id
    AND status = 'active'
    AND removed_at IS NULL
  ORDER BY position;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revise_quotation(uuid) TO authenticated;

-- ============================================================
-- SECURITY HARDENING
-- ============================================================
DROP POLICY IF EXISTS "System can manage agent sessions" ON public.agent_sessions;
CREATE POLICY "Service role manages agent sessions"
  ON public.agent_sessions AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "System can manage webhook events" ON public.whatsapp_webhook_events;
CREATE POLICY "Service role manages webhook events"
  ON public.whatsapp_webhook_events AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can insert contacts" ON public.contacts;
CREATE POLICY "Owners or admins can insert contacts"
  ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.customers c
       WHERE c.account_id = contacts.account_id
         AND (c.assigned_to = auth.uid() OR c.created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authenticated users can update contacts" ON public.contacts;
CREATE POLICY "Owners or admins can update contacts"
  ON public.contacts FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.customers c
       WHERE c.account_id = contacts.account_id
         AND (c.assigned_to = auth.uid() OR c.created_by = auth.uid())
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.customers c
       WHERE c.account_id = contacts.account_id
         AND (c.assigned_to = auth.uid() OR c.created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON public.suppliers;
CREATE POLICY "Admin and management can view suppliers"
  ON public.suppliers FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
  );

DROP POLICY IF EXISTS "Authenticated users can insert waba_accounts" ON public.waba_accounts;
CREATE POLICY "Admins and management can insert waba_accounts"
  ON public.waba_accounts FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
  );
