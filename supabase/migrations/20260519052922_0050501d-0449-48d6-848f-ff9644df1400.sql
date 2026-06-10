CREATE OR REPLACE FUNCTION public.tg_guard_subcategory_spec_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_keys text[] := ARRAY[]::text[]; new_keys text[] := ARRAY[]::text[];
  removed_keys text[]; spec jsonb; k text;
  old_opts jsonb; new_opts jsonb; removed_opts jsonb := '{}'::jsonb;
  v text; missing text[];
BEGIN
  IF NEW.spec_definitions IS NULL OR OLD.spec_definitions IS NULL THEN RETURN NEW; END IF;

  FOR spec IN SELECT * FROM jsonb_array_elements(OLD.spec_definitions) LOOP
    old_keys := old_keys || (spec->>'key');
  END LOOP;
  FOR spec IN SELECT * FROM jsonb_array_elements(NEW.spec_definitions) LOOP
    new_keys := new_keys || (spec->>'key');
  END LOOP;
  SELECT ARRAY(SELECT unnest(old_keys) EXCEPT SELECT unnest(new_keys)) INTO removed_keys;

  FOREACH k IN ARRAY new_keys LOOP
    SELECT s->'options' INTO old_opts
      FROM jsonb_array_elements(OLD.spec_definitions) AS s
      WHERE s->>'key' = k;
    SELECT s->'options' INTO new_opts
      FROM jsonb_array_elements(NEW.spec_definitions) AS s
      WHERE s->>'key' = k;
    IF old_opts IS NOT NULL AND new_opts IS NOT NULL THEN
      missing := ARRAY[]::text[];
      FOR v IN SELECT jsonb_array_elements(old_opts)->>'value' LOOP
        IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(new_opts) o WHERE o->>'value' = v) THEN
          missing := missing || v;
        END IF;
      END LOOP;
      IF array_length(missing,1) > 0 THEN
        removed_opts := removed_opts || jsonb_build_object(k, to_jsonb(missing));
      END IF;
    END IF;
  END LOOP;

  IF (removed_keys IS NOT NULL AND array_length(removed_keys,1) > 0) OR removed_opts <> '{}'::jsonb THEN
    PERFORM public.assert_spec_change_allowed(NEW.id, removed_keys, removed_opts);
  END IF;
  RETURN NEW;
END;
$$;