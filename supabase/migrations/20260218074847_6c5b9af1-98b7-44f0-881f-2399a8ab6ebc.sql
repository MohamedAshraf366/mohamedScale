
-- Delivery rates: price to deliver a supplier material to a specific zone
-- Price is for the MOQ (inherited from supplier_material → material → category)
CREATE TABLE public.delivery_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_account_id uuid NOT NULL REFERENCES public.suppliers(account_id) ON DELETE CASCADE,
  supplier_material_id uuid NOT NULL REFERENCES public.supplier_materials(id) ON DELETE CASCADE,
  zone_id uuid NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  price_per_moq numeric NOT NULL CHECK (price_per_moq >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  -- Each supplier material can only have one delivery rate per zone
  CONSTRAINT ux_delivery_rate_material_zone UNIQUE (supplier_material_id, zone_id)
);

-- Enable RLS
ALTER TABLE public.delivery_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view delivery_rates"
  ON public.delivery_rates FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage delivery_rates"
  ON public.delivery_rates FOR ALL USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE TRIGGER update_delivery_rates_updated_at
  BEFORE UPDATE ON public.delivery_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for quick lookups by supplier
CREATE INDEX idx_delivery_rates_supplier ON public.delivery_rates(supplier_account_id);
CREATE INDEX idx_delivery_rates_zone ON public.delivery_rates(zone_id);
