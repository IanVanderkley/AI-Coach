-- LOCAL ONLY. Roll back all fixtures. Run as local postgres owner.
BEGIN;
SET LOCAL request.headers = '{"x-ai-coach-ranked-policy":"4"}';
DO $checks$
DECLARE
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  m uuid;
  old_match uuid;
  mine integer;
  square integer;
  revision integer;
  r jsonb;
  before_rating integer;
  after_rating integer;
  cases integer[][] := ARRAY[[1505,1500],[1500,1488],[5,-5],[-5,-15],[3301,3300],[3300,3275]];
  pair integer[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ranked_internal.release_maintenance WHERE singleton AND required_policy_version=4 AND NOT enabled) THEN RAISE EXCEPTION 'Expected enabled v4 writes (maintenance off)'; END IF;
  IF has_function_privilege('anon','ranked_internal.apply_verified_match_rating(uuid)','EXECUTE') OR has_function_privilege('authenticated','ranked_internal.apply_verified_match_rating(uuid)','EXECUTE') OR has_table_privilege('authenticated','public.ranked_elo_events','INSERT') OR has_table_privilege('authenticated','public.ranked_leaderboard_profiles','UPDATE') THEN RAISE EXCEPTION 'Unsafe rating permissions'; END IF;
  INSERT INTO auth.users(id,email_confirmed_at) VALUES(a,now()),(b,now());
  IF (SELECT rating FROM public.ranked_leaderboard_profiles WHERE user_id=a) IS DISTINCT FROM 1500 OR (SELECT rating FROM public.ranked_leaderboard_profiles WHERE user_id=b) IS DISTINCT FROM 1500 THEN RAISE EXCEPTION 'New accounts must start at 1500'; END IF;
  -- Preserve an old receipt: synthetic terminal match does not go through gameplay.
  INSERT INTO public.ranked_matches(user_id,status,started_at,finished_at,duration_ms) VALUES(a,'lost',now()-interval '1 second',now(),1000) RETURNING id INTO old_match;
  INSERT INTO public.ranked_elo_events(match_id,user_id,outcome,rating_before,rating_delta,rating_after,policy_version) VALUES(old_match,a,'lost',1000,-16,984,1);
  UPDATE public.ranked_leaderboard_profiles SET rating=984,games=1,wins=0,losses=1 WHERE user_id=a;
  PERFORM ranked_internal.apply_verified_match_rating(old_match);
  IF NOT EXISTS (SELECT 1 FROM public.ranked_elo_events WHERE match_id=old_match AND policy_version=1 AND rating_before=1000 AND rating_delta=-16 AND rating_after=984) OR (SELECT rating FROM public.ranked_leaderboard_profiles WHERE user_id=a) IS DISTINCT FROM 984 THEN RAISE EXCEPTION 'Historical award changed'; END IF;
  -- Old server headers may not start a match.
  PERFORM set_config('request.headers','{"x-ai-coach-ranked-policy":"3"}',true);
  BEGIN
    PERFORM public.start_ranked_match(a);
    RAISE EXCEPTION 'Old policy unexpectedly permitted';
  EXCEPTION WHEN SQLSTATE 'PT503' THEN NULL; END;
  PERFORM set_config('request.headers','{"x-ai-coach-ranked-policy":"4"}',true);
  FOREACH pair SLICE 1 IN ARRAY cases LOOP
    before_rating := pair[1]; after_rating := pair[2];
    UPDATE public.ranked_leaderboard_profiles SET rating=before_rating WHERE user_id=a;
    m := public.start_ranked_match(a);
    PERFORM ranked_internal.apply_verified_match_rating(m);
    IF EXISTS(SELECT 1 FROM public.ranked_elo_events WHERE match_id=m) THEN RAISE EXCEPTION 'Active match paid'; END IF;
    r := public.execute_ranked_move(a,m,'reveal',8,8,0);
    IF r->>'status' IS DISTINCT FROM 'ok' THEN RAISE EXCEPTION 'Opening failed'; END IF;
    SELECT mine_positions[1] INTO STRICT mine FROM public.ranked_match_state WHERE match_id=m;
    UPDATE public.ranked_matches SET started_at=clock_timestamp()-interval '1 second' WHERE id=m;
    r := public.execute_ranked_move(a,m,'reveal',mine/16,mine%16,1);
    IF r->'result'->>'status' IS DISTINCT FROM 'lost' THEN RAISE EXCEPTION 'Expected loss'; END IF;
    PERFORM ranked_internal.apply_verified_match_rating(m);
    IF NOT EXISTS(SELECT 1 FROM public.ranked_elo_events WHERE match_id=m AND policy_version=4 AND rating_before=before_rating AND rating_delta=after_rating-before_rating AND rating_after=after_rating) OR (SELECT rating FROM public.ranked_leaderboard_profiles WHERE user_id=a) IS DISTINCT FROM after_rating THEN RAISE EXCEPTION 'Incorrect loss settlement at %',before_rating; END IF;
  END LOOP;
  IF (SELECT games FROM public.ranked_leaderboard_profiles WHERE user_id=a) IS DISTINCT FROM 7 THEN RAISE EXCEPTION 'Duplicate loss award'; END IF;
  -- Real win using the private board solely as local test oracle.
  UPDATE public.ranked_leaderboard_profiles SET rating=-5 WHERE user_id=b;
  m := public.start_ranked_match(b);
  UPDATE public.ranked_matches SET started_at=clock_timestamp()-interval '1 second' WHERE id=m;
  r := public.execute_ranked_move(b,m,'reveal',8,8,0);
  IF r->>'status' IS DISTINCT FROM 'ok' THEN RAISE EXCEPTION 'Opening failed'; END IF;
  FOR square IN 0..255 LOOP
    EXIT WHEN (SELECT status FROM public.ranked_matches WHERE id=m)='won';
    IF EXISTS(SELECT 1 FROM public.ranked_match_state WHERE match_id=m AND (square=ANY(mine_positions) OR square=ANY(revealed_positions))) THEN CONTINUE; END IF;
    SELECT move_count INTO STRICT revision FROM public.ranked_matches WHERE id=m;
    r := public.execute_ranked_move(b,m,'reveal',square/16,square%16,revision);
    IF r->>'status' IS DISTINCT FROM 'ok' THEN RAISE EXCEPTION 'Win fixture move failed: %',square; END IF;
  END LOOP;
  PERFORM ranked_internal.apply_verified_match_rating(m);
  IF NOT EXISTS(SELECT 1 FROM public.ranked_verified_results WHERE match_id=m AND user_id=b) OR NOT EXISTS(SELECT 1 FROM public.ranked_elo_events WHERE match_id=m AND policy_version=4 AND rating_before=-5 AND rating_delta=160 AND rating_after=155) OR (SELECT games FROM public.ranked_leaderboard_profiles WHERE user_id=b) IS DISTINCT FROM 1 OR (SELECT rating FROM public.ranked_leaderboard_profiles WHERE user_id=b) IS DISTINCT FROM 155 THEN RAISE EXCEPTION 'Verified win or duplicate guard failed'; END IF;
END;
$checks$;
ROLLBACK;
SELECT 'PASS: v4 settlement, protection, negative Elo, verified win, history and version guard' AS result;
