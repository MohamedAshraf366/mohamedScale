
-- 1. Add effective_margin_pct to quotation_items
ALTER TABLE public.quotation_items
  ADD COLUMN effective_margin_pct numeric DEFAULT NULL;

-- 2. Create subcategory_margin_defaults table
CREATE TABLE public.subcategory_margin_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcategory_id uuid NOT NULL REFERENCES public.material_subcategories(id) ON DELETE CASCADE,
  default_margin_pct numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (subcategory_id)
);

-- 3. Enable RLS
ALTER TABLE public.subcategory_margin_defaults ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
CREATE POLICY "Authenticated users can view subcategory_margin_defaults"
  ON public.subcategory_margin_defaults
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage subcategory_margin_defaults"
  ON public.subcategory_margin_defaults
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
