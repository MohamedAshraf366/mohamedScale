-- =========================================================================
-- Universal DB-level Activity Log
-- One trigger function attached to every business table.
-- Fires on INSERT/UPDATE/DELETE and writes a row into public.activity_log.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.record_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_action text;
BEGIN
  -- Resolve actor (may be null for service_role / triggers / cron)
  BEGIN
    v_actor := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    v_action := 'insert';
    v_new := to_jsonb(NEW);
    v_old := NULL;
    BEGIN v_entity_id := (v_new->>'id')::uuid; EXCEPTION WHEN OTHERS THEN v_entity_id := gen_random_uuid(); END;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_new := to_jsonb(NEW);
    v_old := to_jsonb(OLD);
    BEGIN v_entity_id := (v_new->>'id')::uuid; EXCEPTION WHEN OTHERS THEN v_entity_id := gen_random_uuid(); END;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_old := to_jsonb(OLD);
    v_new := NULL;
    BEGIN v_entity_id := (v_old->>'id')::uuid; EXCEPTION WHEN OTHERS THEN v_entity_id := gen_random_uuid(); END;
  END IF;

  INSERT INTO public.activity_log (entity_type, entity_id, action, actor_id, old_data, new_data)
  VALUES (TG_TABLE_NAME, v_entity_id, v_action, v_actor, v_old, v_new);

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Never let logging break the actual write
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Helper: attach the trigger to a table if it doesn't already exist
CREATE OR REPLACE FUNCTION public._attach_activity_trigger(p_table text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS trg_activity_log ON public.%I',
    p_table
  );
  EXECUTE format(
    'CREATE TRIGGER trg_activity_log
       AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.record_activity()',
    p_table
  );
END;
$$;

-- Attach to all business tables (skip audit/system tables, and tables without an id column)
DO $$
DECLARE
  r record;
  v_skip text[] := ARRAY[
    'activity_log',
    'sandbox_journal',
    'user_sandbox_sessions',
    'agent_logs',
    'agent_confirmations',
    'agent_sessions',
    'spatial_ref_sys',
    'whatsapp_webhook_events',
    'whatsapp_message_status_events',
    'geo_vertices',
    'geo_edges',
    'region_edges',
    'zone_edges'
  ];
BEGIN
  FOR r IN
    SELECT t.tablename
    FROM pg_tables t
    WHERE t.schemaname = 'public'
      AND NOT (t.tablename = ANY(v_skip))
      AND EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = t.tablename
          AND c.column_name = 'id'
      )
  LOOP
    PERFORM public._attach_activity_trigger(r.tablename);
  END LOOP;
END $$;

-- Index for browsing the log efficiently
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON public.activity_log (entity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor ON public.activity_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log (created_at DESC);
