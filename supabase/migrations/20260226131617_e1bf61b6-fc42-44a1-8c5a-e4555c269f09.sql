
-- Create locations for customer accounts that don't have one, set city=Riyadh, region=RYD, country=SA
-- Then link them back to the account

-- Step 1: Insert missing locations and capture the mapping
WITH missing AS (
  SELECT a.id AS account_id
  FROM accounts a
  JOIN customers c ON c.account_id = a.id
  WHERE a.location_id IS NULL
),
new_locs AS (
  INSERT INTO locations (city, country, region_code, address_text)
  SELECT 'Riyadh'::saudi_city, 'SA'::gcc_country, 'RYD', 'الرياض'
  FROM missing
  RETURNING id
),
-- Pair each new location with its account
paired AS (
  SELECT m.account_id, n.id AS location_id
  FROM (SELECT account_id, ROW_NUMBER() OVER () AS rn FROM missing) m
  JOIN (SELECT id, ROW_NUMBER() OVER () AS rn FROM new_locs) n ON m.rn = n.rn
)
-- Step 2: Update accounts to point to the new locations
UPDATE accounts a
SET location_id = p.location_id, updated_at = now()
FROM paired p
WHERE a.id = p.account_id;
