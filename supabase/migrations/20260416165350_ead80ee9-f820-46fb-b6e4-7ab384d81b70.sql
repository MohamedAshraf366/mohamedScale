
-- 1. quotation_items: make material_id nullable
ALTER TABLE public.quotation_items
  ALTER COLUMN material_id DROP NOT NULL;

-- 2. quotation_items: add custom item fields
ALTER TABLE public.quotation_items
  ADD COLUMN is_custom_item boolean NOT NULL DEFAULT false,
  ADD COLUMN custom_name text,
  ADD COLUMN custom_description text;

-- 3. order_items: make material_id nullable
ALTER TABLE public.order_items
  ALTER COLUMN material_id DROP NOT NULL;

-- 4. order_items: add custom item fields
ALTER TABLE public.order_items
  ADD COLUMN is_custom_item boolean NOT NULL DEFAULT false,
  ADD COLUMN custom_name text,
  ADD COLUMN custom_description text;
