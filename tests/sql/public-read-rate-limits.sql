-- LOCAL ONLY: the transaction restores the original counters when it rolls back.
BEGIN;
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_function_privilege(r, 'public.reserve_public_read_request(text)', 'EXECUTE') OR
       has_table_privilege(r, 'public.public_read_rate_counters', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
      RAISE EXCEPTION 'Unexpected public counter privileges for %', r;
    END IF;
  END LOOP;
  IF NOT has_function_privilege('service_role', 'public.reserve_public_read_request(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Missing service role execution permission';
  END IF;
END $$;
DELETE FROM public.public_read_rate_counters;
SET LOCAL ROLE service_role;
DO $$
DECLARE bucket timestamptz;
BEGIN
  IF public.reserve_public_read_request(NULL) IS DISTINCT FROM false OR public.reserve_public_read_request('invalid') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Unknown scope admitted';
  END IF;
  IF public.reserve_public_read_request('leaderboard') IS DISTINCT FROM true OR public.reserve_public_read_request('verified_results') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'New scope rejected';
  END IF;
  -- Simulate a cap boundary without flooding HTTP or waiting a minute.
  bucket := date_trunc('minute', clock_timestamp());
  UPDATE public.public_read_rate_counters SET bucket_start = bucket, usage_count = 299 WHERE scope = 'leaderboard';
  UPDATE public.public_read_rate_counters SET bucket_start = bucket, usage_count = 119 WHERE scope = 'verified_results';
  IF public.reserve_public_read_request('leaderboard') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Final leaderboard slot rejected';
  END IF;
  IF public.reserve_public_read_request('leaderboard') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Leaderboard quota boundary failed (rerun if minute changed)';
  END IF;
  IF public.reserve_public_read_request('verified_results') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Independent verified results slot rejected';
  END IF;
  IF public.reserve_public_read_request('verified_results') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Verified results quota boundary failed (rerun if minute changed)';
  END IF;
  UPDATE public.public_read_rate_counters SET bucket_start = bucket - interval '1 minute' WHERE scope = 'leaderboard';
  IF public.reserve_public_read_request('leaderboard') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Expired bucket did not reset';
  END IF;
  IF (SELECT usage_count FROM public.public_read_rate_counters WHERE scope = 'leaderboard') <> 1 THEN
    RAISE EXCEPTION 'Reset counter is incorrect';
  END IF;
  IF (SELECT count(*) FROM public.public_read_rate_counters) <> 2 THEN
    RAISE EXCEPTION 'Counter storage not bounded';
  END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'Public read rate-limit SQL checks passed' AS result;
