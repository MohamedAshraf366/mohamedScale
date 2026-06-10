
-- =============================================
-- Phase 2.1: Create supply_domain_directives
-- =============================================

CREATE TABLE public.supply_domain_directives (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id uuid NOT NULL REFERENCES public.supply_domains(id) ON DELETE CASCADE,
  supplier_account_id uuid NOT NULL REFERENCES public.suppliers(account_id),
  role text NOT NULL CHECK (role IN ('selected', 'quality', 'fallback')),
  landed_price numeric,
  set_by_cycle_id uuid REFERENCES public.unlock_cycles(id),
  notes text,
  is_example boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Max 1 active selected per domain per environment
CREATE UNIQUE INDEX uq_domain_directive_selected_active
  ON public.supply_domain_directives (domain_id, is_example)
  WHERE role = 'selected' AND is_active = true;

-- Max 1 active quality per domain per environment
CREATE UNIQUE INDEX uq_domain_directive_quality_active
  ON public.supply_domain_directives (domain_id, is_example)
  WHERE role = 'quality' AND is_active = true;

-- Enable RLS
ALTER TABLE public.supply_domain_directives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view supply_domain_directives"
  ON public.supply_domain_directives FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert supply_domain_directives"
  ON public.supply_domain_directives FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update supply_domain_directives"
  ON public.supply_domain_directives FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Admins can delete supply_domain_directives"
  ON public.supply_domain_directives FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- Phase 2.3: Reshape target_prices
-- =============================================

-- Add new columns
ALTER TABLE public.target_prices
  ADD COLUMN scope_type text,
  ADD COLUMN scope_id uuid,
  ADD COLUMN best_price numeric,
  ADD COLUMN average_price numeric,
  ADD COLUMN source_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN is_locked boolean NOT NULL DEFAULT false;

-- Backfill existing rows: area_id → scope_type='area', scope_id=area_id
UPDATE public.target_prices
  SET scope_type = 'area',
      scope_id = area_id
  WHERE area_id IS NOT NULL;

-- Make scope columns NOT NULL after backfill
ALTER TABLE public.target_prices
  ALTER COLUMN scope_type SET NOT NULL,
  ALTER COLUMN scope_id SET NOT NULL;

-- Add check constraint for scope_type
ALTER TABLE public.target_prices
  ADD CONSTRAINT chk_target_prices_scope_type CHECK (scope_type IN ('area', 'zone'));

-- New unique index replacing old one
DROP INDEX IF EXISTS target_prices_material_id_area_id_key;
CREATE UNIQUE INDEX uq_target_prices_scope
  ON public.target_prices (material_id, scope_type, scope_id, is_example);

-- Drop legacy columns
ALTER TABLE public.target_prices
  DROP COLUMN area_id,
  DROP COLUMN zone_codes;

-- =============================================
-- Phase 2.3b: Drop supply_domain_targets (0 rows)
-- =============================================
DROP TABLE IF EXISTS public.supply_domain_targets;

-- =============================================
-- Phase 2.5: Add provenance to order_items
-- =============================================
ALTER TABLE public.order_items
  ADD COLUMN supply_unit_id uuid,
  ADD COLUMN domain_id uuid,
  ADD COLUMN source_quote_id uuid;
