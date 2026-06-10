
-- 1. Add domain_axis to material_subcategories
ALTER TABLE public.material_subcategories
  ADD COLUMN IF NOT EXISTS domain_axis text DEFAULT NULL;

-- 2. Create supply_domains table
CREATE TABLE public.supply_domains (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcategory_id  uuid NOT NULL REFERENCES public.material_subcategories(id) ON DELETE CASCADE,
  area_id         uuid NOT NULL REFERENCES public.subcategory_areas(id) ON DELETE CASCADE,
  axis_value      text DEFAULT NULL,
  label           text NOT NULL,
  status          text NOT NULL DEFAULT 'active',
  notes           text,
  is_example      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_by      uuid
);

-- Unique constraint: one domain per subcategory x area x axis_value x mode
-- Use COALESCE for NULL axis_value uniqueness
CREATE UNIQUE INDEX uq_supply_domains_scope
  ON public.supply_domains (subcategory_id, area_id, COALESCE(axis_value, '__ALL__'), is_example);

ALTER TABLE public.supply_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view supply_domains"
  ON public.supply_domains FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage supply_domains"
  ON public.supply_domains FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 3. Create supply_domain_suppliers table
CREATE TABLE public.supply_domain_suppliers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id           uuid NOT NULL REFERENCES public.supply_domains(id) ON DELETE CASCADE,
  supplier_account_id uuid NOT NULL,
  role                text NOT NULL DEFAULT 'candidate',
  is_quality_pick     boolean NOT NULL DEFAULT false,
  landed_price        numeric,
  source_cycle_id     uuid,
  notes               text,
  is_example          boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_domain_supplier
  ON public.supply_domain_suppliers (domain_id, supplier_account_id);

ALTER TABLE public.supply_domain_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view supply_domain_suppliers"
  ON public.supply_domain_suppliers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage supply_domain_suppliers"
  ON public.supply_domain_suppliers FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 4. Create supply_domain_targets table
CREATE TABLE public.supply_domain_targets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id       uuid NOT NULL REFERENCES public.supply_domains(id) ON DELETE CASCADE,
  material_id     uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  target_price    numeric NOT NULL,
  currency        text NOT NULL DEFAULT 'SAR',
  source_cycle_id uuid,
  notes           text,
  is_example      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_domain_target
  ON public.supply_domain_targets (domain_id, material_id);

ALTER TABLE public.supply_domain_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view supply_domain_targets"
  ON public.supply_domain_targets FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage supply_domain_targets"
  ON public.supply_domain_targets FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 5. Create supply_cycle_domains join table
CREATE TABLE public.supply_cycle_domains (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id   uuid NOT NULL REFERENCES public.unlock_cycles(id) ON DELETE CASCADE,
  domain_id  uuid NOT NULL REFERENCES public.supply_domains(id) ON DELETE CASCADE,
  is_example boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_cycle_domain
  ON public.supply_cycle_domains (cycle_id, domain_id);

ALTER TABLE public.supply_cycle_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view supply_cycle_domains"
  ON public.supply_cycle_domains FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage supply_cycle_domains"
  ON public.supply_cycle_domains FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 6. Add domain_id to supply_units (nullable for backward compat)
ALTER TABLE public.supply_units
  ADD COLUMN IF NOT EXISTS domain_id uuid REFERENCES public.supply_domains(id) ON DELETE SET NULL;

-- 7. Concurrency trigger: prevent two active/planning cycles on the same domain
CREATE OR REPLACE FUNCTION public.check_domain_cycle_concurrency()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.supply_cycle_domains scd
    JOIN public.unlock_cycles uc ON uc.id = scd.cycle_id
    WHERE scd.domain_id = NEW.domain_id
      AND uc.status IN ('active', 'planning')
      AND scd.cycle_id != NEW.cycle_id
  ) THEN
    RAISE EXCEPTION 'Domain % already has an active or planning cycle', NEW.domain_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER enforce_domain_cycle_concurrency
  BEFORE INSERT ON public.supply_cycle_domains
  FOR EACH ROW EXECUTE FUNCTION public.check_domain_cycle_concurrency();

-- 8. Updated_at triggers for new tables
CREATE TRIGGER update_supply_domains_updated_at
  BEFORE UPDATE ON public.supply_domains
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_supply_domain_suppliers_updated_at
  BEFORE UPDATE ON public.supply_domain_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_supply_domain_targets_updated_at
  BEFORE UPDATE ON public.supply_domain_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
