-- =========================================================
-- Phase 1.5: Computed Material Names Everywhere (trigger-maintained)
-- =========================================================

-- 1) Rewrite material_display_name() to match the TS composeMaterialName format.
--    Format: "Subcategory: spec1, spec2 — variant"
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
  variant_label text := NULL;
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

  -- Collect spec labels (skip the variant axis; render it separately)
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

  -- Variant value
  IF variant_key IS NOT NULL THEN
    variant_label := NULLIF(m.specs->>variant_key, '');
  END IF;

  -- Compose: "Subcat: spec1, spec2 — variant"
  head := subcat_name;
  IF array_length(spec_labels, 1) > 0 THEN
    head := head || ': ' || array_to_string(spec_labels, ', ');
  END IF;
  IF variant_label IS NOT NULL THEN
    RETURN head || ' — ' || variant_label;
  END IF;
  RETURN head;
END;
$function$;

-- 2) BEFORE INSERT/UPDATE trigger on materials: auto-compute name/name_en/name_ar.
--    Inserts: function reads m FROM materials WHERE id = NEW.id (not yet visible),
--    so build inline using NEW values directly.
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
  variant_label text := NULL;
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
    variant_label := NULLIF(NEW.specs->>variant_key, '');
  END IF;

  head_en := subcat_name_en;
  IF array_length(spec_labels_en, 1) > 0 THEN
    head_en := head_en || ': ' || array_to_string(spec_labels_en, ', ');
  END IF;
  IF variant_label IS NOT NULL THEN
    head_en := head_en || ' — ' || variant_label;
  END IF;

  head_ar := subcat_name_ar;
  IF array_length(spec_labels_ar, 1) > 0 THEN
    head_ar := head_ar || ': ' || array_to_string(spec_labels_ar, ', ');
  END IF;
  IF variant_label IS NOT NULL THEN
    head_ar := head_ar || ' — ' || variant_label;
  END IF;

  NEW.name    := head_en;
  NEW.name_en := head_en;
  NEW.name_ar := head_ar;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_materials_compute_name ON public.materials;
CREATE TRIGGER tg_materials_compute_name
BEFORE INSERT OR UPDATE OF specs, subcategory_id, name, name_en, name_ar
ON public.materials
FOR EACH ROW
EXECUTE FUNCTION public.tg_compute_material_name();

-- 3) Cascade trigger on material_subcategories: when name/specs/variant change,
--    refresh all child materials' names.
CREATE OR REPLACE FUNCTION public.tg_cascade_subcategory_name_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF (NEW.name_en IS DISTINCT FROM OLD.name_en)
     OR (NEW.name_ar IS DISTINCT FROM OLD.name_ar)
     OR (NEW.spec_definitions IS DISTINCT FROM OLD.spec_definitions)
     OR (NEW.variant_definitions IS DISTINCT FROM OLD.variant_definitions)
  THEN
    -- Touch each child material so the BEFORE UPDATE trigger recomputes its name.
    UPDATE public.materials
       SET specs = specs
     WHERE subcategory_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_subcategories_cascade_names ON public.material_subcategories;
CREATE TRIGGER tg_subcategories_cascade_names
AFTER UPDATE ON public.material_subcategories
FOR EACH ROW
EXECUTE FUNCTION public.tg_cascade_subcategory_name_changes();

-- 4) One-time backfill: recompute every existing material's name.
UPDATE public.materials SET specs = specs;
