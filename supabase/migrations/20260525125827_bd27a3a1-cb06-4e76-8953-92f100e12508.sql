-- Drop both legacy overloads so we can change the return shape.
DROP FUNCTION IF EXISTS public.resolve_line_pricing(uuid, text, numeric, uuid, numeric, numeric);
DROP FUNCTION IF EXISTS public.resolve_line_pricing(uuid, text, numeric, uuid, numeric, numeric, text);

-- 1) Rewrite resolve_line_pricing to use the Supplier Selection model.
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
  scope_used text,
  was_fallback boolean
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_material_code text;
  v_pick jsonb;
  v_pick_reason text;
  v_supplier_id uuid;
  v_supplier_material_id uuid;
  v_unit_price numeric;
  v_moq numeric;
  v_delivery_total numeric;
  v_delivery_per_unit numeric := 0;
  v_margin_pct numeric;
  v_role_used text := NULL;
  v_scope_used text := NULL;
  v_was_fallback boolean := false;
BEGIN
  IF _zone_code IS NULL OR _zone_code = '' THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::numeric, NULL::numeric,
                        NULL::numeric, NULL::numeric, false,
                        'zone_missing'::text, NULL::text, NULL::text, false;
    RETURN;
  END IF;

  SELECT code INTO v_material_code FROM materials WHERE id = _material_id LIMIT 1;
  IF v_material_code IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::numeric, NULL::numeric,
                        NULL::numeric, NULL::numeric, true,
                        'material_not_found'::text, NULL::text, NULL::text, false;
    RETURN;
  END IF;

  IF _supplier_account_id IS NOT NULL THEN
    v_supplier_id := _supplier_account_id;
    v_role_used := 'override';
    v_scope_used := 'override';
    v_was_fallback := false;
  ELSE
    v_pick := public.resolve_supplier(
      v_material_code,
      _zone_code,
      _requested_role::public.supplier_selection_role
    );
    v_pick_reason := v_pick->>'reason';

    IF v_pick_reason <> 'ok' THEN
      RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::numeric, NULL::numeric,
                          NULL::numeric, NULL::numeric, true,
                          v_pick_reason, NULL::text, NULL::text, false;
      RETURN;
    END IF;

    v_supplier_id  := (v_pick->>'supplier_id')::uuid;
    v_role_used    := v_pick->>'role_used';
    v_scope_used   := v_pick->>'scope_used';
    v_was_fallback := COALESCE((v_pick->>'was_fallback')::boolean, false);
  END IF;

  -- is_current preferred, fallback to latest by created_at. Status ignored.
  SELECT sm.id, sm.unit_price, sm.moq
    INTO v_supplier_material_id, v_unit_price, v_moq
  FROM supplier_materials sm
  WHERE sm.supplier_account_id = v_supplier_id
    AND sm.material_id = _material_id
    AND sm.unit_price IS NOT NULL
    AND COALESCE(sm.is_current, false) = true
  ORDER BY sm.updated_at DESC
  LIMIT 1;

  IF v_supplier_material_id IS NULL THEN
    SELECT sm.id, sm.unit_price, sm.moq
      INTO v_supplier_material_id, v_unit_price, v_moq
    FROM supplier_materials sm
    WHERE sm.supplier_account_id = v_supplier_id
      AND sm.material_id = _material_id
      AND sm.unit_price IS NOT NULL
    ORDER BY sm.created_at DESC
    LIMIT 1;
  END IF;

  IF v_supplier_material_id IS NULL OR v_unit_price IS NULL THEN
    RETURN QUERY SELECT v_supplier_id, NULL::uuid, NULL::numeric, NULL::numeric,
                        NULL::numeric, NULL::numeric, true,
                        'supplier_has_no_price'::text,
                        v_role_used, v_scope_used, v_was_fallback;
    RETURN;
  END IF;

  v_moq := COALESCE(NULLIF(v_moq, 0), 1);

  SELECT dr.price_per_moq INTO v_delivery_total
  FROM delivery_rates dr
  WHERE dr.supplier_account_id = v_supplier_id
    AND _zone_code = ANY(dr.zone_codes)
    AND v_supplier_material_id = ANY(dr.supplier_material_ids)
  ORDER BY dr.updated_at DESC
  LIMIT 1;

  IF v_delivery_total IS NULL THEN
    SELECT dr.price_per_moq INTO v_delivery_total
    FROM delivery_rates dr
    WHERE dr.supplier_account_id = v_supplier_id
      AND _zone_code = ANY(dr.zone_codes)
      AND (dr.supplier_material_ids IS NULL OR array_length(dr.supplier_material_ids, 1) IS NULL)
    ORDER BY dr.updated_at DESC
    LIMIT 1;
  END IF;

  IF v_delivery_total IS NULL THEN
    SELECT dr.price_per_moq INTO v_delivery_total
    FROM delivery_rates dr
    WHERE dr.supplier_account_id = v_supplier_id
      AND dr.is_default = true
    ORDER BY dr.updated_at DESC
    LIMIT 1;
  END IF;

  v_delivery_per_unit := COALESCE(v_delivery_total, 0) / v_moq;

  v_margin_pct := public.resolve_margin_pct(_material_id, _item_override_margin, _global_margin);

  RETURN QUERY SELECT
    v_supplier_id,
    v_supplier_material_id,
    v_unit_price,
    v_delivery_per_unit,
    v_margin_pct,
    (v_unit_price + v_delivery_per_unit) * (1 + COALESCE(v_margin_pct, 0) / 100),
    true,
    'ok'::text,
    v_role_used,
    v_scope_used,
    v_was_fallback;
END;
$function$;

-- 2) Backfill: exactly one is_current per (supplier, material).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY supplier_account_id, material_id
           ORDER BY COALESCE(is_current, false) DESC, created_at DESC
         ) AS rn
  FROM supplier_materials
)
UPDATE supplier_materials sm
SET is_current = (r.rn = 1)
FROM ranked r
WHERE sm.id = r.id
  AND COALESCE(sm.is_current, false) <> (r.rn = 1);

-- 3) Trigger to maintain that invariant going forward.
CREATE OR REPLACE FUNCTION public.maintain_supplier_material_is_current()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_supplier uuid;
  v_material uuid;
  v_keep uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_supplier := OLD.supplier_account_id;
    v_material := OLD.material_id;
  ELSE
    v_supplier := NEW.supplier_account_id;
    v_material := NEW.material_id;
  END IF;

  IF TG_OP IN ('INSERT','UPDATE')
     AND COALESCE(NEW.is_current, false) = true THEN
    UPDATE supplier_materials
       SET is_current = false
     WHERE supplier_account_id = v_supplier
       AND material_id = v_material
       AND id <> NEW.id
       AND COALESCE(is_current, false) = true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM supplier_materials
    WHERE supplier_account_id = v_supplier
      AND material_id = v_material
      AND COALESCE(is_current, false) = true
  ) THEN
    SELECT id INTO v_keep
    FROM supplier_materials
    WHERE supplier_account_id = v_supplier
      AND material_id = v_material
    ORDER BY created_at DESC
    LIMIT 1;
    IF v_keep IS NOT NULL THEN
      UPDATE supplier_materials SET is_current = true WHERE id = v_keep;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_maintain_supplier_material_is_current ON public.supplier_materials;
CREATE TRIGGER trg_maintain_supplier_material_is_current
AFTER INSERT OR UPDATE OF is_current OR DELETE ON public.supplier_materials
FOR EACH ROW
EXECUTE FUNCTION public.maintain_supplier_material_is_current();