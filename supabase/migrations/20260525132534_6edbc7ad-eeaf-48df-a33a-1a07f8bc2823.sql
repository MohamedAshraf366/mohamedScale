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
  v_subcategory_id uuid;
  v_category_id uuid;
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
  v_qty numeric;
  v_trips numeric;
BEGIN
  IF _zone_code IS NULL OR _zone_code = '' THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::numeric, NULL::numeric,
                        NULL::numeric, NULL::numeric, false,
                        'zone_missing'::text, NULL::text, NULL::text, false;
    RETURN;
  END IF;

  SELECT m.code, m.subcategory_id, sc.category_id
    INTO v_material_code, v_subcategory_id, v_category_id
    FROM materials m
    LEFT JOIN material_subcategories sc ON sc.id = m.subcategory_id
   WHERE m.id = _material_id
   LIMIT 1;

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

  -- Inherit MOQ: supplier_material -> material -> subcategory -> category -> 1
  IF v_moq IS NULL OR v_moq <= 0 THEN
    SELECT default_moq INTO v_moq FROM materials WHERE id = _material_id;
  END IF;
  IF (v_moq IS NULL OR v_moq <= 0) AND v_subcategory_id IS NOT NULL THEN
    SELECT default_moq INTO v_moq FROM material_subcategories WHERE id = v_subcategory_id;
  END IF;
  IF (v_moq IS NULL OR v_moq <= 0) AND v_category_id IS NOT NULL THEN
    SELECT default_moq INTO v_moq FROM material_categories WHERE id = v_category_id;
  END IF;
  v_moq := COALESCE(NULLIF(v_moq, 0), 1);

  -- Delivery rate lookup: specific-to-material -> zone-default -> supplier default
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

  -- Use line quantity to compute trips. Spread total delivery cost over actual qty.
  v_qty := COALESCE(NULLIF(_qty, 0), v_moq);
  IF v_qty <= 0 THEN v_qty := v_moq; END IF;
  v_trips := CEIL(v_qty / v_moq);
  IF v_trips < 1 THEN v_trips := 1; END IF;
  v_delivery_per_unit := (COALESCE(v_delivery_total, 0) * v_trips) / v_qty;

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