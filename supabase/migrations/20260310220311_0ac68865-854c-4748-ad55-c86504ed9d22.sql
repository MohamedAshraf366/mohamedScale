
CREATE OR REPLACE FUNCTION public.execute_readonly_sql(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '10s'
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Only allow SELECT or WITH (CTE) queries (use \m \M for POSIX word boundaries)
  IF query !~* '^\s*(SELECT|WITH)\M' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  -- Block any write keywords
  IF query ~* '\m(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXECUTE)\M' THEN
    RAISE EXCEPTION 'Write operations are not allowed';
  END IF;

  EXECUTE format('SELECT COALESCE(jsonb_agg(row_to_json(q)), ''[]''::jsonb) FROM (%s) q', query) INTO result;
  RETURN result;
END;
$$;
