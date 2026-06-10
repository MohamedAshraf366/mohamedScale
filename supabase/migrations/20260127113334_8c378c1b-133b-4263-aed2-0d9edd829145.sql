-- 1. Add segment column to customers table
ALTER TABLE public.customers 
ADD COLUMN segment text;

-- 2. Update segment from metadata for migrated records
UPDATE public.customers
SET segment = metadata->>'segment'
WHERE metadata->>'segment' IS NOT NULL;

-- 3. Update accounts to set poc_contact_id to the primary contact
UPDATE public.accounts a
SET poc_contact_id = c.id
FROM public.contacts c
WHERE c.account_id = a.id
  AND c.is_primary = true
  AND a.poc_contact_id IS NULL;