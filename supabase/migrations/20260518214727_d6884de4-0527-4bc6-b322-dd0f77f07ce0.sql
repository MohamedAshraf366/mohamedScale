
-- =========================================================
-- Phase 3 — Backend Commercial Engine
-- =========================================================

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
  v_global_margin numeric := 0;
  v_subtotal numeric := 0;
  v_delivery_total numeric := 0;
  v_total numeric := 0;
  v_line RECORD;
  v_warnings jsonb := '[]'::jsonb;

  -- per line working values
  v_material_code text;
  v_subcategory_id uuid;
  v_material_override numeric;
  v_sub_margin numeric;
  v_resolved jsonb;
  v_supplier_id uuid;
  v_role_used text;
  v_was_fallback boolean;
  v_scope_used text;
  v_supplier_material_id uuid;
  v_supplier_unit_price numeric;
  v_supplier_moq numeric;
  v_delivery_rate_id uuid;
  v_delivery_price_per_moq numeric;
  v_margin_pct numeric;
  v_margin_source text;
  v_qty numeric;
BEGIN
  -- 1. Load quotation
  SELECT q.id, q.project_id, q.supplier_role, q.metadata, q.pricing_locked_at
    INTO v_quotation
    FROM public.quotations q
   WHERE q.id = _quotation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quotation_not_found';
  END IF;

  -- Skip if locked (immutable post-send)
  IF v_quotation.pricing_locked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status','locked','quotation_id',_quotation_id);
  END IF;

  v_supplier_role := COALESCE(v_quotation.supplier_role, 'selected');
  v_global_margin := COALESCE((v_quotation.metadata->>'global_margin')::numeric, 0);

  -- 2. Resolve zone from project
  SELECT l.zone_code
    INTO v_zone_code
    FROM public.projects p
    LEFT JOIN public.locations l ON l.id = p.location_id
   WHERE p.id = v_quotation.project_id;

  -- 3. Stage: clear pricing on material lines, leave custom/addon untouched
  -- We'll build a temp table for material-line resolution
  CREATE TEMP TABLE IF NOT EXISTS _qcomp_lines (
    line_id uuid PRIMARY KEY,
    material_id uuid,
    quantity numeric,
    supplier_id uuid,
    supplier_material_id uuid,
    supplier_unit_price numeric,
    supplier_moq numeric,
    delivery_rate_id uuid,
    delivery_price_per_moq numeric,
    margin_pct numeric,
    margin_source text,
    role_used text,
    was_fallback boolean,
    scope_used text,
    item_override_margin numeric,
    warnings jsonb DEFAULT '[]'::jsonb
  ) ON COMMIT DROP;
  DELETE FROM _qcomp_lines;

  -- 4. Iterate material lines
  FOR v_line IN
    SELECT qi.id AS line_id, qi.material_id, qi.quantity, qi.effective_margin_pct
      FROM public.quotation_items qi
     WHERE qi.quotation_id = _quotation_id
       AND qi.removed_at IS NULL
       AND COALESCE(qi.item_kind,'material') = 'material'
       AND COALESCE(qi.is_custom_item, false) = false
       AND qi.material_id IS NOT NULL
     ORDER BY qi.position
  LOOP
    v_qty := COALESCE(v_line.quantity, 0);
    v_supplier_id := NULL;
    v_supplier_material_id := NULL;
    v_supplier_unit_price := NULL;
    v_supplier_moq := NULL;
    v_delivery_rate_id := NULL;
    v_delivery_price_per_moq := NULL;
    v_margin_pct := NULL;
    v_margin_source := NULL;
    v_role_used := NULL;
    v_was_fallback := false;
    v_scope_used := NULL;
    v_warnings := '[]'::jsonb;

    -- Material lookup
    SELECT code, subcategory_id
      INTO v_material_code, v_subcategory_id
      FROM public.materials WHERE id = v_line.material_id;

    IF v_material_code IS NULL THEN
      v_warnings := v_warnings || jsonb_build_array('material_not_found');
    ELSIF v_zone_code IS NULL OR v_zone_code = '' THEN
      v_warnings := v_warnings || jsonb_build_array('zone_missing');
    ELSE
      -- Resolve supplier (Selected or Quality both via resolve_supplier)
      v_resolved := to_jsonb(public.resolve_supplier(
        v_material_code, v_zone_code, v_supplier_role::supplier_selection_role
      ));
      v_supplier_id := NULLIF(v_resolved->>'supplier_id','')::uuid;
      v_role_used := v_resolved->>'role_used';
      v_was_fallback := COALESCE((v_resolved->>'was_fallback')::boolean, false);
      v_scope_used := v_resolved->>'scope_used';

      IF v_supplier_id IS NULL THEN
        v_warnings := v_warnings || jsonb_build_array('no_supplier_for_zone');
      ELSE
        -- Valid supplier quote (approved preferred)
        SELECT sm.id, sm.unit_price, sm.moq
          INTO v_supplier_material_id, v_supplier_unit_price, v_supplier_moq
          FROM public.supplier_materials sm
         WHERE sm.supplier_account_id = v_supplier_id
           AND sm.material_id = v_line.material_id
         ORDER BY (sm.status = 'approved') DESC NULLS LAST, sm.updated_at DESC
         LIMIT 1;

        IF v_supplier_material_id IS NULL OR v_supplier_unit_price IS NULL THEN
          v_warnings := v_warnings || jsonb_build_array('no_valid_supplier_quote');
        ELSE
          -- MOQ fallback chain: supplier_material.moq → subcategory.default_moq
          IF v_supplier_moq IS NULL OR v_supplier_moq <= 0 THEN
            SELECT default_moq INTO v_supplier_moq
              FROM public.material_subcategories WHERE id = v_subcategory_id;
          END IF;

          -- Delivery rate
          SELECT dr.id, dr.price_per_moq
            INTO v_delivery_rate_id, v_delivery_price_per_moq
            FROM public.delivery_rates dr
           WHERE dr.supplier_account_id = v_supplier_id
             AND v_zone_code = ANY(COALESCE(dr.zone_codes, ARRAY[]::text[]))
           ORDER BY dr.is_default DESC NULLS LAST, dr.updated_at DESC
           LIMIT 1;

          IF v_delivery_rate_id IS NULL THEN
            v_warnings := v_warnings || jsonb_build_array('no_delivery_rate');
          END IF;
        END IF;
      END IF;
    END IF;

    -- Margin hierarchy: line override → material override → subcategory → system default
    v_material_override := NULL;
    v_sub_margin := NULL;
    IF v_line.effective_margin_pct IS NOT NULL AND v_line.effective_margin_pct > 0 THEN
      v_margin_pct := v_line.effective_margin_pct;
      v_margin_source := 'line_override';
    ELSE
      -- material-level override (not yet a column; future extension). Skip for now.
      IF v_subcategory_id IS NOT NULL THEN
        SELECT default_margin_pct INTO v_sub_margin
          FROM public.subcategory_margin_defaults
         WHERE subcategory_id = v_subcategory_id;
      END IF;
      IF v_sub_margin IS NOT NULL AND v_sub_margin > 0 THEN
        v_margin_pct := v_sub_margin;
        v_margin_source := 'subcategory';
      ELSE
        v_margin_pct := v_global_margin;
        v_margin_source := 'system_default';
      END IF;
    END IF;

    INSERT INTO _qcomp_lines VALUES (
      v_line.line_id, v_line.material_id, v_qty,
      v_supplier_id, v_supplier_material_id, v_supplier_unit_price, v_supplier_moq,
      v_delivery_rate_id, v_delivery_price_per_moq,
      v_margin_pct, v_margin_source, v_role_used, v_was_fallback, v_scope_used,
      v_line.effective_margin_pct, v_warnings
    );
  END LOOP;

  -- 5. Delivery grouping: by (supplier_id, zone, delivery_rate_id)
  --    Compute per group: total_qty, trips=ceil(total_qty/moq), total_cost, per_unit
  WITH groups AS (
    SELECT
      supplier_id,
      delivery_rate_id,
      MAX(supplier_moq)  AS moq, -- moq tied to supplier_material; same supplier+rate assumed coherent
      MAX(delivery_price_per_moq) AS price_per_moq,
      SUM(quantity)      AS total_qty
    FROM _qcomp_lines
    WHERE supplier_id IS NOT NULL
      AND delivery_rate_id IS NOT NULL
      AND quantity > 0
    GROUP BY supplier_id, delivery_rate_id
  ),
  group_calc AS (
    SELECT
      supplier_id, delivery_rate_id, moq, price_per_moq, total_qty,
      CASE
        WHEN moq IS NULL OR moq <= 0 THEN 1
        ELSE ceil(total_qty / moq)
      END AS trips
    FROM groups
  ),
  group_final AS (
    SELECT
      supplier_id, delivery_rate_id, moq, price_per_moq, total_qty, trips,
      (trips * price_per_moq)                          AS total_delivery_cost,
      CASE WHEN total_qty > 0 THEN (trips * price_per_moq) / total_qty ELSE 0 END AS delivery_per_unit
    FROM group_calc
  )
  UPDATE _qcomp_lines l
  SET delivery_price_per_moq = l.delivery_price_per_moq -- noop; we'll read groups via select below
  FROM group_final g
  WHERE l.supplier_id = g.supplier_id AND l.delivery_rate_id = g.delivery_rate_id;

  -- 6. Apply per-line final pricing back to quotation_items
  FOR v_line IN
    SELECT
      l.*,
      g.trips,
      g.total_delivery_cost,
      g.delivery_per_unit,
      g.total_qty AS group_qty
    FROM _qcomp_lines l
    LEFT JOIN LATERAL (
      WITH groups AS (
        SELECT supplier_id, delivery_rate_id,
               MAX(supplier_moq) AS moq,
               MAX(delivery_price_per_moq) AS price_per_moq,
               SUM(quantity) AS total_qty
        FROM _qcomp_lines
        WHERE supplier_id IS NOT NULL AND delivery_rate_id IS NOT NULL AND quantity > 0
        GROUP BY supplier_id, delivery_rate_id
      )
      SELECT
        gr.total_qty,
        CASE WHEN gr.moq IS NULL OR gr.moq <= 0 THEN 1 ELSE ceil(gr.total_qty / gr.moq) END AS trips,
        (CASE WHEN gr.moq IS NULL OR gr.moq <= 0 THEN 1 ELSE ceil(gr.total_qty / gr.moq) END) * gr.price_per_moq AS total_delivery_cost,
        CASE WHEN gr.total_qty > 0
             THEN ((CASE WHEN gr.moq IS NULL OR gr.moq <= 0 THEN 1 ELSE ceil(gr.total_qty / gr.moq) END) * gr.price_per_moq) / gr.total_qty
             ELSE 0
        END AS delivery_per_unit
      FROM groups gr
      WHERE gr.supplier_id = l.supplier_id AND gr.delivery_rate_id = l.delivery_rate_id
    ) g ON true
  LOOP
    DECLARE
      v_dpu numeric := COALESCE(v_line.delivery_per_unit, 0);
      v_landed numeric;
      v_final_unit numeric;
      v_line_total numeric;
      v_trace jsonb;
    BEGIN
      IF v_line.supplier_unit_price IS NULL THEN
        -- Cannot price; clear & store trace with warnings
        v_trace := jsonb_build_object(
          'supplier_id', v_line.supplier_id,
          'supplier_role_requested', v_supplier_role,
          'supplier_role_used', v_line.role_used,
          'scope_used', v_line.scope_used,
          'was_fallback', v_line.was_fallback,
          'supplier_material_id', v_line.supplier_material_id,
          'supplier_quote_id', v_line.supplier_material_id,
          'raw_supplier_unit_price', v_line.supplier_unit_price,
          'delivery_rate_id', v_line.delivery_rate_id,
          'moq_used', v_line.supplier_moq,
          'grouped_quantity', v_line.group_qty,
          'trip_count', v_line.trips,
          'total_delivery_cost', v_line.total_delivery_cost,
          'delivery_per_unit', v_dpu,
          'landed_unit_cost', NULL,
          'margin_source', v_line.margin_source,
          'margin_pct', v_line.margin_pct,
          'final_unit_price', NULL,
          'final_line_total', NULL,
          'warnings', v_line.warnings,
          'computed_at', now()
        );

        UPDATE public.quotation_items
           SET supplier_account_id = v_line.supplier_id,
               supplier_material_id = v_line.supplier_material_id,
               unit_price = NULL,
               delivery_price = NULL,
               line_total = NULL,
               effective_margin_pct = v_line.margin_pct,
               pricing_trace = v_trace
         WHERE id = v_line.line_id;
      ELSE
        v_landed     := v_line.supplier_unit_price + v_dpu;
        v_final_unit := v_landed * (1 + COALESCE(v_line.margin_pct, 0) / 100);
        v_line_total := v_final_unit * COALESCE(v_line.quantity, 0);

        v_trace := jsonb_build_object(
          'supplier_id', v_line.supplier_id,
          'supplier_role_requested', v_supplier_role,
          'supplier_role_used', v_line.role_used,
          'scope_used', v_line.scope_used,
          'was_fallback', v_line.was_fallback,
          'supplier_material_id', v_line.supplier_material_id,
          'supplier_quote_id', v_line.supplier_material_id,
          'raw_supplier_unit_price', v_line.supplier_unit_price,
          'delivery_rate_id', v_line.delivery_rate_id,
          'moq_used', v_line.supplier_moq,
          'grouped_quantity', v_line.group_qty,
          'trip_count', v_line.trips,
          'total_delivery_cost', v_line.total_delivery_cost,
          'delivery_per_unit', v_dpu,
          'landed_unit_cost', v_landed,
          'margin_source', v_line.margin_source,
          'margin_pct', v_line.margin_pct,
          'final_unit_price', v_final_unit,
          'final_line_total', v_line_total,
          'warnings', v_line.warnings,
          'computed_at', now()
        );

        UPDATE public.quotation_items
           SET supplier_account_id = v_line.supplier_id,
               supplier_material_id = v_line.supplier_material_id,
               unit_price = v_final_unit,
               delivery_price = v_dpu,
               line_total = v_line_total,
               effective_margin_pct = v_line.margin_pct,
               pricing_trace = v_trace
         WHERE id = v_line.line_id;
      END IF;
    END;
  END LOOP;

  -- 7. Header totals: sum ALL active lines (material + custom + addon)
  SELECT
    COALESCE(SUM(line_total), 0),
    COALESCE(SUM(CASE WHEN COALESCE(item_kind,'material')='material' AND COALESCE(is_custom_item,false)=false
                      THEN COALESCE((pricing_trace->>'total_delivery_cost')::numeric, 0)
                      ELSE 0 END), 0)
    INTO v_subtotal, v_delivery_total
    FROM public.quotation_items
   WHERE quotation_id = _quotation_id
     AND removed_at IS NULL;

  -- Subtotal already includes embedded delivery (since unit_price = landed*margin)
  -- delivery_total here is informational (raw cost basis, deduped per group)
  -- To avoid double-count: only count each group once
  SELECT COALESCE(SUM(per_group), 0) INTO v_delivery_total
  FROM (
    SELECT DISTINCT ON (pricing_trace->>'supplier_id', pricing_trace->>'delivery_rate_id')
      COALESCE((pricing_trace->>'total_delivery_cost')::numeric, 0) AS per_group
    FROM public.quotation_items
    WHERE quotation_id = _quotation_id
      AND removed_at IS NULL
      AND COALESCE(item_kind,'material')='material'
      AND COALESCE(is_custom_item,false)=false
      AND pricing_trace ? 'supplier_id'
      AND pricing_trace ? 'delivery_rate_id'
    ORDER BY pricing_trace->>'supplier_id', pricing_trace->>'delivery_rate_id'
  ) s;

  v_total := v_subtotal;

  UPDATE public.quotations
     SET subtotal = v_subtotal,
         delivery_total = v_delivery_total,
         total = v_total
   WHERE id = _quotation_id;

  RETURN jsonb_build_object(
    'status','ok',
    'quotation_id', _quotation_id,
    'subtotal', v_subtotal,
    'delivery_total', v_delivery_total,
    'total', v_total,
    'zone_code', v_zone_code,
    'supplier_role', v_supplier_role,
    'global_margin', v_global_margin
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_quotation_totals(uuid) TO authenticated;
