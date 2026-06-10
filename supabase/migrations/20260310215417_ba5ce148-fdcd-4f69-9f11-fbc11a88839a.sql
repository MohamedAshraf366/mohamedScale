
-- Execute read-only SQL for agent (with write-keyword blocking + 10s timeout)
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
  -- Only allow SELECT or WITH (CTE) queries
  IF query !~* '^\s*(SELECT|WITH)\b' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  -- Block any write keywords
  IF query ~* '\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXECUTE)\b' THEN
    RAISE EXCEPTION 'Write operations are not allowed';
  END IF;

  EXECUTE format('SELECT COALESCE(jsonb_agg(row_to_json(q)), ''[]''::jsonb) FROM (%s) q', query) INTO result;
  RETURN result;
END;
$$;

-- Dynamic full schema discovery for agent
CREATE OR REPLACE FUNCTION public.get_full_schema()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'tables', (
      SELECT jsonb_object_agg(t.table_name, t.cols)
      FROM (
        SELECT c.table_name, jsonb_agg(
          jsonb_build_object(
            'column', c.column_name,
            'type', c.udt_name,
            'nullable', c.is_nullable = 'YES',
            'default', c.column_default
          ) ORDER BY c.ordinal_position
        ) AS cols
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
        GROUP BY c.table_name
      ) t
    ),
    'foreign_keys', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'from_table', kcu.table_name,
        'from_column', kcu.column_name,
        'to_table', ccu.table_name,
        'to_column', ccu.column_name,
        'constraint', tc.constraint_name
      )), '[]'::jsonb)
      FROM information_schema.key_column_usage kcu
      JOIN information_schema.constraint_column_usage ccu
        ON kcu.constraint_name = ccu.constraint_name
        AND kcu.constraint_schema = ccu.constraint_schema
      JOIN information_schema.table_constraints tc
        ON kcu.constraint_name = tc.constraint_name
        AND kcu.constraint_schema = tc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND kcu.table_schema = 'public'
    ),
    'enums', (
      SELECT COALESCE(jsonb_object_agg(t.typname, t.vals), '{}'::jsonb)
      FROM (
        SELECT t.typname, jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) AS vals
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public'
        GROUP BY t.typname
      ) t
    )
  );
$$;
