
ALTER TABLE public.unlock_cycles
  ADD COLUMN IF NOT EXISTS subcategory_id uuid REFERENCES public.material_subcategories(id),
  ADD COLUMN IF NOT EXISTS scope_filter jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.unlock_cycles.scope_filter IS 'JSONB filter for material scope. Example: {"axes": {"size": ["10mm","20mm"]}} to select specific spec values within the subcategory.';
