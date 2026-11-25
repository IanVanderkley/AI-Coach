-- LOCAL ONLY: fixture users, matches, counters and rewards are rolled back.
BEGIN;
DO $permissions$
DECLARE sig text := 'public.execute_ranked_move(uuid,uuid,text,integer,integer,integer)';
BEGIN
  IF has_function_privilege('anon', sig, 'EXECUTE') OR
     has_function_privilege('authenticated', sig, 'EXECUTE') OR
     NOT has_function_privilege('service_role', sig, 'EXECUTE') THEN
    RAISE EXCEPTION 'Combined RPC permission boundary failed';
  END IF;
END;
$permissions$;
INSERT INTO auth.users(id) VALUES
  ('ee728f65-c438-493c-b2cf-57ef5a6f0071'),
  ('ee728f65-c438-493c-b2cf-57ef5a6f0072');
SET LOCAL ROLE service_role;
DO $checks$
DECLARE
  a uuid := 'ee728f65-c438-493c-b2cf-57ef5a6f0071';
  b uuid := 'ee728f65-c438-493c-b2cf-57ef5a6f0072';
  m uuid;
  mine integer;
  r jsonb;
  before_count integer;
  before_bucket timestamptz;
  after_count integer;
  after_bucket timestamptz;
BEGIN
  m := public.start_ranked_match(a);
  r := public.execute_ranked_move(b,m,'reveal',8,8,0);
  IF r IS DISTINCT FROM '{"status":"conflict"}'::jsonb THEN RAISE EXCEPTION 'Foreign owner was not rejected'; END IF;
  IF (SELECT usage_count FROM public.ranked_api_rate_counters WHERE user_id=b AND scope='move') IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Rejected foreign request did not consume quota';
  END IF;
  r := public.execute_ranked_move(a,m,'reveal',8,8,0);
  IF r->>'status' IS DISTINCT FROM 'ok' OR (r->'result'->>'moveCount')::integer IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'First reveal failed';
  END IF;
  IF r->'result' ? 'minePositions' THEN RAISE EXCEPTION 'Hidden board leaked'; END IF;
  SELECT mine_positions[1] INTO mine FROM public.ranked_match_state WHERE match_id=m;
  r := public.execute_ranked_move(a,m,'flag',mine/16,mine%16,1);
  IF r->>'status' IS DISTINCT FROM 'ok' OR (r->'result'->>'flagged')::boolean IS DISTINCT FROM true
     OR (r->'result'->>'moveCount')::integer IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'Flag failed'; END IF;

  SELECT usage_count,bucket_start INTO before_count,before_bucket FROM public.ranked_api_rate_counters WHERE user_id=a AND scope='move';
  r := public.execute_ranked_move(a,m,'flag',mine/16,mine%16,1);
  IF r IS DISTINCT FROM '{"status":"conflict"}'::jsonb THEN RAISE EXCEPTION 'Stale flag accepted'; END IF;
  SELECT usage_count,bucket_start INTO after_count,after_bucket FROM public.ranked_api_rate_counters WHERE user_id=a AND scope='move';
  IF after_count IS DISTINCT FROM (CASE WHEN after_bucket=before_bucket THEN before_count+1 ELSE 1 END) THEN
    RAISE EXCEPTION 'Stale flag failed to consume quota';
  END IF;
  r := public.execute_ranked_move(a,m,'chord',8,8,1);
  IF r IS DISTINCT FROM '{"status":"conflict"}'::jsonb THEN RAISE EXCEPTION 'Stale chord accepted'; END IF;
  r := public.execute_ranked_move(a,m,'invalid',8,8,2);
  IF r IS DISTINCT FROM '{"status":"rejected"}'::jsonb THEN RAISE EXCEPTION 'Unknown action accepted'; END IF;
  r := public.execute_ranked_move(a,m,'reveal',-1,8,2);
  IF r IS DISTINCT FROM '{"status":"rejected"}'::jsonb THEN RAISE EXCEPTION 'Invalid coordinate accepted'; END IF;
  r := public.get_ranked_visible_board(m,a);
  IF (r->>'moveCount')::integer IS DISTINCT FROM 2 OR (r->>'flagCount')::integer IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Rejected actions changed board';
  END IF;

  -- Set a saturated current bucket; retry only the test if the minute rolls over.
  UPDATE public.ranked_api_rate_counters SET usage_count=600,
    bucket_start=pg_catalog.date_trunc('minute',pg_catalog.clock_timestamp())
    WHERE user_id=a AND scope='move';
  r := public.execute_ranked_move(a,m,'flag',mine/16,mine%16,2);
  IF r IS DISTINCT FROM '{"status":"rate_limited"}'::jsonb THEN RAISE EXCEPTION 'Quota exhaustion failed (rerun if minute rolled over)'; END IF;
  r := public.get_ranked_visible_board(m,a);
  IF (r->>'moveCount')::integer IS DISTINCT FROM 2 OR (r->>'flagCount')::integer IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Rate-limited action changed board';
  END IF;
  -- Reset only the disposable fixture counter so we can finish the game.
  UPDATE public.ranked_api_rate_counters SET usage_count=1 WHERE user_id=a AND scope='move';
  r := public.execute_ranked_move(a,m,'flag',mine/16,mine%16,2);
  IF r->>'status' IS DISTINCT FROM 'ok' OR (r->'result'->>'flagged')::boolean IS DISTINCT FROM false
     OR (r->'result'->>'moveCount')::integer IS DISTINCT FROM 3 THEN RAISE EXCEPTION 'Unflag failed'; END IF;
  UPDATE public.ranked_matches SET started_at=clock_timestamp()-interval '1 second' WHERE id=m;
  r := public.execute_ranked_move(a,m,'reveal',mine/16,mine%16,3);
  IF r->>'status' IS DISTINCT FROM 'ok' OR r->'result'->>'status' IS DISTINCT FROM 'lost'
     OR (r->'result'->>'moveCount')::integer IS DISTINCT FROM 4 THEN RAISE EXCEPTION 'Terminal reveal failed'; END IF;
  r := public.execute_ranked_move(a,m,'reveal',mine/16,mine%16,3);
  IF r IS DISTINCT FROM '{"status":"conflict"}'::jsonb THEN RAISE EXCEPTION 'Terminal replay accepted'; END IF;
  IF (SELECT count(*) FROM public.ranked_match_moves WHERE match_id=m) <> 4 THEN RAISE EXCEPTION 'Unexpected move count'; END IF;
END;
$checks$;
RESET ROLE;
DO $rewards$
DECLARE a uuid := 'ee728f65-c438-493c-b2cf-57ef5a6f0071';
BEGIN
  IF (SELECT count(*) FROM public.ranked_elo_events WHERE user_id=a AND outcome='lost') <> 1 THEN RAISE EXCEPTION 'Expected one Elo loss'; END IF;
  IF (SELECT count(*) FROM public.player_xp_match_receipts WHERE user_id=a AND outcome='lost' AND amount=17) <> 1 THEN RAISE EXCEPTION 'Expected one 17 XP loss receipt'; END IF;
  IF (SELECT total_xp FROM public.player_xp_profiles WHERE user_id=a) IS DISTINCT FROM 17::bigint THEN RAISE EXCEPTION 'Wrong XP balance'; END IF;
END;
$rewards$;
ROLLBACK;
SELECT 'Ranked combined move SQL checks passed' AS result;
