-- Drop existing function to avoid overload confusion
DROP FUNCTION IF EXISTS public.resolve_effective_supplier(uuid, text);

-- Create the single authoritative function with optional role filtering
CREATE OR REPLACE FUNCTION public.resolve_effective_supplier(
  p_material_id uuid,
  p_zone_code text,
  p_role text DEFAULT NULL
)
RETURNS TABLE(
  supplier_account_id uuid,
  supplier_material_id uuid,
  unit_price numeric,
  delivery_price numeric,
  landed_price numeric,
  role text,
  rank integer,
  source text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_filter text[];
BEGIN
  -- Map caller role to DB role values
  IF p_role = 'selected' THEN
    v_role_filter := ARRAY['selected'];
  ELSIF p_role = 'quality' THEN
    v_role_filter := ARRAY['quality_pick'];
  ELSIF p_role = 'backup' THEN
    v_role_filter := ARRAY['backup'];
  ELSE
    -- NULL or unknown → return all roles (backward-compatible)
    v_role_filter := ARRAY['selected', 'quality_pick', 'backup'];
  END IF;

  RETURN QUERY
  WITH matched_units AS (
    SELECT su.id AS supply_unit_id
    FROM supply_units su
    WHERE su.material_id = p_material_id
      AND su.zone_code = p_zone_code
      AND su.status = 'active'
    LIMIT 1
  ),
  unit_suppliers AS (
    SELECT
      sus.supplier_account_id,
      sus.supplier_material_id,
      sm.unit_price,
      COALESCE(sus.landed_price, sm.unit_price) AS landed_price,
      sus.role,
      sus.rank
    FROM supply_unit_suppliers sus
    JOIN matched_units mu ON sus.supply_unit_id = mu.supply_unit_id
    LEFT JOIN supplier_materials sm ON sm.id = sus.supplier_material_id
    WHERE sus.role = ANY(v_role_filter)
  )
  SELECT
    us.supplier_account_id,
    us.supplier_material_id,
    us.unit_price,
    0::numeric AS delivery_price,
    us.landed_price,
    us.role,
    us.rank,
    'supply_unit'::text AS source
  FROM unit_suppliers us
  ORDER BY
    CASE us.role
      WHEN 'selected' THEN 1
      WHEN 'quality_pick' THEN 2
      WHEN 'backup' THEN 3
    END,
    us.rank;
END;
$$;