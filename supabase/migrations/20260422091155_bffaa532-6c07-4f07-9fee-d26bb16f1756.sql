CREATE OR REPLACE FUNCTION public._attach_activity_trigger(p_table text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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