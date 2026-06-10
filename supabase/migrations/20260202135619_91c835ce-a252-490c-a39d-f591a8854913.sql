-- Remove account_kind column from accounts table
ALTER TABLE public.accounts 
DROP COLUMN IF EXISTS account_kind;