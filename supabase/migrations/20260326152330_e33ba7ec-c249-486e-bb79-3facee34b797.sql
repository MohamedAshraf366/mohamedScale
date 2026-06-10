
-- 1. Create subcategory_areas table
CREATE TABLE IF NOT EXISTS public.subcategory_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcategory_id uuid NOT NULL REFERENCES public.material_subcategories(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_ar text,
  zone_codes text[] NOT NULL DEFAULT '{}',
  color text NOT NULL DEFAULT '#6366f1',
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE INDEX IF NOT EXISTS idx_subcategory_areas_subcategory ON public.subcategory_areas(subcategory_id);

ALTER TABLE public.subcategory_areas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view subcategory_areas"
    ON public.subcategory_areas FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can manage subcategory_areas"
    ON public.subcategory_areas FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Overlap validation trigger
CREATE OR REPLACE FUNCTION public.check_area_zone_overlap()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE overlap_codes text[];
BEGIN
  SELECT array_agg(DISTINCT unnested) INTO overlap_codes
  FROM public.subcategory_areas sa, unnest(sa.zone_codes) AS unnested
  WHERE sa.subcategory_id = NEW.subcategory_id AND sa.id != NEW.id AND unnested = ANY(NEW.zone_codes);
  IF array_length(overlap_codes, 1) > 0 THEN
    RAISE EXCEPTION 'Zone codes overlap with existing areas: %', array_to_string(overlap_codes, ', ');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_check_area_zone_overlap ON public.subcategory_areas;
CREATE TRIGGER trg_check_area_zone_overlap
  BEFORE INSERT OR UPDATE ON public.subcategory_areas
  FOR EACH ROW EXECUTE FUNCTION public.check_area_zone_overlap();

-- 3. Refactor target_prices (idempotent)
DO $$ BEGIN
  ALTER TABLE public.target_prices ADD COLUMN area_id uuid REFERENCES public.subcategory_areas(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

ALTER TABLE public.target_prices DROP CONSTRAINT IF EXISTS target_prices_material_id_zone_group_id_key;
ALTER TABLE public.target_prices DROP COLUMN IF EXISTS zone_group_id;

DO $$ BEGIN
  ALTER TABLE public.target_prices ADD CONSTRAINT target_prices_material_area_unique UNIQUE (material_id, area_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Drop old link table
DROP TABLE IF EXISTS public.subcategory_zone_groups;

-- 5. Update target price gate trigger
CREATE OR REPLACE FUNCTION public.check_target_price_exists()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.target_prices tp WHERE tp.material_id = NEW.material_id LIMIT 1) THEN
    RAISE EXCEPTION 'No target price set for material %. Set target prices before adding supplier quotes.', NEW.material_id;
  END IF;
  RETURN NEW;
END; $$;

-- 6. Clean up data - quotation_items BEFORE supplier_materials
DELETE FROM public.quotation_items;
DELETE FROM public.order_items;
DELETE FROM public.supplier_quote_delivery_lines;
DELETE FROM public.supplier_materials;
DELETE FROM public.supplier_quotes;
DELETE FROM public.target_prices;
DELETE FROM public.unlock_cycle_materials;
DELETE FROM public.unlock_cycles;
DELETE FROM public.material_aliases;
DELETE FROM public.materials;
DELETE FROM public.material_subcategories;
DELETE FROM public.material_categories;
