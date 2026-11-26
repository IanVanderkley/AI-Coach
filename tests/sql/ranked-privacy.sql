-- LOCAL ONLY. Disposable accounts and verified result, all rolled back.
BEGIN;
SET LOCAL statement_timeout = '60s';
DO $fixture$
DECLARE
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  m uuid;
  square integer;
  revision integer;
  r jsonb;
  name_a text;
  name_b text;
BEGIN
  INSERT INTO auth.users(id,email_confirmed_at) VALUES (a,now()),(b,now());
  SELECT username INTO STRICT name_a FROM public.ranked_leaderboard_profiles WHERE user_id=a;
  SELECT username INTO STRICT name_b FROM public.ranked_leaderboard_profiles WHERE user_id=b;
  IF EXISTS (SELECT 1 FROM public.ranked_leaderboard_profiles WHERE user_id IN (a,b) AND is_anonymous) THEN
    RAISE EXCEPTION 'New profile not public by default';
  END IF;
  PERFORM set_config('ranked_test.owner',a::text,true);
  PERFORM set_config('ranked_test.other',b::text,true);
  PERFORM set_config('ranked_test.owner_name',name_a,true);
  PERFORM set_config('ranked_test.other_name',name_b,true);
  -- Real verified win with database-owned board used only as a local fixture oracle.
  m := public.start_ranked_match(a);
  UPDATE public.ranked_matches SET started_at=clock_timestamp()-interval '1 second' WHERE id=m;
  r := public.execute_ranked_move(a,m,'reveal',8,8,0);
  IF r->>'status' IS DISTINCT FROM 'ok' THEN RAISE EXCEPTION 'Fixture opening failed'; END IF;
  FOR square IN 0..255 LOOP
    EXIT WHEN (SELECT status FROM public.ranked_matches WHERE id=m)='won';
    IF EXISTS(SELECT 1 FROM public.ranked_match_state WHERE match_id=m AND (square=ANY(mine_positions) OR square=ANY(revealed_positions))) THEN CONTINUE; END IF;
    SELECT move_count INTO STRICT revision FROM public.ranked_matches WHERE id=m;
    r := public.execute_ranked_move(a,m,'reveal',square/16,square%16,revision);
    IF r->>'status' IS DISTINCT FROM 'ok' THEN RAISE EXCEPTION 'Fixture reveal failed'; END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM public.ranked_verified_results WHERE match_id=m AND user_id=a)
     OR NOT EXISTS(SELECT 1 FROM public.ranked_elo_events WHERE match_id=m AND user_id=a AND policy_version=3 AND rating_after=1648) THEN
    RAISE EXCEPTION 'Fixture missing verified win or v3 receipt';
  END IF;
  RAISE NOTICE 'PASS: default public profiles and real verified v3 win';
END;
$fixture$;
SET LOCAL ROLE service_role;
DO $visible$
DECLARE a text := current_setting('ranked_test.owner_name'); b text := current_setting('ranked_test.other_name');
BEGIN
  IF (SELECT count(*) FROM public.ranked_public_elo WHERE username=a AND rating=1648 AND games=1 AND wins=1 AND losses=0) <> 1
     OR (SELECT count(*) FROM public.ranked_public_fastest WHERE username=a AND duration_ms>0) <> 1 THEN
    RAISE EXCEPTION 'Eligible public player missing from board';
  END IF;
  IF EXISTS(SELECT 1 FROM public.ranked_public_elo WHERE username=b) OR EXISTS(SELECT 1 FROM public.ranked_public_fastest WHERE username=b) THEN
    RAISE EXCEPTION 'Player without eligible games shown';
  END IF;
  RAISE NOTICE 'PASS: eligible public win appears on both boards; unplayed account excluded';
END;
$visible$;
UPDATE public.ranked_leaderboard_profiles SET is_anonymous=true WHERE user_id=current_setting('ranked_test.owner')::uuid;
DO $hidden$
DECLARE a text := current_setting('ranked_test.owner_name');
BEGIN
  IF EXISTS(SELECT 1 FROM public.ranked_public_elo WHERE username=a) OR EXISTS(SELECT 1 FROM public.ranked_public_fastest WHERE username=a) THEN
    RAISE EXCEPTION 'Anonymous player leaked through public views';
  END IF;
  RAISE NOTICE 'PASS: Anonymous mode removes player from both boards';
END;
$hidden$;
UPDATE public.ranked_leaderboard_profiles SET is_anonymous=false WHERE user_id=current_setting('ranked_test.owner')::uuid;
DO $restored$
DECLARE a text := current_setting('ranked_test.owner_name');
BEGIN
  IF (SELECT count(*) FROM public.ranked_public_elo WHERE username=a AND rating=1648 AND games=1) <> 1
     OR (SELECT count(*) FROM public.ranked_public_fastest WHERE username=a) <> 1 THEN
    RAISE EXCEPTION 'Restored visibility missing or rating changed';
  END IF;
  RAISE NOTICE 'PASS: restoring visibility preserves rating and verified result';
END;
$restored$;
RESET ROLE;
-- Exercise RLS as an actual authenticated database role with a fixture JWT subject.
DO $claims$
BEGIN
  PERFORM set_config('request.jwt.claim.sub',current_setting('ranked_test.owner'),true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('ranked_test.owner'),'role','authenticated')::text,true);
END;
$claims$;
SET LOCAL ROLE authenticated;
DO $rls$
DECLARE a uuid := current_setting('ranked_test.owner')::uuid; b uuid := current_setting('ranked_test.other')::uuid;
BEGIN
  IF auth.uid() IS DISTINCT FROM a THEN RAISE EXCEPTION 'Test JWT subject not recognized'; END IF;
  IF (SELECT count(*) FROM public.ranked_leaderboard_profiles WHERE user_id=a AND rating=1648) <> 1
     OR EXISTS(SELECT 1 FROM public.ranked_leaderboard_profiles WHERE user_id=b) THEN
    RAISE EXCEPTION 'Profile ownership RLS failed';
  END IF;
  IF has_table_privilege('authenticated','public.ranked_elo_events','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
     OR has_table_privilege('authenticated','public.ranked_public_elo','SELECT')
     OR has_table_privilege('authenticated','public.ranked_public_fastest','SELECT')
     OR has_table_privilege('anon','public.ranked_public_elo','SELECT')
     OR has_table_privilege('anon','public.ranked_public_fastest','SELECT') THEN
    RAISE EXCEPTION 'Direct browser access to private ledger or server-only views';
  END IF;
  RAISE NOTICE 'PASS: owner-only profile RLS and server-only ledger/views';
END;
$rls$;
RESET ROLE;
ROLLBACK;
SELECT 'Ranked leaderboard privacy checks passed' AS result;
