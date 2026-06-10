-- Temporarily drop and re-add the FK to allow the update
ALTER TABLE public.locations DROP CONSTRAINT IF EXISTS locations_zone_code_fkey;

-- Update the zone
UPDATE public.zones
SET zone_no = '07001',
    code = 'RYD.07001'
WHERE id = '1c036582-2c2e-4f71-89b8-59d45a571cb1';

-- Update referencing locations
UPDATE public.locations
SET zone_code = 'RYD.07001'
WHERE zone_code = 'RYD.31';

-- Update any delivery_rates referencing this zone code
UPDATE public.delivery_rates
SET zone_codes = array_replace(zone_codes, 'RYD.31', 'RYD.07001')
WHERE 'RYD.31' = ANY(zone_codes);

-- Re-add the FK
ALTER TABLE public.locations
ADD CONSTRAINT locations_zone_code_fkey
FOREIGN KEY (zone_code) REFERENCES public.zones(code);