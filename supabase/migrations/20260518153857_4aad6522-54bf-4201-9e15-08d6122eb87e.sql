-- Persist delivery_mode on the quotation row (was: metadata->>'delivery_mode')
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS delivery_mode text NOT NULL DEFAULT 'embedded';

ALTER TABLE public.quotations
  DROP CONSTRAINT IF EXISTS quotations_delivery_mode_check;
ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_delivery_mode_check
  CHECK (delivery_mode IN ('embedded', 'separate'));

-- Backfill from the legacy metadata location, where present
UPDATE public.quotations
SET delivery_mode = (metadata->>'delivery_mode')
WHERE metadata ? 'delivery_mode'
  AND metadata->>'delivery_mode' IN ('embedded', 'separate')
  AND delivery_mode IS DISTINCT FROM (metadata->>'delivery_mode');