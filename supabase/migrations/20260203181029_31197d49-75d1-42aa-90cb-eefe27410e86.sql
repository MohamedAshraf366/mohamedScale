-- Backfill address_link for locations that have lat/lng but no address_link
UPDATE public.locations
SET 
  address_link = 'https://www.google.com/maps?q=' || lat || ',' || lng,
  updated_at = now()
WHERE 
  lat IS NOT NULL 
  AND lng IS NOT NULL 
  AND (address_link IS NULL OR address_link = '');