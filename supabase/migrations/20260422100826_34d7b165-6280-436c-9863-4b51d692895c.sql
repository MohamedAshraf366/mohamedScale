-- Phase 1b: enrich activity_log with request grouping + human summary

ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS request_id uuid,
  ADD COLUMN IF NOT EXISTS summary text;

CREATE INDEX IF NOT EXISTS idx_activity_log_request_id
  ON public.activity_log (request_id)
  WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_log_entity
  ON public.activity_log (entity_type, entity_id, created_at DESC);

-- Helper: pull request_id from a session GUC if the caller set one,
-- otherwise return NULL (each row stands alone, current behavior).
CREATE OR REPLACE FUNCTION public._current_request_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v text;
BEGIN
  BEGIN
    v := current_setting('app.request_id', true);
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  IF v IS NULL OR v = '' THEN
    RETURN NULL;
  END IF;
  RETURN v::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Helper: build a short human label for a row.
-- Tries common name-ish columns; falls back to the entity id.
CREATE OR REPLACE FUNCTION public._activity_row_label(_data jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    _data->>'display_name',
    _data->>'name',
    _data->>'name_en',
    _data->>'full_name',
    _data->>'title',
    _data->>'code',
    _data->>'subject',
    NULL
  );
$$;

-- Helper: list of changed top-level keys between two JSONB rows
-- (skips bookkeeping columns like updated_at / updated_by).
CREATE OR REPLACE FUNCTION public._activity_changed_keys(_old jsonb, _new jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(array_agg(k ORDER BY k), '{}')
  FROM (
    SELECT key AS k
    FROM jsonb_each(COALESCE(_new, '{}'::jsonb))
    WHERE key NOT IN ('updated_at','updated_by','created_at','created_by')
      AND (_old IS NULL OR _old->key IS DISTINCT FROM _new->key)
  ) s;
$$;

-- Replace record_activity() to populate request_id + summary.
-- Keeps the same name / signature / trigger wiring — no need to re-attach.
CREATE OR REPLACE FUNCTION public.record_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_action text;
  v_entity_id uuid;
  v_label text;
  v_changed text[];
  v_summary text;
  v_entity text := TG_TABLE_NAME;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_old := NULL;
    v_new := to_jsonb(NEW);
    v_action := 'insert';
    v_entity_id := (NEW).id;
    v_label := public._activity_row_label(v_new);
    v_summary := 'Created ' || v_entity || COALESCE(' "' || v_label || '"', '');
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_action := 'update';
    v_entity_id := (NEW).id;
    v_label := public._activity_row_label(v_new);
    v_changed := public._activity_changed_keys(v_old, v_new);
    IF array_length(v_changed, 1) IS NULL THEN
      -- nothing meaningful changed; skip log
      RETURN NEW;
    END IF;
    v_summary := 'Updated ' || v_entity
                 || COALESCE(' "' || v_label || '"', '')
                 || ' — ' || array_to_string(v_changed, ', ');
  ELSIF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_action := 'delete';
    v_entity_id := (OLD).id;
    v_label := public._activity_row_label(v_old);
    v_summary := 'Deleted ' || v_entity || COALESCE(' "' || v_label || '"', '');
  END IF;

  INSERT INTO public.activity_log
    (entity_type, entity_id, action, actor_id, old_data, new_data, request_id, summary)
  VALUES
    (v_entity, v_entity_id, v_action, auth.uid(), v_old, v_new,
     public._current_request_id(), v_summary);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
