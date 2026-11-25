-- Distributed, per-account admission control for Ranked HTTP endpoints.
-- One row per account and scope; no unbounded minute-bucket history.
BEGIN;

CREATE TABLE public.ranked_api_rate_counters (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('start', 'move', 'read')),
  bucket_start timestamptz NOT NULL,
  usage_count integer NOT NULL CHECK (usage_count BETWEEN 1 AND 600),
  PRIMARY KEY (user_id, scope)
);
ALTER TABLE public.ranked_api_rate_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ranked_api_rate_counters FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ranked_api_rate_counters TO service_role;

CREATE FUNCTION public.reserve_ranked_api_request(p_user_id uuid, p_scope text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_bucket timestamptz := pg_catalog.date_trunc('minute', pg_catalog.clock_timestamp());
  v_limit integer;
  v_admitted boolean := false;
BEGIN
  v_limit := CASE p_scope
    WHEN 'start' THEN 30
    WHEN 'move' THEN 600
    WHEN 'read' THEN 120
    ELSE NULL
  END;
  IF p_user_id IS NULL OR v_limit IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.ranked_api_rate_counters AS c (user_id, scope, bucket_start, usage_count)
  VALUES (p_user_id, p_scope, v_bucket, 1)
  ON CONFLICT (user_id, scope) DO UPDATE
    SET bucket_start = EXCLUDED.bucket_start,
        usage_count = CASE WHEN c.bucket_start < EXCLUDED.bucket_start THEN 1
                           ELSE c.usage_count + 1 END
    WHERE c.bucket_start < EXCLUDED.bucket_start
       OR (c.bucket_start = EXCLUDED.bucket_start AND c.usage_count < v_limit)
  RETURNING true INTO v_admitted;

  RETURN coalesce(v_admitted, false);
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_ranked_api_request(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reserve_ranked_api_request(uuid, text) TO service_role;
COMMIT;
