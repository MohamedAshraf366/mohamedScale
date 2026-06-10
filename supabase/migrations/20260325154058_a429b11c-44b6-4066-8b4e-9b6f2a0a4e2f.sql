
-- Trigger function: block supplier_materials INSERT if no target_price exists for that material
CREATE OR REPLACE FUNCTION public.check_target_price_exists()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.target_prices WHERE material_id = NEW.material_id
  ) THEN
    RAISE EXCEPTION 'No target price set for material %. A target price must be created before adding supplier quotes.', NEW.material_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to supplier_materials
DROP TRIGGER IF EXISTS trg_check_target_price ON public.supplier_materials;
CREATE TRIGGER trg_check_target_price
  BEFORE INSERT ON public.supplier_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.check_target_price_exists();
