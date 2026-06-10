
-- Add material-level override capability to supply_domain_directives
ALTER TABLE public.supply_domain_directives 
  ADD COLUMN IF NOT EXISTS material_id uuid NULL REFERENCES public.materials(id) ON DELETE CASCADE;

-- Loosen role check to include 'backup' (currently 'fallback') and 'rejected'
ALTER TABLE public.supply_domain_directives DROP CONSTRAINT IF EXISTS supply_domain_directives_role_check;
ALTER TABLE public.supply_domain_directives 
  ADD CONSTRAINT supply_domain_directives_role_check 
  CHECK (role = ANY (ARRAY['selected'::text, 'quality'::text, 'backup'::text, 'fallback'::text, 'rejected'::text]));

-- Partial unique indexes for one active row per scope
CREATE UNIQUE INDEX IF NOT EXISTS supply_domain_directives_domain_unique
  ON public.supply_domain_directives (domain_id, supplier_account_id, role)
  WHERE material_id IS NULL AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS supply_domain_directives_material_unique
  ON public.supply_domain_directives (domain_id, supplier_account_id, material_id, role)
  WHERE material_id IS NOT NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS supply_domain_directives_material_lookup
  ON public.supply_domain_directives (domain_id, material_id) WHERE is_active = true;
