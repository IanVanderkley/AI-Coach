-- LOCAL ONLY. All fixtures roll back. Use a local DB owner.
BEGIN;
SET LOCAL request.headers = '{"x-ai-coach-ranked-policy":"5"}';
DO $test$
DECLARE
  a uuid := gen_random_uuid();
  m uuid;
  r jsonb;
  target integer;
  initial_rating integer;
  expected integer;
  qualifies boolean;
  k integer;
  mines integer[] := ARRAY[1,2,8,15,18,22,32,48,50,54,63,74,79,93,94,112,113,126,127,129,132,143,150,155,165,166,179,191,195,197,198,200,201,202,216,222,224,239,249,252];
  revealed integer[];
  expected_games integer := 0;
BEGIN
  IF (SELECT required_policy_version FROM ranked_internal.release_maintenance WHERE singleton) IS DISTINCT FROM 5 THEN RAISE EXCEPTION 'Expected contract 5'; END IF;
  IF has_function_privilege('authenticated','ranked_internal.record_ranked_loss_after_move()','EXECUTE') OR has_function_privilege('anon','ranked_internal.record_ranked_loss_after_move()','EXECUTE') OR has_function_privilege('service_role','ranked_internal.record_ranked_loss_after_move()','EXECUTE') OR has_table_privilege('authenticated','public.ranked_elo_events','INSERT') OR has_table_privilege('authenticated','public.ranked_elo_events','UPDATE') THEN RAISE EXCEPTION 'Unsafe settlement grants'; END IF;
  INSERT INTO auth.users(id,email_confirmed_at) VALUES (a,now());
  PERFORM set_config('request.headers','{"x-ai-coach-ranked-policy":"4"}',true);
  BEGIN
    PERFORM public.start_ranked_match(a);
    RAISE EXCEPTION 'Old application write accepted';
  EXCEPTION WHEN SQLSTATE 'PT503' THEN NULL; END;
  PERFORM set_config('request.headers','{"x-ai-coach-ranked-policy":"5"}',true);
  -- Fixed board with last safe cell 0 and candidate mine 1. This is a
  -- synthetic LOCAL board-state fixture, not a genuine played recording.
  SELECT array_agg(i ORDER BY i) INTO revealed FROM generate_series(0,255) g(i)
    WHERE i <> 0 AND NOT (i = ANY(mines));
  IF NOT ranked_internal.prove_final_guess_loss_v1(mines,revealed,136,1) THEN RAISE EXCEPTION 'Fixture does not prove 50/50'; END IF;
  FOR k IN 1..6 LOOP
    initial_rating := CASE k WHEN 1 THEN 1490 WHEN 2 THEN 2500 WHEN 3 THEN 9999 WHEN 4 THEN 1505 ELSE 1500 END;
    qualifies := k <= 3;
    target := CASE WHEN k <= 3 THEN 1 ELSE 2 END;
    expected := CASE k WHEN 1 THEN 60 WHEN 2 THEN 43 WHEN 3 THEN 1 WHEN 4 THEN -5 ELSE -12 END;
    UPDATE public.ranked_leaderboard_profiles SET rating = initial_rating WHERE user_id=a;
    m := public.start_ranked_match(a);
    r := public.execute_ranked_move(a,m,'reveal',8,8,0);
    IF r->>'status' IS DISTINCT FROM 'ok' THEN RAISE EXCEPTION 'Opening failed'; END IF;
    UPDATE public.ranked_match_state SET mine_positions=mines, revealed_positions=revealed, flagged_positions=ARRAY[]::integer[] WHERE match_id=m;
    UPDATE public.ranked_matches SET started_at=clock_timestamp()-interval '1 second' WHERE id=m;
    IF k=6 THEN
      -- At clue 16, wrongly flag the last safe square 0 and correctly flag
      -- mine 32. Chording loses on mine 1, but is not a direct guess.
      UPDATE public.ranked_match_state SET flagged_positions=ARRAY[0,32] WHERE match_id=m;
      r := public.execute_ranked_move(a,m,'chord',1,0,1);
    ELSE
      r := public.execute_ranked_move(a,m,'reveal',target/16,target%16,1);
    END IF;
    IF r->'result'->>'status' IS DISTINCT FROM 'lost' THEN RAISE EXCEPTION 'Terminal move failed: %',k; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.ranked_elo_events WHERE match_id=m) THEN RAISE EXCEPTION 'Terminal move did not atomically create receipt: %',k; END IF;
    PERFORM ranked_internal.apply_verified_match_rating(m);
    expected_games := expected_games + 1;
    IF NOT EXISTS (SELECT 1 FROM public.ranked_elo_events WHERE match_id=m AND user_id=a AND policy_version=4 AND outcome='lost' AND final_guess_compensated=qualifies AND rating_before=initial_rating AND rating_delta=expected AND rating_after=initial_rating+expected) THEN RAISE EXCEPTION 'Bad receipt: case %',k; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.ranked_leaderboard_profiles WHERE user_id=a AND rating=initial_rating+expected AND games=expected_games AND losses=expected_games AND wins=0) THEN RAISE EXCEPTION 'Duplicate award or incorrect standings: case %',k; END IF;
    IF EXISTS (SELECT 1 FROM public.ranked_verified_results WHERE match_id=m) THEN RAISE EXCEPTION 'Compensated defeat created a verified win'; END IF;
  END LOOP;
END;
$test$;
ROLLBACK;
SELECT 'PASS: final guess compensation, promotion, ceiling, ordinary losses, write guard and duplicate prevention' AS result;
