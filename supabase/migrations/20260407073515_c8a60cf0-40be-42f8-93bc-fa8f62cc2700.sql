
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_example boolean NOT NULL DEFAULT false;
ALTER TABLE public.unlock_cycles ADD COLUMN IF NOT EXISTS is_example boolean NOT NULL DEFAULT false;
ALTER TABLE public.supply_units ADD COLUMN IF NOT EXISTS is_example boolean NOT NULL DEFAULT false;
ALTER TABLE public.supplier_quotes ADD COLUMN IF NOT EXISTS is_example boolean NOT NULL DEFAULT false;
ALTER TABLE public.supplier_materials ADD COLUMN IF NOT EXISTS is_example boolean NOT NULL DEFAULT false;
ALTER TABLE public.supply_unit_suppliers ADD COLUMN IF NOT EXISTS is_example boolean NOT NULL DEFAULT false;
ALTER TABLE public.delivery_rates ADD COLUMN IF NOT EXISTS is_example boolean NOT NULL DEFAULT false;
ALTER TABLE public.target_prices ADD COLUMN IF NOT EXISTS is_example boolean NOT NULL DEFAULT false;
ALTER TABLE public.unlock_cycle_materials ADD COLUMN IF NOT EXISTS is_example boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_accounts_is_example ON public.accounts (is_example) WHERE is_example = true;
CREATE INDEX IF NOT EXISTS idx_unlock_cycles_is_example ON public.unlock_cycles (is_example) WHERE is_example = true;
CREATE INDEX IF NOT EXISTS idx_supply_units_is_example ON public.supply_units (is_example) WHERE is_example = true;
CREATE INDEX IF NOT EXISTS idx_supplier_quotes_is_example ON public.supplier_quotes (is_example) WHERE is_example = true;
CREATE INDEX IF NOT EXISTS idx_supplier_materials_is_example ON public.supplier_materials (is_example) WHERE is_example = true;
CREATE INDEX IF NOT EXISTS idx_supply_unit_suppliers_is_example ON public.supply_unit_suppliers (is_example) WHERE is_example = true;
CREATE INDEX IF NOT EXISTS idx_delivery_rates_is_example ON public.delivery_rates (is_example) WHERE is_example = true;
CREATE INDEX IF NOT EXISTS idx_target_prices_is_example ON public.target_prices (is_example) WHERE is_example = true;
CREATE INDEX IF NOT EXISTS idx_unlock_cycle_materials_is_example ON public.unlock_cycle_materials (is_example) WHERE is_example = true;
