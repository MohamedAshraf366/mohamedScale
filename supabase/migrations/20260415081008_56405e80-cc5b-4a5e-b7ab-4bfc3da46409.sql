
-- 1. Update resolve_effective_supplier to support quality role resolution (C10)
CREATE OR REPLACE FUNCTION public.resolve_effective_supplier(
  p_material_id uuid,
  p_zone_code text,
  p_is_example boolean DEFAULT false,
  p_role text DEFAULT 'selected'
)
RETURNS TABLE(
  source text,
  supplier_account_id uuid,
  role text,
  landed_price numeric,
  supply_unit_id uuid,
  domain_id uuid
)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
BEGIN
  -- Tier 1: Atom override (supply_unit_suppliers)
  RETURN QUERY
  SELECT
    'atom'::text AS source,
    sus.supplier_account_id,
    sus.role,
    COALESCE(sm.unit_price, 0) + COALESCE(
      (SELECT dr.price_per_moq FROM delivery_rates dr
       WHERE dr.supplier_account_id = sus.supplier_account_id
         AND dr.is_example = p_is_example
         AND (p_zone_code = ANY(dr.zone_codes) OR dr.is_default = true)
       ORDER BY (p_zone_code = ANY(dr.zone_codes)) DESC, dr.is_default ASC
       LIMIT 1), 0
    ) AS landed_price,
    su.id AS supply_unit_id,
    su.domain_id
  FROM supply_units su
  JOIN supply_unit_suppliers sus ON sus.supply_unit_id = su.id
  LEFT JOIN supplier_materials sm ON sm.supplier_account_id = sus.supplier_account_id
    AND sm.material_id = p_material_id
    AND sm.is_current = true
    AND sm.is_example = p_is_example
  WHERE su.zone_code = p_zone_code
    AND su.is_example = p_is_example
    AND sus.role = p_role
    AND EXISTS (
      SELECT 1 FROM materials m WHERE m.id = p_material_id AND m.subcategory_id = su.subcategory_id
    )
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- Tier 2: Domain default (supply_domain_directives)
  RETURN QUERY
  SELECT
    'domain'::text AS source,
    sdd.supplier_account_id,
    sdd.role,
    COALESCE(sm.unit_price, 0) + COALESCE(
      (SELECT dr.price_per_moq FROM delivery_rates dr
       WHERE dr.supplier_account_id = sdd.supplier_account_id
         AND dr.is_example = p_is_example
         AND (p_zone_code = ANY(dr.zone_codes) OR dr.is_default = true)
       ORDER BY (p_zone_code = ANY(dr.zone_codes)) DESC, dr.is_default ASC
       LIMIT 1), 0
    ) AS landed_price,
    NULL::uuid AS supply_unit_id,
    sd.id AS domain_id
  FROM supply_domains sd
  JOIN supply_domain_directives sdd ON sdd.domain_id = sd.id
    AND sdd.is_active = true
    AND sdd.role = p_role
  JOIN subcategory_areas sa ON sa.id = sd.area_id
  LEFT JOIN supplier_materials sm ON sm.supplier_account_id = sdd.supplier_account_id
    AND sm.material_id = p_material_id
    AND sm.is_current = true
    AND sm.is_example = p_is_example
  WHERE sd.is_example = p_is_example
    AND sd.status = 'active'
    AND p_zone_code = ANY(sa.zone_codes)
    AND EXISTS (
      SELECT 1 FROM materials m WHERE m.id = p_material_id AND m.subcategory_id = sd.subcategory_id
    )
  LIMIT 1;

  RETURN;
END;
$$;

-- 2. Auto-review trigger on supplier_quotes status change (C4)
CREATE OR REPLACE FUNCTION public.flag_domains_on_quote_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only flag when status changes to expired, rejected, or revoked
  IF NEW.status IN ('expired', 'rejected', 'revoked') AND OLD.status != NEW.status THEN
    UPDATE supply_domains sd
    SET review_status = 'needs_review',
        review_reason = 'Supplier quote ' || NEW.id || ' status changed to ' || NEW.status,
        review_flagged_at = now()
    FROM supply_domain_directives sdd
    WHERE sdd.domain_id = sd.id
      AND sdd.is_active = true
      AND sdd.supplier_account_id = NEW.supplier_account_id
      AND sd.review_status IS DISTINCT FROM 'needs_review';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_flag_domains_on_quote_status
  AFTER UPDATE OF status ON public.supplier_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.flag_domains_on_quote_status_change();
