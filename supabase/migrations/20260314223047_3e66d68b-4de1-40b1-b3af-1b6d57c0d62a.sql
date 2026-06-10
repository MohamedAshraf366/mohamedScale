
CREATE TABLE public.zone_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_ar text,
  region_code text NOT NULL REFERENCES public.regions(code),
  zone_codes text[] NOT NULL DEFAULT '{}',
  color text DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.zone_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view zone_groups"
  ON public.zone_groups FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage zone_groups"
  ON public.zone_groups FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
