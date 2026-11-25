-- Aggregate admission limits for the two public leaderboard GET endpoints.
-- One counter per scope, independent of Ranked gameplay and Coaching.
BEGIN;
CREATE TABLE public.public_read_rate_counters (
  scope text PRIMARY KEY CHECK (scope IN ('leaderboard', 'verified_results')),
  bucket_start timestamptz NOT NULL,
  usage_count integer NOT NULL CHECK (usage_count BETWEEN 1 AND 300)
);
ALTER TABLE public.public_read_rate_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_read_rate_counters FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.public_read_rate_counters TO service_role;

CREATE FUNCTION public.reserve_public_read_request(p_scope text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_bucket timestamptz := pg_catalog.date_trunc('minute', pg_catalog.clock_timestamp());
  v_limit integer := CASE p_scope WHEN 'leaderboard' THEN 300 WHEN 'verified_results' THEN 120 ELSE NULL END;
  v_admitted boolean := false;
BEGIN
  IF v_limit IS NULL THEN RETURN false; END IF;
  INSERT INTO public.public_read_rate_counters AS c (scope, bucket_start, usage_count)
  VALUES (p_scope, v_bucket, 1)
  ON CONFLICT (scope) DO UPDATE
    SET bucket_start = EXCLUDED.bucket_start,
        usage_count = CASE WHEN c.bucket_start < EXCLUDED.bucket_start THEN 1 ELSE c.usage_count + 1 END
    WHERE c.bucket_start < EXCLUDED.bucket_start
       OR (c.bucket_start = EXCLUDED.bucket_start AND c.usage_count < v_limit)
  RETURNING true INTO v_admitted;
  RETURN coalesce(v_admitted, false);
END;
$function$;
REVOKE ALL ON FUNCTION public.reserve_public_read_request(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reserve_public_read_request(text) TO service_role;
COMMIT;
