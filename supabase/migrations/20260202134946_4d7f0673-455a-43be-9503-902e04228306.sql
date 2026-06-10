-- 1. Drop segment column from customers table
ALTER TABLE public.customers 
DROP COLUMN IF EXISTS segment;

-- 2. Add customer_type column to customers table
ALTER TABLE public.customers 
ADD COLUMN customer_type text NOT NULL DEFAULT 'SME';

-- 3. Randomly populate customer_type for existing customers
UPDATE public.customers
SET customer_type = (
  CASE (floor(random() * 5)::int)
    WHEN 0 THEN 'SME'
    WHEN 1 THEN 'RED'
    WHEN 2 THEN 'Large Contractor'
    WHEN 3 THEN 'Individual'
    WHEN 4 THEN 'Other'
  END
);

-- 4. Reset account_kind in accounts back to generic values
ALTER TABLE public.accounts 
ALTER COLUMN account_kind SET DEFAULT 'company';

-- 5. Reset existing account_kind values to 'company' (generic)
UPDATE public.accounts
SET account_kind = 'company'
WHERE account_kind IN ('SME', 'RED', 'Large Contractor', 'Individual', 'Other');