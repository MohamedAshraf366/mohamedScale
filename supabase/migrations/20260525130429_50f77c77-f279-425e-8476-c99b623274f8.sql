-- Retire legacy resolve_effective_supplier. The unified resolver is now
-- resolve_supplier (selection model) → consumed by resolve_line_pricing.
DROP FUNCTION IF EXISTS public.resolve_effective_supplier(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.resolve_effective_supplier(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.resolve_effective_supplier(uuid, text, boolean) CASCADE;