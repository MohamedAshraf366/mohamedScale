-- Phase 1.6: Append variant unit to computed material names
-- "— 10" becomes "— 10 cm" by deriving the unit from
--   1) variant_definitions.label_en parens — e.g. "Size (cm)" → "cm"
--   2) variant key suffix — e.g. "size_cm" → "cm"
-- Parent (group) materials (no variant value in specs) keep showing
-- only "<Subcategory>: <specs>" — no unit, no variant — as required.

CREATE OR REPLACE FUNCTION public._extract_variant_unit(p_label text, p_key text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  m text;
BEGIN
  IF p_label IS NOT NULL THEN
    m := substring(p_label FROM '\(([^)]+)\)');
    IF m IS NOT NULL AND length(trim(m)) > 0 THEN
      RETURN trim(m);
    END IF;
  END IF;
  IF p_key IS NOT NULL AND position('_' IN p_key) > 0 THEN
    m := split_part(p_key, '_', array_length(string_to_array(p_key, '_'), 1));
    IF m IS NOT NULL AND length(m) > 0 AND m <> p_key THEN
      RETURN m;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_compute_material_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  s record;
  spec_def jsonb; v_key text; v_val text; opt jsonb;
  spec_labels_en text[] := ARRAY[]::text[];
  spec_labels_ar text[] := ARRAY[]::text[];
  variant_key text;
  variant_label_en text;
  variant_unit text;
  variant_value text := NULL;
  variant_text_en text := NULL;
  variant_text_ar text := NULL;
  head_en text; head_ar text;
  subcat_name_en text; subcat_name_ar text;
BEGIN
  IF NEW.subcategory_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO s FROM public.material_subcategories WHERE id = NEW.subcategory_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  subcat_name_en := s.name_en;
  subcat_name_ar := COALESCE(NULLIF(s.name_ar, ''), s.name_en);
  variant_key := s.variant_definitions->>'key';
  variant_label_en := s.variant_definitions->>'label_en';
  variant_unit := public._extract_variant_unit(variant_label_en, variant_key);

  IF s.spec_definitions IS NOT NULL THEN
    FOR spec_def IN SELECT * FROM jsonb_array_elements(s.spec_definitions) LOOP
      v_key := spec_def->>'key';
      IF variant_key IS NOT NULL AND v_key = variant_key THEN
        CONTINUE;
      END IF;
      v_val := NEW.specs->>v_key;
      IF v_val IS NULL THEN CONTINUE; END IF;

      DECLARE matched boolean := false; lbl_en text; lbl_ar text;
      BEGIN
        FOR opt IN SELECT * FROM jsonb_array_elements(spec_def->'options') LOOP
          IF (opt->>'value') = v_val THEN
            lbl_en := COALESCE(NULLIF(opt->>'label_en',''), v_val);
            lbl_ar := COALESCE(NULLIF(opt->>'label_ar',''), lbl_en);
            spec_labels_en := spec_labels_en || lbl_en;
            spec_labels_ar := spec_labels_ar || lbl_ar;
            matched := true;
            EXIT;
          END IF;
        END LOOP;
        IF NOT matched THEN
          spec_labels_en := spec_labels_en || v_val;
          spec_labels_ar := spec_labels_ar || v_val;
        END IF;
      END;
    END LOOP;
  END IF;

  IF variant_key IS NOT NULL THEN
    variant_value := NULLIF(NEW.specs->>variant_key, '');
  END IF;

  IF variant_value IS NOT NULL THEN
    IF variant_unit IS NOT NULL THEN
      variant_text_en := variant_value || ' ' || variant_unit;
      variant_text_ar := variant_value || ' ' || variant_unit;
    ELSE
      variant_text_en := variant_value;
      variant_text_ar := variant_value;
    END IF;
  END IF;

  head_en := subcat_name_en;
  IF array_length(spec_labels_en, 1) > 0 THEN
    head_en := head_en || ': ' || array_to_string(spec_labels_en, ', ');
  END IF;
  IF variant_text_en IS NOT NULL THEN
    head_en := head_en || ' — ' || variant_text_en;
  END IF;

  head_ar := subcat_name_ar;
  IF array_length(spec_labels_ar, 1) > 0 THEN
    head_ar := head_ar || ': ' || array_to_string(spec_labels_ar, ', ');
  END IF;
  IF variant_text_ar IS NOT NULL THEN
    head_ar := head_ar || ' — ' || variant_text_ar;
  END IF;

  NEW.name    := head_en;
  NEW.name_en := head_en;
  NEW.name_ar := head_ar;

  RETURN NEW;
END;
$$;

-- Also update the display function used by views/queries
CREATE OR REPLACE FUNCTION public.material_display_name(p_material_id uuid, p_locale text DEFAULT 'en'::text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  m record; s record;
  spec_def jsonb; v_key text; v_val text; opt jsonb;
  spec_labels text[] := ARRAY[]::text[];
  subcat_name text;
  variant_key text;
  variant_label_en text;
  variant_unit text;
  variant_value text := NULL;
  variant_text text := NULL;
  head text;
BEGIN
  SELECT * INTO m FROM public.materials WHERE id = p_material_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO s FROM public.material_subcategories WHERE id = m.subcategory_id;
  IF NOT FOUND THEN RETURN COALESCE(m.name, ''); END IF;

  subcat_name := CASE
    WHEN p_locale = 'ar' AND s.name_ar IS NOT NULL AND s.name_ar <> '' THEN s.name_ar
    ELSE s.name_en
  END;

  variant_key := s.variant_definitions->>'key';
  variant_label_en := s.variant_definitions->>'label_en';
  variant_unit := public._extract_variant_unit(variant_label_en, variant_key);

  IF s.spec_definitions IS NOT NULL THEN
    FOR spec_def IN SELECT * FROM jsonb_array_elements(s.spec_definitions) LOOP
      v_key := spec_def->>'key';
      IF variant_key IS NOT NULL AND v_key = variant_key THEN
        CONTINUE;
      END IF;
      v_val := m.specs->>v_key;
      IF v_val IS NULL THEN CONTINUE; END IF;

      DECLARE matched boolean := false;
      BEGIN
        FOR opt IN SELECT * FROM jsonb_array_elements(spec_def->'options') LOOP
          IF (opt->>'value') = v_val THEN
            spec_labels := spec_labels || COALESCE(
              CASE WHEN p_locale = 'ar' THEN NULLIF(opt->>'label_ar','') ELSE NULL END,
              NULLIF(opt->>'label_en',''),
              v_val
            );
            matched := true;
            EXIT;
          END IF;
        END LOOP;
        IF NOT matched THEN
          spec_labels := spec_labels || v_val;
        END IF;
      END;
    END LOOP;
  END IF;

  IF variant_key IS NOT NULL THEN
    variant_value := NULLIF(m.specs->>variant_key, '');
  END IF;

  IF variant_value IS NOT NULL THEN
    variant_text := CASE WHEN variant_unit IS NOT NULL
      THEN variant_value || ' ' || variant_unit
      ELSE variant_value END;
  END IF;

  head := subcat_name;
  IF array_length(spec_labels, 1) > 0 THEN
    head := head || ': ' || array_to_string(spec_labels, ', ');
  END IF;
  IF variant_text IS NOT NULL THEN
    RETURN head || ' — ' || variant_text;
  END IF;
  RETURN head;
END;
$function$;

-- Backfill: recompute all names with the new unit-aware formatter
UPDATE public.materials SET specs = specs;