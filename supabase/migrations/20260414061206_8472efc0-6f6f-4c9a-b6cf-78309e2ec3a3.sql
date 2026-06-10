
-- Drop the expression index that doesn't work with PostgREST upsert
DROP INDEX IF EXISTS uq_supply_domains_scope;

-- Create two partial unique indexes instead
CREATE UNIQUE INDEX uq_supply_domains_with_axis 
ON supply_domains (subcategory_id, area_id, axis_value, is_example)
WHERE axis_value IS NOT NULL;

CREATE UNIQUE INDEX uq_supply_domains_without_axis
ON supply_domains (subcategory_id, area_id, is_example)
WHERE axis_value IS NULL;
