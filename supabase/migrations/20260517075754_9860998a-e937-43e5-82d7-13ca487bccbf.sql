ALTER FUNCTION public.tg_refresh_search_for_material() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.tg_refresh_search_for_material_alias() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.build_material_search_bag(uuid) SECURITY DEFINER SET search_path = public;