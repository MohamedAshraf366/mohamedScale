-- 1. Drop strip-inherited trigger so uom/default_moq are real override columns.
DROP TRIGGER IF EXISTS trg_materials_strip_inherited ON public.materials;
DROP FUNCTION IF EXISTS public.materials_strip_inherited_fields();

-- 2. Drop the old name-compute trigger (it has UPDATE OF specs in its definition).
DROP TRIGGER IF EXISTS tg_materials_compute_name ON public.materials;

-- 3. Rewrite the name-compute function to parse from the CODE (not specs JSON).
CREATE OR REPLACE FUNCTION public.tg_compute_material_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  s record;
  spec_def jsonb; opt jsonb;
  spec_labels_en text[] := ARRAY[]::text[];
  spec_labels_ar text[] := ARRAY[]::text[];
  variant_key text;
  variant_label_en text;
  variant_unit text;
  variant_text_en text := NULL;
  variant_text_ar text := NULL;
  head_en text; head_ar text;
  subcat_name_en text; subcat_name_ar text;
  m_variant text; m_digits text;
  digit_idx int := 1;
  digit_ch text;
  non_variant_defs jsonb := '[]'::jsonb;
BEGIN
  IF NEW.subcategory_id IS NULL OR NEW.code IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO s FROM public.material_subcategories WHERE id = NEW.subcategory_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  subcat_name_en := s.name_en;
  subcat_name_ar := COALESCE(NULLIF(s.name_ar, ''), s.name_en);
  variant_key := s.variant_definitions->>'key';
  variant_label_en := s.variant_definitions->>'label_en';
  variant_unit := public._extract_variant_unit(variant_label_en, variant_key);

  m_digits  := (regexp_match(NEW.code, '^MAT\.[A-Z]{2}\.\d{2}\.(\d+)(?:\.\d+)?$'))[1];
  m_variant := (regexp_match(NEW.code, '^MAT\.[A-Z]{2}\.\d{2}\.\d+\.(\d+)$'))[1];
  IF m_digits IS NULL THEN RETURN NEW; END IF;

  IF s.spec_definitions IS NOT NULL THEN
    FOR spec_def IN SELECT * FROM jsonb_array_elements(s.spec_definitions) LOOP
      IF variant_key IS NULL OR (spec_def->>'key') <> variant_key THEN
        non_variant_defs := non_variant_defs || jsonb_build_array(spec_def);
      END IF;
    END LOOP;
  END IF;

  FOR spec_def IN SELECT * FROM jsonb_array_elements(non_variant_defs) LOOP
    digit_ch := substring(m_digits FROM digit_idx FOR 1);
    digit_idx := digit_idx + 1;
    IF digit_ch IS NULL OR digit_ch = '' THEN EXIT; END IF;

    DECLARE matched boolean := false; lbl_en text; lbl_ar text;
    BEGIN
      FOR opt IN SELECT * FROM jsonb_array_elements(spec_def->'options') LOOP
        IF (opt->>'code_digit') = digit_ch THEN
          lbl_en := COALESCE(NULLIF(opt->>'label_en',''), digit_ch);
          lbl_ar := COALESCE(NULLIF(opt->>'label_ar',''), lbl_en);
          spec_labels_en := spec_labels_en || lbl_en;
          spec_labels_ar := spec_labels_ar || lbl_ar;
          matched := true;
          EXIT;
        END IF;
      END LOOP;
      IF NOT matched THEN
        spec_labels_en := spec_labels_en || digit_ch;
        spec_labels_ar := spec_labels_ar || digit_ch;
      END IF;
    END;
  END LOOP;

  IF m_variant IS NOT NULL THEN
    DECLARE val text := (m_variant::int)::text;
    BEGIN
      IF variant_unit IS NOT NULL THEN
        variant_text_en := val || ' ' || variant_unit;
        variant_text_ar := val || ' ' || variant_unit;
      ELSE
        variant_text_en := val;
        variant_text_ar := val;
      END IF;
    END;
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

-- 4. Recreate the trigger WITHOUT a column-list dependency on specs.
CREATE TRIGGER tg_materials_compute_name
  BEFORE INSERT OR UPDATE OF code, subcategory_id ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.tg_compute_material_name();

-- 5. Simplify display function — names are now always fresh in the row.
CREATE OR REPLACE FUNCTION public.material_display_name(p_material_id uuid, p_locale text DEFAULT 'en'::text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE m record;
BEGIN
  SELECT * INTO m FROM public.materials WHERE id = p_material_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF p_locale = 'ar' THEN RETURN m.name_ar; END IF;
  RETURN m.name_en;
END;
$$;

-- 6. Refresh all materials so names recompute from code.
UPDATE public.materials SET code = code WHERE code IS NOT NULL;

-- 7. Drop materials.specs — code is the single source of truth.
ALTER TABLE public.materials DROP COLUMN IF EXISTS specs;