-- LOCAL ONLY. All test users, matches, moves, and rewards roll back.
BEGIN;
DO $permissions$
DECLARE
  fn text;
  role_name text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['reveal_first_ranked_cell', 'reveal_ranked_cell', 'toggle_ranked_flag', 'chord_ranked_cell'] LOOP
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF pg_catalog.has_function_privilege(role_name, 'public.' || fn || '(uuid,uuid,integer,integer,integer)', 'EXECUTE') THEN
        RAISE EXCEPTION '% can execute %', role_name, fn;
      END IF;
    END LOOP;
    IF NOT pg_catalog.has_function_privilege('service_role', 'public.' || fn || '(uuid,uuid,integer,integer,integer)', 'EXECUTE') THEN
      RAISE EXCEPTION 'service role cannot execute %', fn;
    END IF;
  END LOOP;
END;
$permissions$;
INSERT INTO auth.users (id) VALUES
  ('ee728f65-c438-493c-b2cf-57ef5a6f0021'),
  ('ee728f65-c438-493c-b2cf-57ef5a6f0022');
SET LOCAL ROLE service_role;
DO $checks$
DECLARE
  a uuid := 'ee728f65-c438-493c-b2cf-57ef5a6f0021';
  b uuid := 'ee728f65-c438-493c-b2cf-57ef5a6f0022';
  m uuid;
  mine integer;
  result jsonb;
BEGIN
  m := public.start_ranked_match(a);
  IF public.start_ranked_match(a) IS DISTINCT FROM m THEN
    RAISE EXCEPTION 'Duplicate active match';
  END IF;
  BEGIN
    PERFORM public.reveal_first_ranked_cell(m,b,8,8,0);
    RAISE EXCEPTION 'Foreign first move accepted';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
  END;
  result := public.reveal_first_ranked_cell(m,a,8,8,0);
  IF (result->>'moveCount')::integer IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'First move revision'; END IF;
  BEGIN
    PERFORM public.reveal_first_ranked_cell(m,a,8,8,0);
    RAISE EXCEPTION 'First move replay accepted';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
  END;
  SELECT mine_positions[1] INTO mine FROM public.ranked_match_state WHERE match_id = m;
  result := public.toggle_ranked_flag(m,a,mine/16,mine%16,1);
  IF (result->>'flagged')::boolean IS DISTINCT FROM true OR (result->>'moveCount')::integer IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'Flag result'; END IF;
  BEGIN
    PERFORM public.toggle_ranked_flag(m,a,mine/16,mine%16,1);
    RAISE EXCEPTION 'Flag retry reversed flag';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
  END;
  BEGIN
    PERFORM public.chord_ranked_cell(m,a,8,8,1);
    RAISE EXCEPTION 'Stale chord accepted';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
  END;
  result := public.get_ranked_visible_board(m,a);
  IF (result->>'moveCount')::integer IS DISTINCT FROM 2 OR (result->>'flagCount')::integer IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Recovery after stale flag'; END IF;
  IF result ? 'minePositions' THEN RAISE EXCEPTION 'Recovery leaked mines'; END IF;
  result := public.toggle_ranked_flag(m,a,mine/16,mine%16,2);
  IF (result->>'flagged')::boolean IS DISTINCT FROM false OR (result->>'moveCount')::integer IS DISTINCT FROM 3 THEN RAISE EXCEPTION 'Intentional unflag'; END IF;
  -- Ensure the terminal timing is positive without a sleep.
  UPDATE public.ranked_matches SET started_at = clock_timestamp() - interval '1 second' WHERE id = m;
  result := public.reveal_ranked_cell(m,a,mine/16,mine%16,3);
  IF result->>'status' IS DISTINCT FROM 'lost' OR (result->>'moveCount')::integer IS DISTINCT FROM 4 THEN RAISE EXCEPTION 'Terminal move'; END IF;
  BEGIN
    PERFORM public.reveal_ranked_cell(m,a,mine/16,mine%16,3);
    RAISE EXCEPTION 'Terminal replay accepted';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
  END;
  BEGIN
    PERFORM public.toggle_ranked_flag(m,a,mine/16,mine%16,4);
    RAISE EXCEPTION 'Completed match modified';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
  END;
  IF (SELECT count(*) FROM public.ranked_match_moves WHERE match_id = m) <> 4 THEN RAISE EXCEPTION 'Unexpected move count'; END IF;
END;
$checks$;
RESET ROLE;
DO $rewards$
DECLARE
  a uuid := 'ee728f65-c438-493c-b2cf-57ef5a6f0021';
BEGIN
  IF (SELECT count(*) FROM public.ranked_elo_events WHERE user_id = a AND outcome = 'lost') <> 1 THEN RAISE EXCEPTION 'Expected exactly one Elo loss event'; END IF;
  IF (SELECT count(*) FROM public.player_xp_match_receipts WHERE user_id = a AND outcome = 'lost' AND amount = 10) <> 1 THEN RAISE EXCEPTION 'Expected exactly one 10 XP receipt'; END IF;
  IF (SELECT total_xp FROM public.player_xp_profiles WHERE user_id = a) IS DISTINCT FROM 10::bigint THEN RAISE EXCEPTION 'Wrong XP balance'; END IF;
END;
$rewards$;
ROLLBACK;
SELECT 'Ranked move revision SQL checks passed' AS result;
