
-- 1) Set system default margin = 6
UPDATE public.pricing_settings SET default_margin_pct = 6, updated_at = now() WHERE id = true;
INSERT INTO public.pricing_settings (id, default_margin_pct)
  VALUES (true, 6)
  ON CONFLICT (id) DO UPDATE SET default_margin_pct = 6, updated_at = now();

-- 2) Redefine compute_quotation_totals: drop line_override from hierarchy
CREATE OR REPLACE FUNCTION public.compute_quotation_totals(_quotation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quotation RECORD;
  v_zone_code text;
  v_supplier_role text;
  v_system_default_margin numeric;
  v_has_system_default boolean;
  v_subtotal numeric := 0;
  v_delivery_total numeric := 0;
  v_total numeric := 0;
  v_line RECORD;

  v_material_code text;
  v_subcategory_id uuid;
  v_sub_margin numeric;
  v_resolved jsonb;
  v_supplier_id uuid;
  v_role_used text;
  v_was_fallback boolean;
  v_scope_used text;
  v_supplier_material_id uuid;
  v_supplier_unit_price numeric;
  v_supplier_moq numeric;
  v_supplier_quote_id uuid;
  v_price_valid_until date;
  v_supplier_status text;
  v_delivery_rate_id uuid;
  v_delivery_price_per_moq numeric;
  v_margin_pct numeric;
  v_margin_source text;
  v_warnings jsonb;
  v_stage jsonb;
  v_quote_strict_hit boolean;
BEGIN
  SELECT q.id, q.project_id, q.supplier_role, q.metadata, q.pricing_locked_at
    INTO v_quotation FROM public.quotations q WHERE q.id = _quotation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'quotation_not_found'; END IF;
  IF v_quotation.pricing_locked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status','locked','quotation_id',_quotation_id);
  END IF;

  v_supplier_role := COALESCE(v_quotation.supplier_role, 'selected');

  SELECT default_margin_pct INTO v_system_default_margin
    FROM public.pricing_settings WHERE id = true;
  v_has_system_default := (v_system_default_margin IS NOT NULL);

  SELECT l.zone_code INTO v_zone_code
    FROM public.projects p LEFT JOIN public.locations l ON l.id = p.location_id
   WHERE p.id = v_quotation.project_id;

  FOR v_line IN
    SELECT qi.id AS line_id, qi.material_id, qi.quantity
      FROM public.quotation_items qi
     WHERE qi.quotation_id = _quotation_id AND qi.removed_at IS NULL
       AND COALESCE(qi.item_kind,'material') = 'material'
       AND COALESCE(qi.is_custom_item, false) = false
       AND qi.material_id IS NOT NULL
     ORDER BY qi.position
  LOOP
    v_supplier_id := NULL; v_supplier_material_id := NULL;
    v_supplier_unit_price := NULL; v_supplier_moq := NULL;
    v_supplier_quote_id := NULL; v_price_valid_until := NULL; v_supplier_status := NULL;
    v_delivery_rate_id := NULL; v_delivery_price_per_moq := NULL;
    v_margin_pct := NULL; v_margin_source := NULL;
    v_role_used := NULL; v_was_fallback := false; v_scope_used := NULL;
    v_warnings := '[]'::jsonb; v_material_code := NULL; v_subcategory_id := NULL;
    v_quote_strict_hit := false;

    SELECT code, subcategory_id INTO v_material_code, v_subcategory_id
      FROM public.materials WHERE id = v_line.material_id;

    IF v_material_code IS NULL THEN
      v_warnings := v_warnings || jsonb_build_array('material_not_found');
    ELSIF v_zone_code IS NULL OR v_zone_code = '' THEN
      v_warnings := v_warnings || jsonb_build_array('zone_missing');
    ELSE
      v_resolved := to_jsonb(public.resolve_supplier(
        v_material_code, v_zone_code, v_supplier_role::supplier_selection_role
      ));
      v_supplier_id  := NULLIF(v_resolved->>'supplier_id','')::uuid;
      v_role_used    := v_resolved->>'role_used';
      v_was_fallback := COALESCE((v_resolved->>'was_fallback')::boolean, false);
      v_scope_used   := v_resolved->>'scope_used';

      IF v_supplier_id IS NULL THEN
        v_warnings := v_warnings || jsonb_build_array('no_supplier_for_zone');
      ELSE
        SELECT sm.id, sm.unit_price, sm.moq, sm.supplier_quote_id, sm.price_valid_until, sm.status
          INTO v_supplier_material_id, v_supplier_unit_price, v_supplier_moq,
               v_supplier_quote_id, v_price_valid_until, v_supplier_status
          FROM public.supplier_materials sm
         WHERE sm.supplier_account_id = v_supplier_id
           AND sm.material_id = v_line.material_id
           AND sm.status = 'approved'
           AND COALESCE(sm.is_current, false) = true
           AND (sm.price_valid_until IS NULL OR sm.price_valid_until >= CURRENT_DATE)
         ORDER BY sm.updated_at DESC LIMIT 1;

        IF v_supplier_material_id IS NOT NULL THEN
          v_quote_strict_hit := true;
        ELSE
          SELECT sm.id, sm.unit_price, sm.moq, sm.supplier_quote_id, sm.price_valid_until, sm.status
            INTO v_supplier_material_id, v_supplier_unit_price, v_supplier_moq,
                 v_supplier_quote_id, v_price_valid_until, v_supplier_status
            FROM public.supplier_materials sm
           WHERE sm.supplier_account_id = v_supplier_id
             AND sm.material_id = v_line.material_id
             AND sm.status = 'approved'
           ORDER BY sm.updated_at DESC LIMIT 1;
          IF v_supplier_material_id IS NOT NULL THEN
            v_warnings := v_warnings || jsonb_build_array('supplier_quote_not_strictly_live');
            IF v_price_valid_until IS NOT NULL AND v_price_valid_until < CURRENT_DATE THEN
              v_warnings := v_warnings || jsonb_build_array('supplier_quote_expired');
            END IF;
          END IF;
        END IF;

        IF v_supplier_material_id IS NULL OR v_supplier_unit_price IS NULL THEN
          v_warnings := v_warnings || jsonb_build_array('no_valid_supplier_quote');
        ELSE
          IF v_supplier_moq IS NULL OR v_supplier_moq <= 0 THEN
            SELECT default_moq INTO v_supplier_moq
              FROM public.material_subcategories WHERE id = v_subcategory_id;
          END IF;

          SELECT dr.id, dr.price_per_moq
            INTO v_delivery_rate_id, v_delivery_price_per_moq
            FROM public.delivery_rates dr
           WHERE dr.supplier_account_id = v_supplier_id
             AND v_zone_code = ANY(COALESCE(dr.zone_codes, ARRAY[]::text[]))
           ORDER BY dr.is_default DESC NULLS LAST, dr.updated_at DESC LIMIT 1;

          IF v_delivery_rate_id IS NULL THEN
            v_warnings := v_warnings || jsonb_build_array('no_delivery_rate');
          END IF;
        END IF;
      END IF;
    END IF;

    -- Margin hierarchy (Phase 3 corrected): subcategory -> system_default
    -- Per-line override removed. Material-level override is future scope.
    v_sub_margin := NULL;
    IF v_subcategory_id IS NOT NULL THEN
      SELECT default_margin_pct INTO v_sub_margin
        FROM public.subcategory_margin_defaults WHERE subcategory_id = v_subcategory_id;
    END IF;
    IF v_sub_margin IS NOT NULL AND v_sub_margin > 0 THEN
      v_margin_pct := v_sub_margin;
      v_margin_source := 'subcategory';
    ELSIF v_has_system_default THEN
      v_margin_pct := v_system_default_margin;
      v_margin_source := 'system_default';
    ELSE
      v_margin_pct := 0;
      v_margin_source := 'none';
      v_warnings := v_warnings || jsonb_build_array('no_system_default_margin');
    END IF;

    v_stage := jsonb_build_object(
      'stage','pass1',
      'zone_code', v_zone_code,
      'supplier_id', v_supplier_id,
      'supplier_role_requested', v_supplier_role,
      'supplier_role_used', v_role_used,
      'scope_used', v_scope_used,
      'was_fallback', v_was_fallback,
      'supplier_material_id', v_supplier_material_id,
      'supplier_quote_id', v_supplier_quote_id,
      'supplier_quote_status', v_supplier_status,
      'supplier_quote_price_valid_until', v_price_valid_until,
      'supplier_quote_strict_live', v_quote_strict_hit,
      'raw_supplier_unit_price', v_supplier_unit_price,
      'delivery_rate_id', v_delivery_rate_id,
      'delivery_price_per_moq', v_delivery_price_per_moq,
      'moq_used', v_supplier_moq,
      'margin_pct', v_margin_pct,
      'margin_source', v_margin_source,
      'warnings', v_warnings
    );

    UPDATE public.quotation_items
       SET supplier_account_id = v_supplier_id,
           supplier_material_id = v_supplier_material_id,
           effective_margin_pct = v_margin_pct,
           unit_price = NULL, delivery_price = NULL, line_total = NULL,
           pricing_trace = v_stage
     WHERE id = v_line.line_id;
  END LOOP;

  FOR v_line IN
    WITH lines AS (
      SELECT qi.id AS line_id, qi.quantity,
             (qi.pricing_trace->>'supplier_id')::uuid              AS supplier_id,
             (qi.pricing_trace->>'delivery_rate_id')::uuid         AS delivery_rate_id,
             (qi.pricing_trace->>'raw_supplier_unit_price')::numeric AS raw_unit,
             (qi.pricing_trace->>'moq_used')::numeric              AS moq,
             (qi.pricing_trace->>'delivery_price_per_moq')::numeric AS rate_price,
             (qi.pricing_trace->>'margin_pct')::numeric            AS margin_pct,
             qi.pricing_trace                                      AS trace_in
        FROM public.quotation_items qi
       WHERE qi.quotation_id = _quotation_id AND qi.removed_at IS NULL
         AND COALESCE(qi.item_kind,'material') = 'material'
         AND COALESCE(qi.is_custom_item, false) = false
         AND qi.material_id IS NOT NULL
    ),
    groups AS (
      SELECT supplier_id, delivery_rate_id,
             MAX(moq) AS moq, MAX(rate_price) AS rate_price,
             SUM(COALESCE(quantity,0)) AS group_qty
        FROM lines
       WHERE supplier_id IS NOT NULL AND delivery_rate_id IS NOT NULL
       GROUP BY supplier_id, delivery_rate_id
    ),
    group_calc AS (
      SELECT supplier_id, delivery_rate_id, moq, rate_price, group_qty,
             CASE WHEN moq IS NULL OR moq <= 0 THEN 1 ELSE ceil(group_qty / moq) END AS trips
        FROM groups WHERE group_qty > 0
    )
    SELECT l.line_id, l.quantity, l.raw_unit, l.margin_pct, l.trace_in,
           g.group_qty, g.trips,
           (g.trips * g.rate_price) AS total_delivery_cost,
           CASE WHEN g.group_qty > 0 THEN (g.trips * g.rate_price) / g.group_qty ELSE 0 END AS delivery_per_unit
      FROM lines l
      LEFT JOIN group_calc g
             ON g.supplier_id = l.supplier_id AND g.delivery_rate_id = l.delivery_rate_id
  LOOP
    DECLARE
      v_dpu numeric := COALESCE(v_line.delivery_per_unit, 0);
      v_landed numeric; v_final_unit numeric; v_line_total numeric; v_trace jsonb;
    BEGIN
      v_trace := (v_line.trace_in - 'stage') || jsonb_build_object(
        'grouped_quantity', v_line.group_qty,
        'trip_count', v_line.trips,
        'total_delivery_cost', v_line.total_delivery_cost,
        'delivery_per_unit', v_dpu,
        'computed_at', now()
      );
      IF v_line.raw_unit IS NULL THEN
        v_trace := v_trace || jsonb_build_object('landed_unit_cost', NULL, 'final_unit_price', NULL, 'final_line_total', NULL);
        UPDATE public.quotation_items
           SET unit_price=NULL, delivery_price=NULL, line_total=NULL, pricing_trace=v_trace
         WHERE id = v_line.line_id;
      ELSE
        v_landed     := v_line.raw_unit + v_dpu;
        v_final_unit := v_landed * (1 + COALESCE(v_line.margin_pct,0)/100);
        v_line_total := v_final_unit * COALESCE(v_line.quantity,0);
        v_trace := v_trace || jsonb_build_object('landed_unit_cost', v_landed,'final_unit_price', v_final_unit,'final_line_total', v_line_total);
        UPDATE public.quotation_items
           SET unit_price=v_final_unit, delivery_price=v_dpu, line_total=v_line_total, pricing_trace=v_trace
         WHERE id = v_line.line_id;
      END IF;
    END;
  END LOOP;

  SELECT COALESCE(SUM(line_total),0) INTO v_subtotal
    FROM public.quotation_items WHERE quotation_id=_quotation_id AND removed_at IS NULL;

  SELECT COALESCE(SUM(per_group),0) INTO v_delivery_total FROM (
    SELECT DISTINCT ON (pricing_trace->>'supplier_id', pricing_trace->>'delivery_rate_id')
      COALESCE((pricing_trace->>'total_delivery_cost')::numeric,0) AS per_group
    FROM public.quotation_items
    WHERE quotation_id=_quotation_id AND removed_at IS NULL
      AND COALESCE(item_kind,'material')='material' AND COALESCE(is_custom_item,false)=false
      AND (pricing_trace->>'supplier_id') IS NOT NULL
      AND (pricing_trace->>'delivery_rate_id') IS NOT NULL
    ORDER BY pricing_trace->>'supplier_id', pricing_trace->>'delivery_rate_id'
  ) s;

  v_total := v_subtotal;
  UPDATE public.quotations SET subtotal=v_subtotal, delivery_total=v_delivery_total, total=v_total
   WHERE id=_quotation_id;

  RETURN jsonb_build_object(
    'status','ok','quotation_id',_quotation_id,
    'subtotal',v_subtotal,'delivery_total',v_delivery_total,'total',v_total,
    'zone_code',v_zone_code,'supplier_role',v_supplier_role,
    'system_default_margin', v_system_default_margin,
    'system_default_present', v_has_system_default
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_quotation_totals(uuid) TO authenticated;
