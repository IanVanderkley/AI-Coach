-- LOCAL ONLY. All fixtures are rolled back. Run as local database owner.
BEGIN;
DO $checks$
DECLARE
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  legacy uuid;
  m uuid;
  mine integer;
  square integer;
  revision integer;
  r jsonb;
  score integer;
  e double precision;
  expected_win integer;
  expected_loss integer;
  sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY['ranked_internal.rating_delta_v2(integer,text)', 'ranked_internal.rating_delta_v3(integer,text)', 'ranked_internal.apply_verified_match_rating(uuid)'] LOOP
    IF has_function_privilege('anon',sig,'EXECUTE') OR has_function_privilege('authenticated',sig,'EXECUTE') THEN
      RAISE EXCEPTION 'Unsafe rating function privileges: %', sig;
    END IF;
  END LOOP;
  IF has_table_privilege('authenticated','public.ranked_elo_events','INSERT') OR
     has_table_privilege('authenticated','public.ranked_elo_events','UPDATE') OR
     has_table_privilege('authenticated','public.ranked_leaderboard_profiles','UPDATE') THEN
    RAISE EXCEPTION 'Browser can write ratings';
  END IF;
  -- Independent double-precision reference, mirroring TypeScript positive rounding.
  FOR score IN 100..10000 LOOP
    e := 1.0 / (1.0 + power(10.0::double precision, (1700-score)::double precision/1900.0));
    expected_win := least(10000-score, floor(90*(1-e)+0.5)::integer);
    expected_loss := -least(score-100, floor(45*e+0.5)::integer);
    IF ranked_internal.rating_delta_v2(score,'won') IS DISTINCT FROM expected_win OR
       ranked_internal.rating_delta_v2(score,'lost') IS DISTINCT FROM expected_loss THEN
      RAISE EXCEPTION 'Formula parity failed at %', score;
    END IF;
    IF ranked_internal.rating_delta_v3(score,'won') IS DISTINCT FROM least(10000-score,greatest(5,least(100,floor(90*(1-e)+0.5)::integer))) OR
       ranked_internal.rating_delta_v3(score,'lost') IS DISTINCT FROM expected_loss THEN
      RAISE EXCEPTION 'v3 formula parity failed at %', score;
    END IF;
  END LOOP;
  IF ranked_internal.rating_delta_v2(1000,'won') <> 63 OR
     ranked_internal.rating_delta_v2(1000,'lost') <> -13 OR
     ranked_internal.rating_delta_v2(3400,'won') <> 10 OR
     ranked_internal.rating_delta_v2(3400,'lost') <> -40 THEN RAISE EXCEPTION 'Sample awards changed'; END IF;
  BEGIN
    PERFORM ranked_internal.rating_delta_v2(1000,'abandoned');
    RAISE EXCEPTION 'Invalid outcome accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM ranked_internal.rating_delta_v2(99,'won');
    RAISE EXCEPTION 'Invalid rating accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM ranked_internal.rating_delta_v2(NULL,'won');
    RAISE EXCEPTION 'Null rating accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;

  INSERT INTO auth.users(id,email_confirmed_at) VALUES (a,now()),(b,now());
  IF (SELECT rating FROM public.ranked_leaderboard_profiles WHERE user_id=a) IS DISTINCT FROM 1600 OR
     (SELECT rating FROM public.ranked_leaderboard_profiles WHERE user_id=b) IS DISTINCT FROM 1600 THEN
    RAISE EXCEPTION 'New confirmed account did not start at Gold V';
  END IF;
  -- Model a pre-v2 completed loss and its original immutable receipt.
  INSERT INTO public.ranked_matches(user_id,status,started_at,finished_at,duration_ms)
    VALUES(a,'lost',now()-interval '1 second',now(),1000) RETURNING id INTO legacy;
  INSERT INTO public.ranked_elo_events(match_id,user_id,outcome,rating_before,rating_delta,rating_after)
    VALUES(legacy,a,'lost',1000,-16,984);
  UPDATE public.ranked_leaderboard_profiles SET rating=984,games=1,wins=0,losses=1 WHERE user_id=a;
  PERFORM ranked_internal.apply_verified_match_rating(legacy);
  IF NOT EXISTS(SELECT 1 FROM public.ranked_elo_events WHERE match_id=legacy AND policy_version=1 AND rating_before=1000 AND rating_delta=-16 AND rating_after=984) OR
     (SELECT rating FROM public.ranked_leaderboard_profiles WHERE user_id=a) IS DISTINCT FROM 984 THEN
    RAISE EXCEPTION 'Historical receipt or rating changed';
  END IF;

  -- Actual server-controlled loss from the old balance.
  m := public.start_ranked_match(a);
  r := public.execute_ranked_move(a,m,'reveal',8,8,0);
  IF r->>'status' IS DISTINCT FROM 'ok' THEN RAISE EXCEPTION 'Opening failed'; END IF;
  SELECT mine_positions[1] INTO STRICT mine FROM public.ranked_match_state WHERE match_id=m;
  UPDATE public.ranked_matches SET started_at=clock_timestamp()-interval '1 second' WHERE id=m;
  r := public.execute_ranked_move(a,m,'reveal',mine/16,mine%16,1);
  IF r->'result'->>'status' IS DISTINCT FROM 'lost' THEN RAISE EXCEPTION 'Expected real loss'; END IF;
  PERFORM ranked_internal.apply_verified_match_rating(m);
  IF NOT EXISTS(SELECT 1 FROM public.ranked_elo_events WHERE match_id=m AND policy_version=3 AND rating_before=984 AND rating_delta=ranked_internal.rating_delta_v2(984,'lost') AND rating_after=984+ranked_internal.rating_delta_v2(984,'lost')) OR
     (SELECT games FROM public.ranked_leaderboard_profiles WHERE user_id=a) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'Loss receipt or duplicate guard failed'; END IF;

  -- Preserve a historical v2 zero-gain win receipt and the old balance.
  INSERT INTO public.ranked_matches(user_id,status,started_at,finished_at,duration_ms)
    VALUES(b,'won',now()-interval '1 second',now(),1000) RETURNING id INTO legacy;
  INSERT INTO public.ranked_elo_events(match_id,user_id,outcome,rating_before,rating_delta,rating_after,policy_version)
    VALUES(legacy,b,'won',8000,0,8000,2);
  UPDATE public.ranked_leaderboard_profiles SET rating=8000,games=1,wins=1,losses=0 WHERE user_id=b;
  PERFORM ranked_internal.apply_verified_match_rating(legacy);
  IF NOT EXISTS(SELECT 1 FROM public.ranked_elo_events WHERE match_id=legacy AND policy_version=2 AND rating_before=8000 AND rating_delta=0 AND rating_after=8000) OR
     (SELECT rating FROM public.ranked_leaderboard_profiles WHERE user_id=b) IS DISTINCT FROM 8000 THEN
    RAISE EXCEPTION 'Historical v2 receipt changed';
  END IF;
  -- Real verified win using database-owned board as a LOCAL test oracle only.
  m := public.start_ranked_match(b);
  PERFORM ranked_internal.apply_verified_match_rating(m);
  IF EXISTS(SELECT 1 FROM public.ranked_elo_events WHERE match_id=m) THEN RAISE EXCEPTION 'Active game paid Elo'; END IF;
  UPDATE public.ranked_matches SET started_at=clock_timestamp()-interval '1 second' WHERE id=m;
  r := public.execute_ranked_move(b,m,'reveal',8,8,0);
  IF r->>'status' IS DISTINCT FROM 'ok' THEN RAISE EXCEPTION 'Opening failed'; END IF;
  FOR square IN 0..255 LOOP
    EXIT WHEN (SELECT status FROM public.ranked_matches WHERE id=m)='won';
    IF EXISTS(SELECT 1 FROM public.ranked_match_state WHERE match_id=m AND (square=ANY(mine_positions) OR square=ANY(revealed_positions))) THEN CONTINUE; END IF;
    SELECT move_count INTO STRICT revision FROM public.ranked_matches WHERE id=m;
    r := public.execute_ranked_move(b,m,'reveal',square/16,square%16,revision);
    IF r->>'status' IS DISTINCT FROM 'ok' THEN RAISE EXCEPTION 'Verified win fixture move failed: %', square; END IF;
  END LOOP;
  PERFORM ranked_internal.apply_verified_match_rating(m);
  IF NOT EXISTS(SELECT 1 FROM public.ranked_verified_results WHERE match_id=m AND user_id=b) OR
     NOT EXISTS(SELECT 1 FROM public.ranked_elo_events WHERE match_id=m AND policy_version=3 AND rating_before=8000 AND rating_delta=5 AND rating_after=8005) OR
     (SELECT games FROM public.ranked_leaderboard_profiles WHERE user_id=b) IS DISTINCT FROM 2 OR
     (SELECT rating FROM public.ranked_leaderboard_profiles WHERE user_id=b) IS DISTINCT FROM 8005 THEN RAISE EXCEPTION 'Verified win or duplicate guard failed'; END IF;
END;
$checks$;
ROLLBACK;
SELECT 'Ranked Elo policy v3 SQL checks passed' AS result;
