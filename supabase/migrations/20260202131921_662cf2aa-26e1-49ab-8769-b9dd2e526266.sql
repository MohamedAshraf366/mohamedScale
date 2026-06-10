-- Drop the existing check constraint on account_kind
ALTER TABLE public.accounts 
DROP CONSTRAINT IF EXISTS accounts_account_kind_check;

-- Update the default value for account_kind column
ALTER TABLE public.accounts 
ALTER COLUMN account_kind SET DEFAULT 'SME';