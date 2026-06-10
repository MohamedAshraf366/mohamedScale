CREATE OR REPLACE FUNCTION public.record_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    v_entity_id := COALESCE((v_new->>'id')::uuid, (v_new->>'account_id')::uuid);
    v_label := public._activity_row_label(v_new);
    v_summary := 'Created ' || v_entity || COALESCE(' "' || v_label || '"', '');
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_action := 'update';
    v_entity_id := COALESCE((v_new->>'id')::uuid, (v_new->>'account_id')::uuid);
    v_label := public._activity_row_label(v_new);
    v_changed := public._activity_changed_keys(v_old, v_new);
    IF array_length(v_changed, 1) IS NULL THEN
      RETURN NEW;
    END IF;
    v_summary := 'Updated ' || v_entity
                 || COALESCE(' "' || v_label || '"', '')
                 || ' — ' || array_to_string(v_changed, ', ');
  ELSIF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_action := 'delete';
    v_entity_id := COALESCE((v_old->>'id')::uuid, (v_old->>'account_id')::uuid);
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
$function$;