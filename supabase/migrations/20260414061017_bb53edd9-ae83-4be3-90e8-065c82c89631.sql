
-- Add unique constraint for domain upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS uq_supply_domains_scope 
ON supply_domains (subcategory_id, area_id, COALESCE(axis_value, '__null__'), is_example);
