
-- Add 4 rating dimension columns to suppliers table
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS rating_price smallint CHECK (rating_price BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_quality smallint CHECK (rating_quality BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_delivery smallint CHECK (rating_delivery BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_responsiveness smallint CHECK (rating_responsiveness BETWEEN 1 AND 5);

-- Comment for clarity
COMMENT ON COLUMN public.suppliers.rating_price IS 'Price competitiveness rating 1-5';
COMMENT ON COLUMN public.suppliers.rating_quality IS 'Product quality rating 1-5';
COMMENT ON COLUMN public.suppliers.rating_delivery IS 'Delivery reliability rating 1-5';
COMMENT ON COLUMN public.suppliers.rating_responsiveness IS 'Communication responsiveness rating 1-5';
