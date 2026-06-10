-- 1. Strip per-material UOM and MOQ; these always derive from subcategory (then category).
UPDATE public.materials SET uom = NULL WHERE uom IS NOT NULL;
UPDATE public.materials SET default_moq = NULL WHERE default_moq IS NOT NULL;

-- 2. Trigger to keep them NULL going forward.
CREATE OR REPLACE FUNCTION public.materials_strip_inherited_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.uom := NULL;
  NEW.default_moq := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_materials_strip_inherited ON public.materials;
CREATE TRIGGER trg_materials_strip_inherited
  BEFORE INSERT OR UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.materials_strip_inherited_fields();

-- 3. Heal stale `specs.size_cm` when it disagrees with the code's trailing segment.
--    The code is authoritative (e.g. MAT.BB.01.110.30 -> size 30).
UPDATE public.materials
SET specs = jsonb_set(
  COALESCE(specs, '{}'::jsonb),
  '{size_cm}',
  to_jsonb((regexp_match(code, '^MAT\.[A-Z]{2}\.\d{2}\.\d+\.(\d+)$'))[1]::int)
)
WHERE code ~ '^MAT\.[A-Z]{2}\.\d{2}\.\d+\.\d+$'
  AND (specs->>'size_cm') IS DISTINCT FROM (regexp_match(code, '^MAT\.[A-Z]{2}\.\d{2}\.\d+\.(\d+)$'))[1];