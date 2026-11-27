-- LOCAL ONLY: real terminal RPCs; private board used as test oracle.
BEGIN;
SET LOCAL request.headers = '{"x-ai-coach-ranked-policy":"5"}';
DO $checks$
DECLARE
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  m uuid; old_match uuid; r jsonb; target integer; square integer; revision integer; k integer; expected integer;
  mines integer[] := ARRAY[1,2,8,15,18,22,32,48,50,54,63,74,79,93,94,112,113,126,127,129,132,143,150,155,165,166,179,191,195,197,198,200,201,202,216,222,224,239,249,252];
BEGIN
  INSERT INTO auth.users(id,email_confirmed_at) VALUES(a,now()),(b,now());
  -- Preserve historical XP receipt and balance. This synthetic old match has no gameplay trigger.
  INSERT INTO public.ranked_matches(user_id,status,started_at,finished_at,duration_ms) VALUES(a,'lost',now()-interval '1 second',now(),1000) RETURNING id INTO old_match;
  INSERT INTO xp_internal.player_xp_ledger(source_match_id,user_id,event_type,amount) VALUES(old_match,a,'ranked_verified_loss',17);
  INSERT INTO public.player_xp_profiles(user_id,total_xp) VALUES(a,17) ON CONFLICT(user_id) DO UPDATE SET total_xp=17;
  FOR k IN 1..3 LOOP
    m := public.start_ranked_match(a);
    r := public.execute_ranked_move(a,m,'reveal',8,8,0);
    IF r->>'status' IS DISTINCT FROM 'ok' THEN RAISE EXCEPTION 'Opening failed'; END IF;
    -- Fixed local board and matching safe reveals make the action count deterministic.
    -- The opening and one additional safe reveal are synthetic fixture state only.
    UPDATE public.ranked_match_state SET mine_positions=mines,revealed_positions=ARRAY[136,137],flagged_positions=ARRAY[]::integer[] WHERE match_id=m;
    IF k IN (2,3) THEN
      UPDATE public.ranked_matches SET move_count=2 WHERE id=m;
      INSERT INTO public.ranked_match_moves(match_id,move_number,action,row_index,column_index) VALUES(m,2,'reveal',8,9);
    END IF;
    UPDATE public.ranked_matches SET started_at=clock_timestamp()-CASE WHEN k=2 THEN interval '1 second' ELSE interval '16 seconds' END WHERE id=m;
    SELECT move_count INTO STRICT revision FROM public.ranked_matches WHERE id=m;
    r := public.execute_ranked_move(a,m,'reveal',0,1,revision);
    IF r->'result'->>'status' IS DISTINCT FROM 'lost' THEN RAISE EXCEPTION 'Loss fixture failed: %',k; END IF;
    expected := CASE WHEN k=3 THEN 50 ELSE 0 END;
    IF NOT EXISTS(SELECT 1 FROM public.player_xp_match_receipts WHERE match_id=m AND user_id=a AND outcome='lost' AND amount=expected) THEN RAISE EXCEPTION 'Unexpected XP receipt: %',k; END IF;
    IF (SELECT total_xp FROM public.player_xp_profiles WHERE user_id=a) IS DISTINCT FROM (17+expected)::bigint THEN RAISE EXCEPTION 'Unexpected balance: %',k; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.ranked_elo_events WHERE match_id=m AND outcome='lost') THEN RAISE EXCEPTION 'XP gate blocked Elo'; END IF;
    r := public.execute_ranked_move(a,m,'reveal',0,1,revision);
    IF r->>'status' = 'ok' OR (SELECT total_xp FROM public.player_xp_profiles WHERE user_id=a) IS DISTINCT FROM (17+expected)::bigint THEN RAISE EXCEPTION 'Duplicate reward'; END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM public.player_xp_match_receipts WHERE match_id=old_match AND amount=17) THEN RAISE EXCEPTION 'Historical receipt changed'; END IF;
  m := public.start_ranked_match(b);
  r := public.execute_ranked_move(b,m,'reveal',8,8,0);
  IF r->>'status' IS DISTINCT FROM 'ok' THEN RAISE EXCEPTION 'Opening failed'; END IF;
  FOR square IN 0..255 LOOP
    EXIT WHEN (SELECT status FROM public.ranked_matches WHERE id=m)='won';
    IF EXISTS(SELECT 1 FROM public.ranked_match_state WHERE match_id=m AND (square=ANY(mine_positions) OR square=ANY(revealed_positions))) THEN CONTINUE; END IF;
    SELECT move_count INTO STRICT revision FROM public.ranked_matches WHERE id=m;
    r := public.execute_ranked_move(b,m,'reveal',square/16,square%16,revision);
    IF r->>'status' IS DISTINCT FROM 'ok' THEN RAISE EXCEPTION 'Win fixture move failed: %',square; END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM public.player_xp_match_receipts WHERE match_id=m AND user_id=b AND outcome='won' AND amount=350) OR (SELECT total_xp FROM public.player_xp_profiles WHERE user_id=b) IS DISTINCT FROM 350::bigint THEN RAISE EXCEPTION 'Verified victory XP failed'; END IF;
  IF has_function_privilege('authenticated','xp_internal.award_verified_ranked_loss_xp()','EXECUTE') OR has_function_privilege('service_role','xp_internal.award_verified_ranked_loss_xp()','EXECUTE') OR has_table_privilege('authenticated','public.player_xp_match_receipts','INSERT') THEN RAISE EXCEPTION 'Unsafe XP privileges'; END IF;
END;
$checks$;
ROLLBACK;
SELECT 'PASS: Ranked XP v2, participation, historical receipt, win, Elo and duplicate prevention' AS result;
