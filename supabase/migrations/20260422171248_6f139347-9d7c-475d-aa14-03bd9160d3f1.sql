-- Phase 2b: Unified line-pricing resolver.
-- Single source of truth for: supplier selection + unit price + delivery + margin + landed price.
-- Returns NULL fields when zone is missing/unresolved → frontend treats line as "not priceable".

CREATE OR REPLACE FUNCTION public.resolve_line_pricing(
  _material_id uuid,
  _zone_code text,
  _qty numeric DEFAULT 1,
  _supplier_account_id uuid DEFAULT NULL,
  _item_override_margin numeric DEFAULT NULL,
  _global_margin numeric DEFAULT 0
)
RETURNS TABLE (
  supplier_account_id uuid,
  supplier_material_id uuid,
  unit_price numeric,
  delivery_per_unit numeric,
  margin_pct numeric,
  landed_unit_price numeric,
  zone_resolved boolean,
  reason text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_supplier_account_id uuid;
  v_supplier_material_id uuid;
  v_unit_price numeric;
  v_delivery_per_unit numeric := 0;
  v_margin_pct numeric;
  v_moq numeric;
  v_delivery_total numeric;
BEGIN
  -- Gate 1: zone is mandatory. No zone → no pricing.
  IF _zone_code IS NULL OR _zone_code = '' THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::numeric, NULL::numeric,
                        NULL::numeric, NULL::numeric, false, 'zone_missing'::text;
    RETURN;
  END IF;

  -- Stage 1: supplier + unit price (selected role from supply_units).
  -- If caller pinned a supplier, prefer that supplier's row; otherwise let the
  -- 'selected' winner come through.
  IF _supplier_account_id IS NOT NULL THEN
    SELECT s.supplier_account_id, s.supplier_material_id, s.unit_price
      INTO v_supplier_account_id, v_supplier_material_id, v_unit_price
    FROM resolve_effective_supplier(_material_id, _zone_code, NULL) s
    WHERE s.supplier_account_id = _supplier_account_id
    LIMIT 1;
  END IF;

  IF v_supplier_account_id IS NULL THEN
    SELECT s.supplier_account_id, s.supplier_material_id, s.unit_price
      INTO v_supplier_account_id, v_supplier_material_id, v_unit_price
    FROM resolve_effective_supplier(_material_id, _zone_code, 'selected') s
    LIMIT 1;
  END IF;

  -- No supplier configured for this material+zone → not priceable.
  IF v_supplier_account_id IS NULL OR v_unit_price IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::numeric, NULL::numeric,
                        NULL::numeric, NULL::numeric, true, 'no_supplier_for_zone'::text;
    RETURN;
  END IF;

  -- Stage 2: delivery per unit. Embed by default.
  -- Lookup priority:
  --   (a) supplier rate where _zone_code is in zone_codes AND supplier_material_id is in supplier_material_ids (specific)
  --   (b) supplier rate where _zone_code is in zone_codes AND supplier_material_ids is empty (zone-wide)
  --   (c) supplier default rate (is_default = true)
  -- price_per_moq is total delivery for one MOQ; per-unit = price_per_moq / moq.

  SELECT sm.moq INTO v_moq FROM supplier_materials sm WHERE sm.id = v_supplier_material_id;
  v_moq := COALESCE(NULLIF(v_moq, 0), 1);

  SELECT dr.price_per_moq INTO v_delivery_total
  FROM delivery_rates dr
  WHERE dr.supplier_account_id = v_supplier_account_id
    AND _zone_code = ANY(dr.zone_codes)
    AND v_supplier_material_id = ANY(dr.supplier_material_ids)
  ORDER BY dr.updated_at DESC
  LIMIT 1;

  IF v_delivery_total IS NULL THEN
    SELECT dr.price_per_moq INTO v_delivery_total
    FROM delivery_rates dr
    WHERE dr.supplier_account_id = v_supplier_account_id
      AND _zone_code = ANY(dr.zone_codes)
      AND (dr.supplier_material_ids IS NULL OR array_length(dr.supplier_material_ids, 1) IS NULL)
    ORDER BY dr.updated_at DESC
    LIMIT 1;
  END IF;

  IF v_delivery_total IS NULL THEN
    SELECT dr.price_per_moq INTO v_delivery_total
    FROM delivery_rates dr
    WHERE dr.supplier_account_id = v_supplier_account_id
      AND dr.is_default = true
    ORDER BY dr.updated_at DESC
    LIMIT 1;
  END IF;

  v_delivery_per_unit := COALESCE(v_delivery_total, 0) / v_moq;

  -- Stage 3: margin (already centralized).
  v_margin_pct := resolve_margin_pct(_material_id, _item_override_margin, _global_margin);

  -- Stage 4: landed unit price (delivery embedded by default).
  RETURN QUERY SELECT
    v_supplier_account_id,
    v_supplier_material_id,
    v_unit_price,
    v_delivery_per_unit,
    v_margin_pct,
    (v_unit_price + v_delivery_per_unit) * (1 + COALESCE(v_margin_pct, 0) / 100),
    true,
    'ok'::text;
END;
$$;

COMMENT ON FUNCTION public.resolve_line_pricing(uuid, text, numeric, uuid, numeric, numeric) IS
'Single source of truth for quotation/order line pricing. Composes supplier selection (resolve_effective_supplier), delivery rates (delivery_rates), and margin (resolve_margin_pct). Returns NULL pricing with reason=''zone_missing'' when zone is not provided — frontend MUST block pricing in that case.';

GRANT EXECUTE ON FUNCTION public.resolve_line_pricing(uuid, text, numeric, uuid, numeric, numeric) TO authenticated, service_role;

-- Phase 2b: snapshot lock timestamp on quotations.
-- Drafts re-resolve live; once sent, snapshots become source of truth.
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS pricing_locked_at timestamptz;

COMMENT ON COLUMN public.quotations.pricing_locked_at IS
'Set when quotation transitions to status=sent. Before this, line pricing re-resolves live from resolve_line_pricing. After this, frozen unit_price/delivery_price/effective_margin_pct on quotation_items are authoritative.';