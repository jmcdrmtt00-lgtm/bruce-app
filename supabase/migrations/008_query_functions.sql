-- Migration 008: Safe SQL execution functions for Query screens
-- Called by Next.js API routes after AI generates the SELECT query.
-- Only SELECT allowed; auth/system schemas blocked.

CREATE OR REPLACE FUNCTION execute_select_query(query_sql text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  clean  text := trim(query_sql);
BEGIN
  -- Must be a SELECT
  IF upper(clean) NOT LIKE 'SELECT%' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  -- Block access to system/auth schemas
  IF clean ~* '(auth\.|storage\.|pg_|information_schema)' THEN
    RAISE EXCEPTION 'Query references a restricted schema';
  END IF;

  EXECUTE 'SELECT json_agg(row_to_json(t)) FROM (' || clean || ') t'
    INTO result;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Allow authenticated users to call it
GRANT EXECUTE ON FUNCTION execute_select_query(text) TO authenticated;
