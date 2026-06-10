
-- =========================================================
-- Update freeze trigger to also stamp valid_until = +7 days
-- =========================================================
CREATE OR REPLACE FUNCTION public.freeze_quotation_on_send()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('sent', 'accepted', 'converted')
  THEN
    IF NEW.pricing_locked_at IS NULL THEN
      NEW.pricing_locked_at := now();
    END IF;
    IF NEW.status = 'sent' AND NEW.sent_at IS NULL THEN
      NEW.sent_at := now();
    END IF;
    -- Phase 6: 7-day default validity stamped on send
    IF NEW.status = 'sent' AND NEW.valid_until IS NULL THEN
      NEW.valid_until := (now() + INTERVAL '7 days')::date;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- =========================================================
-- validate_quotation(_quotation_id)
-- =========================================================
CREATE OR REPLACE FUNCTION public.validate_quotation(_quotation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q RECORD;
  v_zone_code text;
  v_customer_ok boolean;
  v_blockers jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_line RECORD;
  v_material_line_count int := 0;
  v_total_lines int := 0;
  v_has_null_line_total boolean := false;
  v_strict_live_count int := 0;
  v_fallback_supplier_count int := 0;
  v_multi_trip_count int := 0;
  v_no_margin_default boolean := false;
BEGIN
  -- Quotation existence + lifecycle
  SELECT q.id, q.project_id, q.customer_account_id, q.status, q.subtotal,
         q.total, q.delivery_total, q.pricing_locked_at, q.sent_at, q.valid_until
    INTO v_q
    FROM public.quotations q
   WHERE q.id = _quotation_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'can_send', false,
      'blockers', jsonb_build_array(jsonb_build_object(
        'code','quotation_not_found','message','Quotation does not exist.'
      )),
      'warnings', '[]'::jsonb
    );
  END IF;

  IF v_q.pricing_locked_at IS NOT NULL OR v_q.status IN ('sent','accepted','converted','rejected') THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code','already_finalized',
      'message','Quotation is already sent or pricing-locked. Create a new revision to send again.',
      'suggested_action','Create a new revision of this quotation.'
    ));
  END IF;

  -- Customer + project
  IF v_q.customer_account_id IS NULL THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code','missing_customer','message','Quotation has no customer assigned.'
    ));
  END IF;
  IF v_q.project_id IS NULL THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code','missing_project','message','Quotation has no project assigned.'
    ));
  ELSE
    SELECT l.zone_code INTO v_zone_code
      FROM public.projects p
      LEFT JOIN public.locations l ON l.id = p.location_id
     WHERE p.id = v_q.project_id;
    IF v_zone_code IS NULL OR v_zone_code = '' THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code','no_project_zone',
        'message','Project has no delivery zone. Set a location with a detected zone.',
        'suggested_action','Open the project and assign a location.'
      ));
    END IF;
  END IF;

  -- Per-line validation
  FOR v_line IN
    SELECT qi.id, qi.material_id, qi.quantity, qi.unit_price, qi.line_total,
           qi.supplier_account_id, qi.supplier_material_id, qi.is_custom_item,
           qi.item_kind, qi.pricing_trace, qi.custom_name,
           COALESCE(m.name, qi.custom_name, 'Item') AS display_name
      FROM public.quotation_items qi
      LEFT JOIN public.materials m ON m.id = qi.material_id
     WHERE qi.quotation_id = _quotation_id
       AND qi.removed_at IS NULL
     ORDER BY qi.position
  LOOP
    v_total_lines := v_total_lines + 1;

    -- Quantity must be present and > 0 for any active line
    IF v_line.quantity IS NULL OR v_line.quantity <= 0 THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code','invalid_quantity',
        'message', format('Line "%s" has no quantity.', v_line.display_name),
        'item_id', v_line.id,
        'suggested_action','Enter a quantity greater than 0.'
      ));
    END IF;

    IF COALESCE(v_line.item_kind,'material') = 'material' AND v_line.is_custom_item = false THEN
      v_material_line_count := v_material_line_count + 1;

      IF v_line.supplier_account_id IS NULL THEN
        v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
          'code','unresolved_supplier',
          'message', format('No supplier could be resolved for "%s".', v_line.display_name),
          'item_id', v_line.id,
          'suggested_action','Ensure an approved supplier exists for this material in the project zone.'
        ));
      ELSIF v_line.supplier_material_id IS NULL THEN
        v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
          'code','no_valid_supplier_quote',
          'message', format('No valid supplier quote for "%s".', v_line.display_name),
          'item_id', v_line.id,
          'suggested_action','Add or re-approve a live supplier quote.'
        ));
      END IF;

      IF (v_line.pricing_trace->>'delivery_rate_id') IS NULL THEN
        v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
          'code','no_delivery_rate',
          'message', format('No delivery rate for "%s" in this zone.', v_line.display_name),
          'item_id', v_line.id,
          'suggested_action','Configure a delivery rate for this supplier and zone.'
        ));
      END IF;

      -- Warning: supplier role fallback
      IF COALESCE((v_line.pricing_trace->>'was_fallback')::boolean,false) THEN
        v_fallback_supplier_count := v_fallback_supplier_count + 1;
      END IF;

      -- Warning: non-strict-live quote (Phase 3 soft fallback)
      IF COALESCE((v_line.pricing_trace->>'supplier_quote_strict_live')::boolean,true) = false
         AND v_line.supplier_material_id IS NOT NULL THEN
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'code','supplier_quote_not_strictly_live',
          'message', format('Supplier quote for "%s" is not strictly live but was accepted as a soft fallback.', v_line.display_name),
          'item_id', v_line.id
        ));
      ELSIF v_line.supplier_material_id IS NOT NULL THEN
        v_strict_live_count := v_strict_live_count + 1;
      END IF;

      -- Warning: multi-trip delivery
      IF COALESCE((v_line.pricing_trace->>'trip_count')::int,0) > 1 THEN
        v_multi_trip_count := v_multi_trip_count + 1;
      END IF;

      -- Warning: margin source = system_default with no override
      IF v_line.pricing_trace->>'margin_source' = 'none' THEN
        v_no_margin_default := true;
      END IF;
    END IF;

    IF v_line.line_total IS NULL THEN
      v_has_null_line_total := true;
    END IF;
  END LOOP;

  IF v_total_lines = 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code','no_active_lines','message','Quotation has no active lines.'
    ));
  END IF;

  IF v_has_null_line_total THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code','line_total_null',
      'message','One or more lines have no computed total. Re-run pricing.',
      'suggested_action','Re-open the quotation to trigger pricing.'
    ));
  END IF;

  IF v_q.total IS NULL OR v_q.subtotal IS NULL THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code','quotation_total_null',
      'message','Quotation total has not been calculated by the pricing engine.',
      'suggested_action','Re-run pricing engine before sending.'
    ));
  END IF;

  -- Roll up warnings
  IF v_fallback_supplier_count > 0 THEN
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code','supplier_role_fallback_used',
      'message', format('%s line(s) used a fallback supplier instead of the requested role.', v_fallback_supplier_count)
    ));
  END IF;

  IF v_multi_trip_count > 0 THEN
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code','multi_trip_delivery',
      'message', format('%s line(s) require multiple delivery trips at full MOQ capacity. Delivery price reflects full trip rate.', v_multi_trip_count)
    ));
  END IF;

  IF v_no_margin_default THEN
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code','no_system_default_margin',
      'message','One or more lines resolved to a 0% margin because no subcategory or system default exists.',
      'suggested_action','Set the system default margin in Pricing Settings.'
    ));
  END IF;

  RETURN jsonb_build_object(
    'can_send', (jsonb_array_length(v_blockers) = 0),
    'blockers', v_blockers,
    'warnings', v_warnings,
    'quotation_id', _quotation_id,
    'status', v_q.status,
    'total', v_q.total,
    'subtotal', v_q.subtotal,
    'delivery_total', v_q.delivery_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_quotation(uuid) TO authenticated;
