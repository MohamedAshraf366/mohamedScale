
-- =====================================================================
-- PHASE 0 (retry): Shared backend foundation
-- =====================================================================

-- 1. Alias tables ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.category_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.material_categories(id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('en','ar')),
  alias text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS category_aliases_unique
  ON public.category_aliases (category_id, locale, lower(alias));

CREATE TABLE IF NOT EXISTS public.subcategory_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcategory_id uuid NOT NULL REFERENCES public.material_subcategories(id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('en','ar')),
  alias text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS subcategory_aliases_unique
  ON public.subcategory_aliases (subcategory_id, locale, lower(alias));

CREATE TABLE IF NOT EXISTS public.spec_option_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcategory_id uuid NOT NULL REFERENCES public.material_subcategories(id) ON DELETE CASCADE,
  spec_key text NOT NULL,
  option_value text NOT NULL,
  locale text NOT NULL CHECK (locale IN ('en','ar')),
  alias text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS spec_option_aliases_unique
  ON public.spec_option_aliases (subcategory_id, spec_key, option_value, locale, lower(alias));

ALTER TABLE public.material_aliases ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS material_aliases_unique
  ON public.material_aliases (material_id, locale, lower(alias));

ALTER TABLE public.category_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategory_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spec_option_aliases ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['category_aliases','subcategory_aliases','spec_option_aliases','material_aliases'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_modify" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_select" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "%s_modify" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;

-- 2. Display name --------------------------------------------------
CREATE OR REPLACE FUNCTION public.material_display_name(p_material_id uuid, p_locale text DEFAULT 'en')
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  m record; s record;
  spec_def jsonb; v_key text; v_val text; opt jsonb;
  parts text[] := ARRAY[]::text[];
  subcat_name text;
BEGIN
  SELECT * INTO m FROM public.materials WHERE id = p_material_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO s FROM public.material_subcategories WHERE id = m.subcategory_id;
  IF NOT FOUND THEN RETURN m.name; END IF;

  subcat_name := CASE WHEN p_locale = 'ar' AND s.name_ar IS NOT NULL AND s.name_ar <> '' THEN s.name_ar ELSE s.name_en END;
  parts := parts || subcat_name;

  IF s.spec_definitions IS NOT NULL THEN
    FOR spec_def IN SELECT * FROM jsonb_array_elements(s.spec_definitions) LOOP
      v_key := spec_def->>'key';
      v_val := m.specs->>v_key;
      IF v_val IS NOT NULL THEN
        FOR opt IN SELECT * FROM jsonb_array_elements(spec_def->'options') LOOP
          IF (opt->>'value') = v_val THEN
            parts := parts || COALESCE(
              CASE WHEN p_locale = 'ar' THEN opt->>'label_ar' ELSE NULL END,
              opt->>'label_en', v_val);
            EXIT;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  IF s.variant_definitions IS NOT NULL AND s.variant_definitions ? 'key' THEN
    v_val := m.specs->>(s.variant_definitions->>'key');
    IF v_val IS NOT NULL THEN parts := parts || v_val; END IF;
  END IF;

  RETURN array_to_string(parts, ' · ');
END; $$;

-- 3. Spec-change guard --------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_spec_change_allowed(
  p_subcategory_id uuid, p_removed_spec_keys text[], p_removed_options jsonb
) RETURNS integer LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE blocking_count int := 0; k text; vals jsonb; v text;
BEGIN
  IF p_removed_spec_keys IS NOT NULL THEN
    FOREACH k IN ARRAY p_removed_spec_keys LOOP
      SELECT count(*) INTO blocking_count FROM public.materials
        WHERE subcategory_id = p_subcategory_id AND status = 'active' AND specs ? k;
      IF blocking_count > 0 THEN
        RAISE EXCEPTION 'MS001: % active materials depend on removed spec "%"', blocking_count, k USING ERRCODE = 'P0001';
      END IF;
    END LOOP;
  END IF;
  IF p_removed_options IS NOT NULL THEN
    FOR k, vals IN SELECT key, value FROM jsonb_each(p_removed_options) LOOP
      FOR v IN SELECT jsonb_array_elements_text(vals) LOOP
        SELECT count(*) INTO blocking_count FROM public.materials
          WHERE subcategory_id = p_subcategory_id AND status = 'active' AND specs->>k = v;
        IF blocking_count > 0 THEN
          RAISE EXCEPTION 'MS001: % active materials use removed option "%"="%"', blocking_count, k, v USING ERRCODE = 'P0001';
        END IF;
      END LOOP;
    END LOOP;
  END IF;
  RETURN 0;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_guard_subcategory_spec_changes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  old_keys text[] := ARRAY[]::text[]; new_keys text[] := ARRAY[]::text[];
  removed_keys text[]; spec jsonb; k text;
  old_opts jsonb; new_opts jsonb; removed_opts jsonb := '{}'::jsonb;
  v text; missing text[];
BEGIN
  IF NEW.spec_definitions IS NULL OR OLD.spec_definitions IS NULL THEN RETURN NEW; END IF;
  FOR spec IN SELECT * FROM jsonb_array_elements(OLD.spec_definitions) LOOP old_keys := old_keys || (spec->>'key'); END LOOP;
  FOR spec IN SELECT * FROM jsonb_array_elements(NEW.spec_definitions) LOOP new_keys := new_keys || (spec->>'key'); END LOOP;
  SELECT ARRAY(SELECT unnest(old_keys) EXCEPT SELECT unnest(new_keys)) INTO removed_keys;

  FOREACH k IN ARRAY new_keys LOOP
    SELECT spec->'options' INTO old_opts FROM jsonb_array_elements(OLD.spec_definitions) spec WHERE spec->>'key' = k;
    SELECT spec->'options' INTO new_opts FROM jsonb_array_elements(NEW.spec_definitions) spec WHERE spec->>'key' = k;
    IF old_opts IS NOT NULL AND new_opts IS NOT NULL THEN
      missing := ARRAY[]::text[];
      FOR v IN SELECT jsonb_array_elements(old_opts)->>'value' LOOP
        IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(new_opts) o WHERE o->>'value' = v) THEN missing := missing || v; END IF;
      END LOOP;
      IF array_length(missing,1) > 0 THEN removed_opts := removed_opts || jsonb_build_object(k, to_jsonb(missing)); END IF;
    END IF;
  END LOOP;

  IF (removed_keys IS NOT NULL AND array_length(removed_keys,1) > 0) OR removed_opts <> '{}'::jsonb THEN
    PERFORM public.assert_spec_change_allowed(NEW.id, removed_keys, removed_opts);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS guard_subcategory_spec_changes ON public.material_subcategories;
CREATE TRIGGER guard_subcategory_spec_changes
  BEFORE UPDATE OF spec_definitions ON public.material_subcategories
  FOR EACH ROW EXECUTE FUNCTION public.tg_guard_subcategory_spec_changes();

-- 4. Search index --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.material_search_index (
  material_id uuid PRIMARY KEY REFERENCES public.materials(id) ON DELETE CASCADE,
  subcategory_id uuid,
  category_id uuid,
  code text,
  display_en text,
  display_ar text,
  bag text NOT NULL DEFAULT '',
  tsv tsvector,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS material_search_index_tsv ON public.material_search_index USING GIN (tsv);
CREATE INDEX IF NOT EXISTS material_search_index_subcat ON public.material_search_index (subcategory_id);
ALTER TABLE public.material_search_index ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS material_search_index_select ON public.material_search_index;
CREATE POLICY material_search_index_select ON public.material_search_index FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.build_material_search_bag(p_material_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  m record; s record; c record;
  spec_def jsonb; v_key text; v_val text; opt jsonb;
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

    IF s.spec_definitions IS NOT NULL THEN
      FOR spec_def IN SELECT * FROM jsonb_array_elements(s.spec_definitions) LOOP
        v_key := spec_def->>'key';
        v_val := m.specs->>v_key;
        IF v_val IS NOT NULL THEN
          bag_parts := bag_parts || v_val;
          FOR opt IN SELECT * FROM jsonb_array_elements(spec_def->'options') LOOP
            IF (opt->>'value') = v_val THEN
              bag_parts := bag_parts || COALESCE(opt->>'label_en','');
              bag_parts := bag_parts || COALESCE(opt->>'label_ar','');
            END IF;
          END LOOP;
          bag_parts := bag_parts || COALESCE(
            (SELECT string_agg(soa.alias, ' ') FROM public.spec_option_aliases soa
             WHERE soa.subcategory_id = s.id AND soa.spec_key = v_key AND soa.option_value = v_val), '');
        END IF;
      END LOOP;
    END IF;
  END IF;

  IF s.variant_definitions IS NOT NULL AND s.variant_definitions ? 'key' THEN
    v_val := m.specs->>(s.variant_definitions->>'key');
    IF v_val IS NOT NULL THEN bag_parts := bag_parts || v_val; END IF;
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
END; $$;

CREATE OR REPLACE FUNCTION public.tg_refresh_search_for_material()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.material_search_index WHERE material_id = OLD.id;
    RETURN OLD;
  END IF;
  PERFORM public.build_material_search_bag(NEW.id);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_refresh_search_for_subcategory()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.materials WHERE subcategory_id = COALESCE(NEW.id, OLD.id) LOOP
    PERFORM public.build_material_search_bag(r.id);
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE OR REPLACE FUNCTION public.tg_refresh_search_for_category()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT m.id FROM public.materials m
    JOIN public.material_subcategories s ON s.id = m.subcategory_id
    WHERE s.category_id = COALESCE(NEW.id, OLD.id) LOOP
    PERFORM public.build_material_search_bag(r.id);
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE OR REPLACE FUNCTION public.tg_refresh_search_for_material_alias()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM public.build_material_search_bag(COALESCE(NEW.material_id, OLD.material_id));
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE OR REPLACE FUNCTION public.tg_refresh_search_for_subcategory_alias()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.materials WHERE subcategory_id = COALESCE(NEW.subcategory_id, OLD.subcategory_id) LOOP
    PERFORM public.build_material_search_bag(r.id);
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE OR REPLACE FUNCTION public.tg_refresh_search_for_category_alias()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT m.id FROM public.materials m
    JOIN public.material_subcategories s ON s.id = m.subcategory_id
    WHERE s.category_id = COALESCE(NEW.category_id, OLD.category_id) LOOP
    PERFORM public.build_material_search_bag(r.id);
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS refresh_search_materials ON public.materials;
CREATE TRIGGER refresh_search_materials AFTER INSERT OR UPDATE OR DELETE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.tg_refresh_search_for_material();

DROP TRIGGER IF EXISTS refresh_search_subcategories ON public.material_subcategories;
CREATE TRIGGER refresh_search_subcategories AFTER UPDATE ON public.material_subcategories
  FOR EACH ROW EXECUTE FUNCTION public.tg_refresh_search_for_subcategory();

DROP TRIGGER IF EXISTS refresh_search_categories ON public.material_categories;
CREATE TRIGGER refresh_search_categories AFTER UPDATE ON public.material_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_refresh_search_for_category();

DROP TRIGGER IF EXISTS refresh_search_material_aliases ON public.material_aliases;
CREATE TRIGGER refresh_search_material_aliases AFTER INSERT OR UPDATE OR DELETE ON public.material_aliases
  FOR EACH ROW EXECUTE FUNCTION public.tg_refresh_search_for_material_alias();

DROP TRIGGER IF EXISTS refresh_search_subcategory_aliases ON public.subcategory_aliases;
CREATE TRIGGER refresh_search_subcategory_aliases AFTER INSERT OR UPDATE OR DELETE ON public.subcategory_aliases
  FOR EACH ROW EXECUTE FUNCTION public.tg_refresh_search_for_subcategory_alias();

DROP TRIGGER IF EXISTS refresh_search_spec_option_aliases ON public.spec_option_aliases;
CREATE TRIGGER refresh_search_spec_option_aliases AFTER INSERT OR UPDATE OR DELETE ON public.spec_option_aliases
  FOR EACH ROW EXECUTE FUNCTION public.tg_refresh_search_for_subcategory_alias();

DROP TRIGGER IF EXISTS refresh_search_category_aliases ON public.category_aliases;
CREATE TRIGGER refresh_search_category_aliases AFTER INSERT OR UPDATE OR DELETE ON public.category_aliases
  FOR EACH ROW EXECUTE FUNCTION public.tg_refresh_search_for_category_alias();

DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.materials LOOP
    PERFORM public.build_material_search_bag(r.id);
  END LOOP;
END $$;

-- 5. Security fixes -----------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can manage opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Authenticated users can view opportunities" ON public.opportunities;
CREATE POLICY "Authenticated users can manage opportunities"
  ON public.opportunities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view opportunities"
  ON public.opportunities FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage delivery_rates" ON public.delivery_rates;
DROP POLICY IF EXISTS "Authenticated users can view delivery_rates" ON public.delivery_rates;
CREATE POLICY "Authenticated users can manage delivery_rates"
  ON public.delivery_rates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view delivery_rates"
  ON public.delivery_rates FOR SELECT TO authenticated USING (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='subcategory_areas') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can manage subcategory_areas" ON public.subcategory_areas';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view subcategory_areas" ON public.subcategory_areas';
    EXECUTE 'CREATE POLICY "Authenticated users can manage subcategory_areas" ON public.subcategory_areas FOR ALL TO authenticated USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Authenticated users can view subcategory_areas" ON public.subcategory_areas FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='waba_accounts') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can update waba_accounts" ON public.waba_accounts';
    EXECUTE $p$CREATE POLICY "Admins and management can update waba_accounts"
      ON public.waba_accounts FOR UPDATE TO authenticated
      USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'management'::app_role))
      WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'management'::app_role))$p$;
  END IF;
END $$;

DROP POLICY IF EXISTS "Authenticated users can view contacts" ON public.contacts;
CREATE POLICY "Restricted view of contacts"
  ON public.contacts FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'management'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.account_id = contacts.account_id
        AND (c.assigned_to = auth.uid() OR c.created_by = auth.uid())
    )
    OR contacts.created_by = auth.uid()
  );
