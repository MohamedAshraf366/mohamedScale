
-- =====================================================
-- PHASE 2: DATA DELETION
-- =====================================================

-- Group A: Ghost data in non-is_example tables
DELETE FROM communication_action_items
WHERE communication_id IN (
  SELECT id FROM communications
  WHERE account_id IN (SELECT id FROM accounts WHERE is_example = true)
     OR opportunity_id = '8558fd13-63ff-46c5-a1a9-0fb2925ade7f'
);

DELETE FROM quotation_items
WHERE quotation_id IN (
  SELECT id FROM quotations
  WHERE customer_account_id IN (SELECT id FROM accounts WHERE is_example = true)
     OR opportunity_id = '8558fd13-63ff-46c5-a1a9-0fb2925ade7f'
);

DELETE FROM order_items
WHERE order_id IN (
  SELECT id FROM orders
  WHERE customer_account_id IN (SELECT id FROM accounts WHERE is_example = true)
);

DELETE FROM communications
WHERE account_id IN (SELECT id FROM accounts WHERE is_example = true)
   OR opportunity_id = '8558fd13-63ff-46c5-a1a9-0fb2925ade7f';

DELETE FROM invoices
WHERE customer_account_id IN (SELECT id FROM accounts WHERE is_example = true);

DELETE FROM orders
WHERE customer_account_id IN (SELECT id FROM accounts WHERE is_example = true);

DELETE FROM quotations
WHERE customer_account_id IN (SELECT id FROM accounts WHERE is_example = true)
   OR opportunity_id = '8558fd13-63ff-46c5-a1a9-0fb2925ade7f';

DELETE FROM opportunities
WHERE customer_account_id IN (SELECT id FROM accounts WHERE is_example = true)
   OR id = '8558fd13-63ff-46c5-a1a9-0fb2925ade7f';

DELETE FROM projects
WHERE customer_account_id IN (SELECT id FROM accounts WHERE is_example = true);

DELETE FROM contacts
WHERE account_id IN (SELECT id FROM accounts WHERE is_example = true);

DELETE FROM customers
WHERE account_id IN (SELECT id FROM accounts WHERE is_example = true);

-- Group B: is_example = true rows
DELETE FROM supply_unit_suppliers WHERE is_example = true;
DELETE FROM supply_units WHERE is_example = true;
DELETE FROM unlock_cycle_materials WHERE is_example = true;
DELETE FROM unlock_cycles WHERE is_example = true;
DELETE FROM delivery_rates WHERE is_example = true;
DELETE FROM supplier_materials WHERE is_example = true;
DELETE FROM supplier_quotes WHERE is_example = true;
DELETE FROM target_prices WHERE is_example = true;
DELETE FROM supply_domain_directives WHERE is_example = true;
DELETE FROM supply_domains WHERE is_example = true;
DELETE FROM supply_cycle_domains WHERE is_example = true;
DELETE FROM accounts WHERE is_example = true;

-- Group C: Orphaned locations
DELETE FROM locations WHERE id IN (
  'cccccccc-0001-4000-c000-000000000001',
  'cccccccc-0001-4000-c000-000000000002',
  'cccccccc-0001-4000-c000-000000000003',
  'cccccccc-0001-4000-c000-000000000004',
  'cccccccc-0001-4000-c000-000000000005'
);

-- =====================================================
-- PHASE 3: SCHEMA CLEANUP
-- =====================================================

-- MUST drop the view first before dropping columns it depends on
DROP VIEW IF EXISTS customer_list_v1;

-- Drop all is_example indexes
DROP INDEX IF EXISTS idx_accounts_is_example;
DROP INDEX IF EXISTS idx_delivery_rates_is_example;
DROP INDEX IF EXISTS idx_supplier_materials_is_example;
DROP INDEX IF EXISTS idx_supplier_quotes_is_example;
DROP INDEX IF EXISTS idx_supply_cycle_domains_is_example;
DROP INDEX IF EXISTS idx_supply_domain_directives_is_example;
DROP INDEX IF EXISTS idx_supply_domains_is_example;
DROP INDEX IF EXISTS idx_supply_unit_suppliers_is_example;
DROP INDEX IF EXISTS idx_supply_units_is_example;
DROP INDEX IF EXISTS idx_target_prices_is_example;
DROP INDEX IF EXISTS idx_unlock_cycle_materials_is_example;
DROP INDEX IF EXISTS idx_unlock_cycles_is_example;
DROP INDEX IF EXISTS idx_supply_domain_suppliers_is_example;

-- Drop unique indexes that include is_example
DROP INDEX IF EXISTS uq_domain_directive_selected_active;
DROP INDEX IF EXISTS uq_domain_directive_quality_active;
DROP INDEX IF EXISTS uq_supply_domains_with_axis;
DROP INDEX IF EXISTS uq_supply_domains_without_axis;
DROP INDEX IF EXISTS uq_target_prices_scope;

-- Recreate unique indexes WITHOUT is_example
CREATE UNIQUE INDEX uq_domain_directive_selected_active
  ON supply_domain_directives (domain_id)
  WHERE role = 'selected' AND is_active = true;

CREATE UNIQUE INDEX uq_domain_directive_quality_active
  ON supply_domain_directives (domain_id)
  WHERE role = 'quality_pick' AND is_active = true;

CREATE UNIQUE INDEX uq_supply_domains_with_axis
  ON supply_domains (subcategory_id, area_id, axis_value)
  WHERE axis_value IS NOT NULL;

CREATE UNIQUE INDEX uq_supply_domains_without_axis
  ON supply_domains (subcategory_id, area_id)
  WHERE axis_value IS NULL;

CREATE UNIQUE INDEX uq_target_prices_scope
  ON target_prices (material_id, scope_type, scope_id);

-- Drop is_example columns
ALTER TABLE accounts DROP COLUMN is_example;
ALTER TABLE delivery_rates DROP COLUMN is_example;
ALTER TABLE supplier_materials DROP COLUMN is_example;
ALTER TABLE supplier_quotes DROP COLUMN is_example;
ALTER TABLE supply_cycle_domains DROP COLUMN is_example;
ALTER TABLE supply_domain_directives DROP COLUMN is_example;
ALTER TABLE supply_domains DROP COLUMN is_example;
ALTER TABLE supply_unit_suppliers DROP COLUMN is_example;
ALTER TABLE supply_units DROP COLUMN is_example;
ALTER TABLE target_prices DROP COLUMN is_example;
ALTER TABLE unlock_cycle_materials DROP COLUMN is_example;
ALTER TABLE unlock_cycles DROP COLUMN is_example;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'supply_domain_suppliers' AND column_name = 'is_example'
  ) THEN
    EXECUTE 'ALTER TABLE supply_domain_suppliers DROP COLUMN is_example';
  END IF;
END $$;

-- Recreate customer_list_v1 view without is_example
CREATE OR REPLACE VIEW customer_list_v1 AS
SELECT
  a.id AS account_id,
  a.display_name,
  a.display_name_ar,
  a.legal_name,
  a.code,
  a.status AS account_status,
  a.location_id,
  a.website,
  a.tax_number,
  a.notes AS account_notes,
  a.metadata AS account_metadata,
  a.created_at AS account_created_at,
  c.account_id AS customer_account_id,
  c.customer_type,
  c.lifecycle_stage,
  c.assigned_to,
  c.payment_terms_days,
  c.credit_limit,
  c.pricing_tier,
  ct.id AS primary_contact_id,
  ct.full_name AS primary_contact_name,
  ct.phone AS primary_contact_phone,
  ct.email AS primary_contact_email,
  ct.role_title AS primary_contact_role,
  l.region_code,
  l.zone_code,
  l.city,
  l.address_text,
  l.lat,
  l.lng
FROM accounts a
LEFT JOIN customers c ON c.account_id = a.id
LEFT JOIN contacts ct ON ct.id = a.poc_contact_id
LEFT JOIN locations l ON l.id = a.location_id
WHERE a.deleted_at IS NULL
  AND c.account_id IS NOT NULL;

-- Replace resolve_effective_supplier (remove p_is_example)
DROP FUNCTION IF EXISTS resolve_effective_supplier(uuid, text, boolean);
DROP FUNCTION IF EXISTS resolve_effective_supplier(uuid, text);

CREATE OR REPLACE FUNCTION resolve_effective_supplier(
  p_material_id uuid,
  p_zone_code text
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
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    WHERE sus.role IN ('selected', 'quality_pick', 'backup')
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

-- Replace promote_cycle_to_domain (remove is_example logic)
CREATE OR REPLACE FUNCTION promote_cycle_to_domain(
  p_cycle_id uuid,
  p_domain_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_sus record;
BEGIN
  UPDATE supply_domain_directives
  SET is_active = false, updated_at = now()
  WHERE domain_id = p_domain_id AND is_active = true;

  FOR v_sus IN
    SELECT DISTINCT ON (sus.supply_unit_id, sus.role)
      sus.supplier_account_id, sus.supplier_material_id,
      sus.role, sus.rank, sus.landed_price
    FROM supply_unit_suppliers sus
    JOIN supply_units su ON su.id = sus.supply_unit_id
    WHERE su.cycle_id = p_cycle_id
      AND su.domain_id = p_domain_id
      AND sus.role IN ('selected', 'quality_pick')
    ORDER BY sus.supply_unit_id, sus.role, sus.rank
  LOOP
    INSERT INTO supply_domain_directives (
      domain_id, supplier_account_id, supplier_material_id,
      role, rank, landed_price, is_active, source_cycle_id,
      created_at, updated_at
    ) VALUES (
      p_domain_id, v_sus.supplier_account_id, v_sus.supplier_material_id,
      v_sus.role, v_sus.rank, v_sus.landed_price, true,
      p_cycle_id, now(), now()
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
