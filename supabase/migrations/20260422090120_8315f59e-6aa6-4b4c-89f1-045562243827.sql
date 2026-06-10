
-- ========== Per-User Sandbox System ==========

-- 1. Add sandbox preference to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS sandbox_enabled boolean NOT NULL DEFAULT false;

-- 2. Sessions table
CREATE TABLE IF NOT EXISTS public.user_sandbox_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'open', -- 'open' | 'reverted' | 'promoted'
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uss_user ON public.user_sandbox_sessions(user_id, status);

ALTER TABLE public.user_sandbox_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own sandbox sessions" ON public.user_sandbox_sessions;
CREATE POLICY "Users view own sandbox sessions"
ON public.user_sandbox_sessions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users insert own sandbox sessions" ON public.user_sandbox_sessions;
CREATE POLICY "Users insert own sandbox sessions"
ON public.user_sandbox_sessions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own sandbox sessions" ON public.user_sandbox_sessions;
CREATE POLICY "Users update own sandbox sessions"
ON public.user_sandbox_sessions FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Journal table
CREATE TABLE IF NOT EXISTS public.sandbox_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.user_sandbox_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  table_name text NOT NULL,
  row_pk uuid NOT NULL,
  op text NOT NULL CHECK (op IN ('insert','update','delete')),
  before jsonb,
  after jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sj_session ON public.sandbox_journal(session_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_sj_user ON public.sandbox_journal(user_id);

ALTER TABLE public.sandbox_journal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own journal" ON public.sandbox_journal;
CREATE POLICY "Users view own journal"
ON public.sandbox_journal FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Trigger function — captures changes when session var is set
CREATE OR REPLACE FUNCTION public.record_sandbox_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_user_id uuid;
  v_row_pk uuid;
  v_before jsonb;
  v_after jsonb;
BEGIN
  -- Only journal when sandbox session var is set
  BEGIN
    v_session_id := nullif(current_setting('app.sandbox_session_id', true), '')::uuid;
  EXCEPTION WHEN others THEN
    v_session_id := NULL;
  END;

  IF v_session_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Resolve user (prefer auth.uid, fall back to session-owner lookup)
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    SELECT user_id INTO v_user_id FROM public.user_sandbox_sessions WHERE id = v_session_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_row_pk := (to_jsonb(NEW)->>'id')::uuid;
    v_after := to_jsonb(NEW);
    v_before := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_row_pk := (to_jsonb(NEW)->>'id')::uuid;
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_row_pk := (to_jsonb(OLD)->>'id')::uuid;
    v_before := to_jsonb(OLD);
    v_after := NULL;
  END IF;

  IF v_row_pk IS NOT NULL THEN
    INSERT INTO public.sandbox_journal(session_id, user_id, table_name, row_pk, op, before, after)
    VALUES (v_session_id, v_user_id, TG_TABLE_NAME, v_row_pk, lower(TG_OP), v_before, v_after);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 5. Attach triggers to in-scope tables
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'suppliers','accounts','contacts','locations',
    'supplier_quotes','supplier_materials',
    'supplier_quote_delivery_lines','supplier_quote_delivery_allocations',
    'delivery_rates','quotations','quotation_items',
    'opportunities','projects','communications','tasks','attachments'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_sandbox_journal ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_sandbox_journal AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.record_sandbox_change()',
        t
      );
    END IF;
  END LOOP;
END $$;

-- 6. RPCs

-- Set the session var for this connection
CREATE OR REPLACE FUNCTION public.set_sandbox_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_session_id IS NULL THEN
    PERFORM set_config('app.sandbox_session_id', '', false);
    RETURN;
  END IF;

  -- Only allow the session owner (or admin) to activate it
  IF NOT EXISTS (
    SELECT 1 FROM public.user_sandbox_sessions
    WHERE id = p_session_id
      AND status = 'open'
      AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  ) THEN
    RAISE EXCEPTION 'Sandbox session not found or not owned by current user';
  END IF;

  PERFORM set_config('app.sandbox_session_id', p_session_id::text, false);
END;
$$;

-- Open a new sandbox session
CREATE OR REPLACE FUNCTION public.open_sandbox_session(p_label text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  INSERT INTO public.user_sandbox_sessions(user_id, label)
  VALUES (auth.uid(), p_label)
  RETURNING id INTO v_id;
  PERFORM set_config('app.sandbox_session_id', v_id::text, false);
  RETURN v_id;
END;
$$;

-- Promote (keep) a session
CREATE OR REPLACE FUNCTION public.sandbox_promote(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_sandbox_sessions
    WHERE id = p_session_id
      AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  ) THEN
    RAISE EXCEPTION 'Sandbox session not found';
  END IF;

  UPDATE public.user_sandbox_sessions
  SET status = 'promoted', ended_at = now()
  WHERE id = p_session_id AND status = 'open';

  -- Discard journal for this session (changes become permanent)
  DELETE FROM public.sandbox_journal WHERE session_id = p_session_id;

  PERFORM set_config('app.sandbox_session_id', '', false);
END;
$$;

-- Revert (rollback) a session
CREATE OR REPLACE FUNCTION public.sandbox_revert(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_count_revert integer := 0;
  v_count_skip integer := 0;
  v_skipped jsonb := '[]'::jsonb;
  v_sql text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_sandbox_sessions
    WHERE id = p_session_id
      AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  ) THEN
    RAISE EXCEPTION 'Sandbox session not found';
  END IF;

  -- Make sure subsequent writes (the rollback itself) don't get journaled
  PERFORM set_config('app.sandbox_session_id', '', false);

  -- Process in reverse order
  FOR r IN
    SELECT * FROM public.sandbox_journal
    WHERE session_id = p_session_id
    ORDER BY occurred_at DESC, id DESC
  LOOP
    BEGIN
      IF r.op = 'insert' THEN
        v_sql := format('DELETE FROM public.%I WHERE id = $1', r.table_name);
        EXECUTE v_sql USING r.row_pk;
        v_count_revert := v_count_revert + 1;
      ELSIF r.op = 'update' THEN
        -- Restore the "before" snapshot
        v_sql := format(
          'UPDATE public.%I SET (%s) = (SELECT %s FROM jsonb_populate_record(NULL::public.%I, $1)) WHERE id = $2',
          r.table_name,
          (SELECT string_agg(quote_ident(key), ', ') FROM jsonb_object_keys(r.before) AS key WHERE key <> 'id'),
          (SELECT string_agg(quote_ident(key), ', ') FROM jsonb_object_keys(r.before) AS key WHERE key <> 'id'),
          r.table_name
        );
        EXECUTE v_sql USING r.before, r.row_pk;
        v_count_revert := v_count_revert + 1;
      ELSIF r.op = 'delete' THEN
        v_sql := format(
          'INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)',
          r.table_name, r.table_name
        );
        EXECUTE v_sql USING r.before;
        v_count_revert := v_count_revert + 1;
      END IF;
    EXCEPTION WHEN others THEN
      v_count_skip := v_count_skip + 1;
      v_skipped := v_skipped || jsonb_build_object(
        'table', r.table_name, 'row_pk', r.row_pk, 'op', r.op, 'error', SQLERRM
      );
    END;
  END LOOP;

  UPDATE public.user_sandbox_sessions
  SET status = 'reverted', ended_at = now()
  WHERE id = p_session_id;

  -- Keep the audit trail; just mark it
  RETURN jsonb_build_object(
    'reverted', v_count_revert,
    'skipped', v_count_skip,
    'skipped_details', v_skipped
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_sandbox_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_sandbox_session(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sandbox_promote(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sandbox_revert(uuid) TO authenticated;
