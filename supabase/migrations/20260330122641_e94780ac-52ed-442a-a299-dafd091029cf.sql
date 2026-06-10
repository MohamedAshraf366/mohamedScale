-- Migration 4: supply_units
CREATE TABLE public.supply_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.unlock_cycles(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
  zone_code text NOT NULL REFERENCES public.zones(code) ON DELETE RESTRICT,
  area_id uuid REFERENCES public.subcategory_areas(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','sourcing','active','frozen','inactive')),
  target_price numeric,
  activated_at timestamptz,
  frozen_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (cycle_id, material_id, zone_code)
);

CREATE INDEX idx_supply_units_cycle ON public.supply_units(cycle_id);
CREATE INDEX idx_supply_units_material ON public.supply_units(material_id);
CREATE INDEX idx_supply_units_zone ON public.supply_units(zone_code);
CREATE INDEX idx_supply_units_status ON public.supply_units(status);

ALTER TABLE public.supply_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view supply_units"
  ON public.supply_units FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage supply_units"
  ON public.supply_units FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_supply_units_updated_at
  BEFORE UPDATE ON public.supply_units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Migration 5: supplier_quote_delivery_allocations
CREATE TABLE public.supplier_quote_delivery_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_quote_id uuid NOT NULL REFERENCES public.supplier_quotes(id) ON DELETE CASCADE,
  supplier_material_id uuid NOT NULL REFERENCES public.supplier_materials(id) ON DELETE CASCADE,
  delivery_line_id uuid NOT NULL REFERENCES public.supplier_quote_delivery_lines(id) ON DELETE CASCADE,
  zone_code text NOT NULL REFERENCES public.zones(code) ON DELETE RESTRICT,
  unit_price numeric NOT NULL,
  moq numeric NOT NULL CHECK (moq > 0),
  raw_delivery_price_per_moq numeric NOT NULL,
  allocation_method text NOT NULL DEFAULT 'equal'
    CHECK (allocation_method IN ('equal','by_moq','by_value','manual')),
  allocation_share_pct numeric NOT NULL
    CHECK (allocation_share_pct >= 0 AND allocation_share_pct <= 100),
  allocated_delivery_per_moq numeric NOT NULL,
  landed_price_per_unit numeric NOT NULL,
  is_changed boolean NOT NULL DEFAULT true,
  prior_allocation_id uuid REFERENCES public.supplier_quote_delivery_allocations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_material_id, delivery_line_id, zone_code)
);

CREATE INDEX idx_alloc_quote ON public.supplier_quote_delivery_allocations(supplier_quote_id);
CREATE INDEX idx_alloc_sm ON public.supplier_quote_delivery_allocations(supplier_material_id);
CREATE INDEX idx_alloc_dl ON public.supplier_quote_delivery_allocations(delivery_line_id);
CREATE INDEX idx_alloc_zone ON public.supplier_quote_delivery_allocations(zone_code);

ALTER TABLE public.supplier_quote_delivery_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view supplier_quote_delivery_allocations"
  ON public.supplier_quote_delivery_allocations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage supplier_quote_delivery_allocations"
  ON public.supplier_quote_delivery_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.validate_supplier_quote_delivery_allocation_shares_v1(p_delivery_line_id uuid, p_zone_code text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_total numeric;
BEGIN
  SELECT COALESCE(SUM(allocation_share_pct), 0)
    INTO v_total
  FROM public.supplier_quote_delivery_allocations
  WHERE delivery_line_id = p_delivery_line_id
    AND zone_code = p_zone_code;

  RETURN abs(v_total - 100) < 0.0001;
END;
$$;

-- Migration 6: supply_unit_suppliers
CREATE TABLE public.supply_unit_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_unit_id uuid NOT NULL REFERENCES public.supply_units(id) ON DELETE CASCADE,
  supplier_account_id uuid NOT NULL REFERENCES public.suppliers(account_id) ON DELETE CASCADE,
  supplier_material_id uuid REFERENCES public.supplier_materials(id) ON DELETE SET NULL,
  delivery_allocation_id uuid REFERENCES public.supplier_quote_delivery_allocations(id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'candidate'
    CHECK (role IN ('candidate','selected','backup')),
  rank integer,
  landed_price numeric,
  is_frozen boolean NOT NULL DEFAULT false,
  frozen_reason text,
  frozen_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  frozen_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (supply_unit_id, supplier_account_id)
);

CREATE INDEX idx_sus_supply_unit ON public.supply_unit_suppliers(supply_unit_id);
CREATE INDEX idx_sus_supplier ON public.supply_unit_suppliers(supplier_account_id);
CREATE INDEX idx_sus_role ON public.supply_unit_suppliers(role);

ALTER TABLE public.supply_unit_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view supply_unit_suppliers"
  ON public.supply_unit_suppliers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage supply_unit_suppliers"
  ON public.supply_unit_suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_supply_unit_suppliers_updated_at
  BEFORE UPDATE ON public.supply_unit_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();