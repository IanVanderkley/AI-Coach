-- LOCAL ONLY: run via docker exec -i ... psql -v ON_ERROR_STOP=1.
-- Test accounts and counters are rolled back, even if a test fails.
BEGIN;

DO $permissions$
DECLARE
  v_role text;
  v_privilege text;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH v_privilege IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] LOOP
      IF pg_catalog.has_table_privilege(v_role, 'public.ranked_api_rate_counters', v_privilege) THEN
        RAISE EXCEPTION '% unexpectedly has %', v_role, v_privilege;
      END IF;
    END LOOP;
    IF pg_catalog.has_function_privilege(v_role, 'public.reserve_ranked_api_request(uuid,text)', 'EXECUTE') THEN
      RAISE EXCEPTION '% can execute the reservation RPC', v_role;
    END IF;
  END LOOP;
  IF NOT pg_catalog.has_function_privilege('service_role', 'public.reserve_ranked_api_request(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role cannot execute the reservation RPC';
  END IF;
END;
$permissions$;

INSERT INTO auth.users (id) VALUES
  ('d728f655-c438-493c-b2cf-57ef5a6f0021'),
  ('d728f655-c438-493c-b2cf-57ef5a6f0022');
SET LOCAL ROLE service_role;

DO $checks$
DECLARE
  a uuid := 'd728f655-c438-493c-b2cf-57ef5a6f0021';
  b uuid := 'd728f655-c438-493c-b2cf-57ef5a6f0022';
  bucket timestamptz := pg_catalog.date_trunc('minute', pg_catalog.clock_timestamp());
  i integer;
BEGIN
  FOR i IN 1..30 LOOP
    IF public.reserve_ranked_api_request(a, 'start') IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Valid start request % was rejected', i;
    END IF;
  END LOOP;
  IF public.reserve_ranked_api_request(a, 'start') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Start limit exceeded or test crossed a minute boundary; retry test';
  END IF;
  IF public.reserve_ranked_api_request(b, 'start') IS DISTINCT FROM true
     OR public.reserve_ranked_api_request(a, 'move') IS DISTINCT FROM true
     OR public.reserve_ranked_api_request(a, 'read') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Account or scope isolation failed';
  END IF;
  IF public.reserve_ranked_api_request(a, 'invalid') IS DISTINCT FROM false
     OR public.reserve_ranked_api_request(NULL, 'start') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Invalid reservation admitted';
  END IF;
  UPDATE public.ranked_api_rate_counters SET usage_count = 600
    WHERE user_id = a AND scope = 'move';
  UPDATE public.ranked_api_rate_counters SET usage_count = 120
    WHERE user_id = a AND scope = 'read';
  IF public.reserve_ranked_api_request(a, 'move') IS DISTINCT FROM false
     OR public.reserve_ranked_api_request(a, 'read') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Move/read limit exceeded or test crossed a minute boundary; retry test';
  END IF;
  UPDATE public.ranked_api_rate_counters SET bucket_start = bucket - interval '2 minutes'
    WHERE user_id = a AND scope = 'start';
  IF public.reserve_ranked_api_request(a, 'start') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Expired window did not reset';
  END IF;
  IF (SELECT usage_count FROM public.ranked_api_rate_counters WHERE user_id = a AND scope = 'start') <> 1 THEN
    RAISE EXCEPTION 'Reset count incorrect';
  END IF;
  IF (SELECT count(*) FROM public.ranked_api_rate_counters WHERE user_id IN (a,b)) <> 4 THEN
    RAISE EXCEPTION 'Unexpected counter row growth';
  END IF;
END;
$checks$;
RESET ROLE;
DELETE FROM auth.users WHERE id IN ('d728f655-c438-493c-b2cf-57ef5a6f0021','d728f655-c438-493c-b2cf-57ef5a6f0022');
DO $cascade$
BEGIN
  IF EXISTS (SELECT 1 FROM public.ranked_api_rate_counters WHERE user_id IN ('d728f655-c438-493c-b2cf-57ef5a6f0021','d728f655-c438-493c-b2cf-57ef5a6f0022')) THEN
    RAISE EXCEPTION 'Account deletion did not cascade to counters';
  END IF;
END;
$cascade$;
ROLLBACK;
SELECT 'Ranked rate-limit SQL checks passed' AS result;
