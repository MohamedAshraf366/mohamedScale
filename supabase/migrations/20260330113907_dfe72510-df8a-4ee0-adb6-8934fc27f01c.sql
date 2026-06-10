ALTER TABLE public.supplier_quotes
ADD COLUMN IF NOT EXISTS valid_until date;