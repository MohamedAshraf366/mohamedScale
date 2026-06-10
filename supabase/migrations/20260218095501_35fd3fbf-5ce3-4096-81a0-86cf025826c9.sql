
-- 1. Add new array columns
ALTER TABLE public.delivery_rates
  ADD COLUMN supplier_material_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN zone_ids uuid[] NOT NULL DEFAULT '{}';

-- 2. Migrate existing data into new columns
UPDATE public.delivery_rates
SET supplier_material_ids = ARRAY[supplier_material_id],
    zone_ids = ARRAY[zone_id];

-- 3. Drop old unique constraint, FK constraints, and columns
ALTER TABLE public.delivery_rates DROP CONSTRAINT IF EXISTS ux_delivery_rate_material_zone;
ALTER TABLE public.delivery_rates DROP CONSTRAINT IF EXISTS delivery_rates_supplier_material_id_fkey;
ALTER TABLE public.delivery_rates DROP CONSTRAINT IF EXISTS delivery_rates_zone_id_fkey;
ALTER TABLE public.delivery_rates DROP COLUMN supplier_material_id;
ALTER TABLE public.delivery_rates DROP COLUMN zone_id;
