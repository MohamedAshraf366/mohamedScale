-- Phase 2a: Margin resolver — single source of truth on the DB side.
-- Mirrors src/lib/quotation-commercial.ts → resolveMarginHierarchy.
CREATE OR REPLACE FUNCTION public.resolve_margin_pct(
  _material_id uuid,
  _item_override numeric DEFAULT NULL,
  _global_margin numeric DEFAULT 0
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  -- 1. Explicit per-line override wins.
  SELECT COALESCE(
    NULLIF(_item_override, 0),
    -- 2. Subcategory default for this material's subcategory.
    (
      SELECT NULLIF(smd.default_margin_pct, 0)
      FROM public.materials m
      JOIN public.subcategory_margin_defaults smd ON smd.subcategory_id = m.subcategory_id
      WHERE m.id = _material_id
      LIMIT 1
    ),
    -- 3. Global fallback (caller-supplied, e.g. quotation-level).
    _global_margin,
    0
  );
$$;

COMMENT ON FUNCTION public.resolve_margin_pct(uuid, numeric, numeric) IS
'Single source of truth for margin resolution. Priority: per-line override → subcategory default (subcategory_margin_defaults) → global fallback. Mirrors src/lib/quotation-commercial.ts.';

GRANT EXECUTE ON FUNCTION public.resolve_margin_pct(uuid, numeric, numeric) TO authenticated, service_role;