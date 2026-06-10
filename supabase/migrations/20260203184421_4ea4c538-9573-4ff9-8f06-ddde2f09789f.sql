-- Normalize phone numbers: remove '+' prefix from all phone columns
-- This ensures all phones are stored as country code + number (e.g., 966512345678)

-- Update contacts table
UPDATE public.contacts 
SET phone = REGEXP_REPLACE(phone, '^\+', '')
WHERE phone LIKE '+%';

-- Update profiles table  
UPDATE public.profiles
SET phone = REGEXP_REPLACE(phone, '^\+', '')
WHERE phone LIKE '+%';

-- Update drivers table
UPDATE public.drivers
SET phone = REGEXP_REPLACE(phone, '^\+', '')
WHERE phone LIKE '+%';

-- Add a comment to document the phone format convention
COMMENT ON COLUMN public.contacts.phone IS 'Phone number stored WITHOUT + prefix. Format: country_code + number (e.g., 966512345678)';
COMMENT ON COLUMN public.profiles.phone IS 'Phone number stored WITHOUT + prefix. Format: country_code + number (e.g., 966512345678)';
COMMENT ON COLUMN public.drivers.phone IS 'Phone number stored WITHOUT + prefix. Format: country_code + number (e.g., 966512345678)';