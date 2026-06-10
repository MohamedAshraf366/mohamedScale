
-- ============================================================
-- Unlock New Materials: target_prices, unlock_cycles, unlock_cycle_materials
-- ============================================================

-- 1. target_prices
CREATE TABLE public.target_prices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id     uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  zone_codes      text[] NOT NULL DEFAULT '{}',
  zone_group_id   uuid REFERENCES public.zone_groups(id) ON DELETE SET NULL,
  target_price    numeric NOT NULL,
  currency        text NOT NULL DEFAULT 'SAR',
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_by      uuid
);

ALTER TABLE public.target_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view target_prices"
  ON public.target_prices FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin and management can manage target_prices"
  ON public.target_prices FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- 2. unlock_cycles
CREATE TABLE public.unlock_cycles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  description     text,
  status          text NOT NULL DEFAULT 'planning',
  start_date      date,
  end_date        date,
  zone_codes      text[] NOT NULL DEFAULT '{}',
  zone_group_ids  uuid[] NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_by      uuid
);

ALTER TABLE public.unlock_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view unlock_cycles"
  ON public.unlock_cycles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin and management can manage unlock_cycles"
  ON public.unlock_cycles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- 3. unlock_cycle_materials
CREATE TABLE public.unlock_cycle_materials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id        uuid NOT NULL REFERENCES public.unlock_cycles(id) ON DELETE CASCADE,
  material_id     uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'pending',
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, material_id)
);

ALTER TABLE public.unlock_cycle_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view unlock_cycle_materials"
  ON public.unlock_cycle_materials FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin and management can manage unlock_cycle_materials"
  ON public.unlock_cycle_materials FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- Indexes
CREATE INDEX idx_target_prices_material ON public.target_prices(material_id);
CREATE INDEX idx_target_prices_zone_codes ON public.target_prices USING GIN(zone_codes);
CREATE INDEX idx_unlock_cycle_materials_cycle ON public.unlock_cycle_materials(cycle_id);
CREATE INDEX idx_unlock_cycle_materials_material ON public.unlock_cycle_materials(material_id);
