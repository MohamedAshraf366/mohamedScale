
-- Function: revert a single activity_log entry (admin-only)
CREATE OR REPLACE FUNCTION public.revert_activity_entry(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.activity_log;
  v_table text;
  v_id uuid;
  v_cols text;
  v_sql text;
  v_result jsonb;
BEGIN
  -- Admin gate
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can revert activity entries';
  END IF;

  SELECT * INTO v_entry FROM public.activity_log WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activity entry % not found', p_id;
  END IF;

  v_table := v_entry.entity_type;
  v_id := v_entry.entity_id;

  -- Safety: only allow tables in public schema
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = v_table
  ) THEN
    RAISE EXCEPTION 'Table public.% does not exist', v_table;
  END IF;

  IF v_entry.action = 'insert' THEN
    -- Undo by deleting the row (if it still exists)
    EXECUTE format('DELETE FROM public.%I WHERE id = $1', v_table) USING v_id;
    v_result := jsonb_build_object('reverted', true, 'kind', 'delete_inserted');

  ELSIF v_entry.action = 'delete' THEN
    -- Re-insert from old_data snapshot
    IF v_entry.old_data IS NULL THEN
      RAISE EXCEPTION 'No snapshot available to restore deleted row';
    END IF;
    SELECT string_agg(quote_ident(key), ', ')
      INTO v_cols
      FROM jsonb_object_keys(v_entry.old_data) AS key;
    v_sql := format(
      'INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1) ON CONFLICT (id) DO NOTHING',
      v_table, v_table
    );
    EXECUTE v_sql USING v_entry.old_data;
    v_result := jsonb_build_object('reverted', true, 'kind', 'reinsert_deleted');

  ELSIF v_entry.action = 'update' THEN
    -- Restore previous values from old_data
    IF v_entry.old_data IS NULL THEN
      RAISE EXCEPTION 'No snapshot available to restore previous values';
    END IF;
    -- Use jsonb_populate_record to reconstruct the row, then UPDATE all columns
    v_sql := format($f$
      UPDATE public.%I AS t
      SET (%s) = (
        SELECT %s FROM jsonb_populate_record(NULL::public.%I, $1) AS r
      )
      WHERE t.id = $2
    $f$,
      v_table,
      (SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = v_table),
      (SELECT string_agg('r.' || quote_ident(column_name), ', ' ORDER BY ordinal_position)
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = v_table),
      v_table
    );
    EXECUTE v_sql USING v_entry.old_data, v_id;
    v_result := jsonb_build_object('reverted', true, 'kind', 'restore_update');

  ELSE
    RAISE EXCEPTION 'Unknown action: %', v_entry.action;
  END IF;

  -- The revert itself produces its own activity_log entry via triggers,
  -- which is exactly what we want: the audit trail stays complete.
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revert_activity_entry(uuid) TO authenticated;
