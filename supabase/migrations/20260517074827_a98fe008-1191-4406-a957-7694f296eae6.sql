
-- 1. Rewrite build_material_search_bag to no longer reference the dropped m.specs column.
CREATE OR REPLACE FUNCTION public.build_material_search_bag(p_material_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  m record; s record; c record;
  bag_parts text[] := ARRAY[]::text[];
  full_bag text; d_en text; d_ar text;
BEGIN
  SELECT * INTO m FROM public.materials WHERE id = p_material_id;
  IF NOT FOUND THEN
    DELETE FROM public.material_search_index WHERE material_id = p_material_id;
    RETURN;
  END IF;

  SELECT * INTO s FROM public.material_subcategories WHERE id = m.subcategory_id;
  IF FOUND THEN
    SELECT * INTO c FROM public.material_categories WHERE id = s.category_id;
    bag_parts := bag_parts || s.name_en;
    IF s.name_ar IS NOT NULL THEN bag_parts := bag_parts || s.name_ar; END IF;
    IF FOUND THEN
      bag_parts := bag_parts || c.name_en;
      IF c.name_ar IS NOT NULL THEN bag_parts := bag_parts || c.name_ar; END IF;
      bag_parts := bag_parts || COALESCE((SELECT string_agg(alias, ' ') FROM public.category_aliases WHERE category_id = c.id), '');
    END IF;
    bag_parts := bag_parts || COALESCE((SELECT string_agg(alias, ' ') FROM public.subcategory_aliases WHERE subcategory_id = s.id), '');
  END IF;

  bag_parts := bag_parts || COALESCE(m.code,'') || COALESCE(m.name,'') || COALESCE(m.name_en,'') || COALESCE(m.name_ar,'');
  bag_parts := bag_parts || COALESCE((SELECT string_agg(alias, ' ') FROM public.material_aliases WHERE material_id = m.id), '');

  d_en := public.material_display_name(m.id, 'en');
  d_ar := public.material_display_name(m.id, 'ar');
  bag_parts := bag_parts || COALESCE(d_en,'') || COALESCE(d_ar,'');

  full_bag := array_to_string(bag_parts, ' ');

  INSERT INTO public.material_search_index (material_id, subcategory_id, category_id, code, display_en, display_ar, bag, tsv, updated_at)
  VALUES (m.id, m.subcategory_id,
          (SELECT category_id FROM public.material_subcategories WHERE id = m.subcategory_id),
          m.code, d_en, d_ar, full_bag, to_tsvector('simple', full_bag), now())
  ON CONFLICT (material_id) DO UPDATE SET
    subcategory_id = EXCLUDED.subcategory_id,
    category_id    = EXCLUDED.category_id,
    code           = EXCLUDED.code,
    display_en     = EXCLUDED.display_en,
    display_ar     = EXCLUDED.display_ar,
    bag            = EXCLUDED.bag,
    tsv            = EXCLUDED.tsv,
    updated_at     = now();
END; $function$;

-- 2. target_prices.is_locked
ALTER TABLE public.target_prices
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- 3. Material deletability helper
CREATE OR REPLACE FUNCTION public.can_delete_material(p_material_id uuid)
RETURNS TABLE(can boolean, reasons text[])
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r text[] := ARRAY[]::text[];
  n int;
BEGIN
  SELECT count(*) INTO n FROM public.supplier_materials WHERE material_id = p_material_id;
  IF n > 0 THEN r := r || format('Used in %s supplier price entries', n); END IF;

  SELECT count(*) INTO n FROM public.quotation_items WHERE material_id = p_material_id;
  IF n > 0 THEN r := r || format('Referenced by %s quotation line(s)', n); END IF;

  SELECT count(*) INTO n FROM public.order_items WHERE material_id = p_material_id;
  IF n > 0 THEN r := r || format('Referenced by %s order line(s)', n); END IF;

  SELECT count(*) INTO n FROM public.target_prices WHERE material_id = p_material_id;
  IF n > 0 THEN r := r || format('Has %s target price(s)', n); END IF;

  SELECT count(*) INTO n FROM public.supply_domain_directives WHERE material_id = p_material_id;
  IF n > 0 THEN r := r || format('Referenced by %s supplier directive(s)', n); END IF;

  RETURN QUERY SELECT (array_length(r,1) IS NULL), r;
END; $function$;

GRANT EXECUTE ON FUNCTION public.can_delete_material(uuid) TO authenticated;
