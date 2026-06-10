-- Phase 3.1: resolve_effective_supplier() — SSOT §3.1
-- Resolution: atom override → domain default
CREATE OR REPLACE FUNCTION public.resolve_effective_supplier(
  p_material_id uuid,
  p_zone_code text,
  p_is_example boolean DEFAULT false
)
RETURNS TABLE(
  source text,
  supplier_account_id uuid,
  role text,
  landed_price numeric,
  supply_unit_id uuid,
  domain_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Try atom-level override: supply_unit_suppliers with role = 'selected'
  RETURN QUERY
  SELECT
    'atom'::text AS source,
    sus.supplier_account_id,
    sus.role,
    sus.landed_price,
    sus.supply_unit_id,
    su.domain_id
  FROM supply_unit_suppliers sus
  JOIN supply_units su ON su.id = sus.supply_unit_id
  WHERE su.material_id = p_material_id
    AND su.zone_code = p_zone_code
    AND su.is_example = p_is_example
    AND sus.is_example = p_is_example
    AND sus.role = 'selected'
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- 2. Fall back to domain directive
  -- First find the domain for this material+zone
  RETURN QUERY
  SELECT
    'domain'::text AS source,
    sdd.supplier_account_id,
    sdd.role,
    sdd.landed_price,
    NULL::uuid AS supply_unit_id,
    sdd.domain_id
  FROM supply_domain_directives sdd
  JOIN supply_domains sd ON sd.id = sdd.domain_id
  JOIN subcategory_areas sa ON sa.id = sd.area_id
  WHERE sdd.is_active = true
    AND sdd.role = 'selected'
    AND sdd.is_example = p_is_example
    AND sd.is_example = p_is_example
    AND p_zone_code = ANY(sa.zone_codes)
    -- Match material to domain's subcategory
    AND sd.subcategory_id = (
      SELECT m.subcategory_id FROM materials m WHERE m.id = p_material_id
    )
    -- If domain has axis_value, match against material specs
    AND (
      sd.axis_value IS NULL
      OR sd.axis_value = (
        SELECT m.specs ->> (
          SELECT ms.domain_axis FROM material_subcategories ms WHERE ms.id = sd.subcategory_id
        )
        FROM materials m WHERE m.id = p_material_id
      )
    )
  LIMIT 1;
END;
$$;

-- Phase 3.2: promote_cycle_to_domain() — SSOT §3.2
-- Promotes cycle results into domain directives with history preservation
CREATE OR REPLACE FUNCTION public.promote_cycle_to_domain(
  p_cycle_id uuid,
  p_domain_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_example boolean;
  v_count integer := 0;
  v_rec record;
BEGIN
  -- Determine environment from the cycle
  SELECT is_example INTO v_is_example
  FROM unlock_cycles
  WHERE id = p_cycle_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cycle % not found', p_cycle_id;
  END IF;

  -- Aggregate supplier roles from atom-level assignments for this cycle+domain
  FOR v_rec IN
    SELECT
      sus.supplier_account_id,
      -- Pick the highest-priority role across all atoms
      CASE
        WHEN bool_or(sus.role = 'selected') THEN 'selected'
        WHEN bool_or(sus.role = 'quality_pick' OR sus.is_quality_pick) THEN 'quality'
        ELSE 'fallback'
      END AS directive_role,
      MIN(sus.landed_price) AS best_landed_price,
      COUNT(*) AS atom_count
    FROM supply_unit_suppliers sus
    JOIN supply_units su ON su.id = sus.supply_unit_id
    WHERE su.cycle_id = p_cycle_id
      AND su.domain_id = p_domain_id
      AND su.is_example = v_is_example
      AND sus.is_example = v_is_example
    GROUP BY sus.supplier_account_id
  LOOP
    -- Deactivate previous active directive of same constrained role
    IF v_rec.directive_role IN ('selected', 'quality') THEN
      UPDATE supply_domain_directives
      SET is_active = false,
          effective_until = now(),
          updated_at = now()
      WHERE domain_id = p_domain_id
        AND role = v_rec.directive_role
        AND is_active = true
        AND is_example = v_is_example;
    END IF;

    -- Insert new directive
    INSERT INTO supply_domain_directives (
      domain_id, supplier_account_id, role, landed_price,
      set_by_cycle_id, is_example, is_active, effective_from
    ) VALUES (
      p_domain_id, v_rec.supplier_account_id, v_rec.directive_role,
      v_rec.best_landed_price, p_cycle_id, v_is_example, true, now()
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Phase 3.3: Review status on supply_domains — SSOT §3.3
ALTER TABLE public.supply_domains
  ADD COLUMN IF NOT EXISTS review_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS review_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS review_flagged_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS review_flagged_by uuid DEFAULT NULL;