-- 1. Create subcategory_zone_groups link table
CREATE TABLE IF NOT EXISTS subcategory_zone_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcategory_id uuid NOT NULL REFERENCES material_subcategories(id) ON DELETE CASCADE,
  zone_group_id uuid NOT NULL REFERENCES zone_groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (subcategory_id, zone_group_id)
);

ALTER TABLE subcategory_zone_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view subcategory_zone_groups"
  ON subcategory_zone_groups FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage subcategory_zone_groups"
  ON subcategory_zone_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Modify target_prices: make zone_group_id required, drop zone_codes
-- First migrate existing data: find matching zone_group for the existing record
UPDATE target_prices tp
SET zone_group_id = (
  SELECT zg.id FROM zone_groups zg
  WHERE tp.zone_codes <@ zg.zone_codes AND zg.zone_codes <@ tp.zone_codes
  LIMIT 1
)
WHERE tp.zone_group_id IS NULL AND tp.zone_codes IS NOT NULL AND array_length(tp.zone_codes, 1) > 0;

-- Drop zone_codes column
ALTER TABLE target_prices DROP COLUMN IF EXISTS zone_codes;

-- Make zone_group_id NOT NULL (delete orphaned rows first)
DELETE FROM target_prices WHERE zone_group_id IS NULL;

ALTER TABLE target_prices ALTER COLUMN zone_group_id SET NOT NULL;

-- Add unique constraint: one price per material per area
ALTER TABLE target_prices ADD CONSTRAINT target_prices_material_area_unique
  UNIQUE (material_id, zone_group_id);

-- Update the trigger function that checks target prices for supplier materials
CREATE OR REPLACE FUNCTION check_target_price_exists()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM target_prices WHERE material_id = NEW.material_id
  ) THEN
    RAISE EXCEPTION 'No target price set for material %. Set a target price before adding supplier quotes.', NEW.material_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;