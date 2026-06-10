
CREATE OR REPLACE FUNCTION public.build_material_search_bag(p_material_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  m record; s record; c record;
  bag_parts text[] := ARRAY[]::text[];
  full_bag text; d_en text; d_ar text;
  v_variant_key text;
  v_segments text[];
  v_digits_str text;
  v_size_seg text;
  v_digits text[];
  v_spec_def jsonb;
  v_opt jsonb;
  v_alias text;
  v_idx int;
  v_digit text;
  v_variant_def jsonb;
  v_variant_opts jsonb;
  v_vopt jsonb;
  v_matched boolean;
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
    IF c.id IS NOT NULL THEN
      bag_parts := bag_parts || c.name_en;
      IF c.name_ar IS NOT NULL THEN bag_parts := bag_parts || c.name_ar; END IF;
      bag_parts := bag_parts || COALESCE((SELECT string_agg(alias, ' ') FROM public.category_aliases WHERE category_id = c.id), '');
    END IF;
    bag_parts := bag_parts || COALESCE((SELECT string_agg(alias, ' ') FROM public.subcategory_aliases WHERE subcategory_id = s.id), '');

    -- Parse material code into segments: MAT.<CAT2>.<SUB2>.<digits>[.<size>]
    v_segments := string_to_array(COALESCE(m.code, ''), '.');
    v_variant_key := s.variant_definitions->>'key';
    v_digits_str  := NULL;
    v_size_seg    := NULL;
    IF v_segments IS NOT NULL AND array_length(v_segments, 1) >= 4 AND v_segments[1] = 'MAT' THEN
      v_digits_str := v_segments[4];
      IF array_length(v_segments, 1) >= 5 THEN
        v_size_seg := v_segments[5];
      END IF;
    END IF;

    -- Non-variant spec aliases: positional digit -> option.code_digit
    IF v_digits_str IS NOT NULL AND v_digits_str ~ '^\d+$' THEN
      v_digits := regexp_split_to_array(v_digits_str, '');
      v_idx := 0;
      FOR v_spec_def IN
        SELECT value FROM jsonb_array_elements(COALESCE(s.spec_definitions, '[]'::jsonb))
      LOOP
        IF v_variant_key IS NOT NULL AND (v_spec_def->>'key') = v_variant_key THEN
          CONTINUE; -- handled below via size segment
        END IF;
        v_idx := v_idx + 1;
        IF v_idx > COALESCE(array_length(v_digits, 1), 0) THEN EXIT; END IF;
        v_digit := v_digits[v_idx];
        FOR v_opt IN
          SELECT value FROM jsonb_array_elements(COALESCE(v_spec_def->'options', '[]'::jsonb))
        LOOP
          IF (v_opt->>'code_digit') = v_digit THEN
            IF jsonb_typeof(v_opt->'aliases') = 'array' THEN
              FOR v_alias IN SELECT value FROM jsonb_array_elements_text(v_opt->'aliases') LOOP
                IF v_alias IS NOT NULL AND length(trim(v_alias)) > 0 THEN
                  bag_parts := bag_parts || v_alias;
                END IF;
              END LOOP;
            END IF;
            EXIT;
          END IF;
        END LOOP;
      END LOOP;
    END IF;

    -- Variant/size aliases: match size segment against variant option
    IF v_size_seg IS NOT NULL AND length(v_size_seg) > 0 THEN
      v_variant_def := s.variant_definitions;
      -- Variant options may live on variant_definitions.options OR on a matching
      -- entry inside spec_definitions (keyed by variant key). Try spec_definitions first
      -- because that's where alias/code_digit metadata is edited.
      v_variant_opts := NULL;
      IF v_variant_key IS NOT NULL THEN
        FOR v_spec_def IN
          SELECT value FROM jsonb_array_elements(COALESCE(s.spec_definitions, '[]'::jsonb))
        LOOP
          IF (v_spec_def->>'key') = v_variant_key THEN
            v_variant_opts := v_spec_def->'options';
            EXIT;
          END IF;
        END LOOP;
      END IF;
      IF v_variant_opts IS NULL OR jsonb_typeof(v_variant_opts) <> 'array' THEN
        v_variant_opts := v_variant_def->'options';
      END IF;

      IF jsonb_typeof(v_variant_opts) = 'array' THEN
        v_matched := false;
        FOR v_vopt IN SELECT value FROM jsonb_array_elements(v_variant_opts) LOOP
          IF jsonb_typeof(v_vopt) = 'object' THEN
            IF (v_vopt->>'code_digit') = v_size_seg
               OR (v_vopt->>'value') = v_size_seg
               OR (v_vopt->>'code') = v_size_seg THEN
              IF jsonb_typeof(v_vopt->'aliases') = 'array' THEN
                FOR v_alias IN SELECT value FROM jsonb_array_elements_text(v_vopt->'aliases') LOOP
                  IF v_alias IS NOT NULL AND length(trim(v_alias)) > 0 THEN
                    bag_parts := bag_parts || v_alias;
                  END IF;
                END LOOP;
              END IF;
              v_matched := true;
              EXIT;
            END IF;
          ELSIF jsonb_typeof(v_vopt) = 'string' THEN
            -- Plain string options carry no aliases; nothing to append
            IF (v_vopt #>> '{}') = v_size_seg THEN
              v_matched := true;
              EXIT;
            END IF;
          END IF;
        END LOOP;
      END IF;
    END IF;
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

-- One-time backfill
SELECT public.build_material_search_bag(id) FROM public.materials;
