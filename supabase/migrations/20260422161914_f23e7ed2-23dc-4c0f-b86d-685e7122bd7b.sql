CREATE OR REPLACE FUNCTION public.set_request_id(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set as a session-level GUC; record_activity() reads it via _current_request_id().
  PERFORM set_config('app.request_id', COALESCE(_request_id::text, ''), false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_request_id(uuid) TO authenticated, service_role;