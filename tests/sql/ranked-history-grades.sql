-- LOCAL ONLY. Exercises cache provenance/permissions, not the TypeScript scorer.
BEGIN;
SET LOCAL request.headers = '{"x-ai-coach-ranked-policy":"5"}';
DO $setup$
DECLARE a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); m uuid; active_match uuid; target integer; r jsonb;
BEGIN
  INSERT INTO auth.users(id,email_confirmed_at) VALUES(a,now()),(b,now());
  m := public.start_ranked_match(a);
  r := public.execute_ranked_move(a,m,'reveal',8,8,0);
  IF r->>'status' IS DISTINCT FROM 'ok' THEN RAISE EXCEPTION 'Opening failed'; END IF;
  SELECT mine_positions[1] INTO STRICT target FROM public.ranked_match_state WHERE match_id=m;
  r := public.execute_ranked_move(a,m,'reveal',target/16,target%16,1);
  IF r->'result'->>'status' IS DISTINCT FROM 'lost' THEN RAISE EXCEPTION 'Terminal loss failed'; END IF;
  active_match := public.start_ranked_match(b);
  PERFORM set_config('test.grade_owner',a::text,true);
  PERFORM set_config('test.grade_foreign',b::text,true);
  PERFORM set_config('test.grade_match',m::text,true);
  PERFORM set_config('test.grade_active',active_match::text,true);
  IF has_table_privilege('anon','public.ranked_history_grades','SELECT') OR
     has_table_privilege('authenticated','public.ranked_history_grades','SELECT') OR
     has_table_privilege('authenticated','public.ranked_history_grades','INSERT') OR
     has_table_privilege('service_role','public.ranked_history_grades','UPDATE') OR
     has_table_privilege('service_role','public.ranked_history_grades','DELETE') OR
     has_function_privilege('authenticated','public.reserve_ranked_history_grade(uuid)','EXECUTE') OR
     has_function_privilege('anon','public.reserve_ranked_history_grade(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Unsafe grade privileges';
  END IF;
END;
$setup$;
SET LOCAL ROLE service_role;
DO $cache$
DECLARE a uuid := current_setting('test.grade_owner')::uuid; b uuid := current_setting('test.grade_foreign')::uuid;
  m uuid := current_setting('test.grade_match')::uuid; active_match uuid := current_setting('test.grade_active')::uuid;
  rejected boolean; i integer;
BEGIN
  rejected := false;
  BEGIN INSERT INTO public.ranked_history_grades(match_id,user_id,analysis_version,score,grade) VALUES(m,b,1,72,'B');
  EXCEPTION WHEN raise_exception THEN rejected := true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Foreign source accepted'; END IF;
  rejected := false;
  BEGIN INSERT INTO public.ranked_history_grades(match_id,user_id,analysis_version,score,grade) VALUES(active_match,b,1,72,'B');
  EXCEPTION WHEN raise_exception THEN rejected := true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Active source accepted'; END IF;
  rejected := false;
  BEGIN INSERT INTO public.ranked_history_grades(match_id,user_id,analysis_version,score,grade) VALUES(m,a,1,72,'S');
  EXCEPTION WHEN check_violation THEN rejected := true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Wrong grade accepted'; END IF;
  INSERT INTO public.ranked_history_grades(match_id,user_id,analysis_version,score,grade) VALUES(m,a,1,72,'B'),(m,a,2,NULL,NULL);
  IF NOT EXISTS(SELECT 1 FROM public.ranked_history_grades WHERE match_id=m AND user_id=a AND analysis_version=1 AND grade='B' AND score=72) THEN RAISE EXCEPTION 'Cache read failed'; END IF;
  rejected := false;
  BEGIN INSERT INTO public.ranked_history_grades(match_id,user_id,analysis_version,score,grade) VALUES(m,a,1,91,'S');
  EXCEPTION WHEN unique_violation THEN rejected := true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Duplicate cache key accepted'; END IF;
  FOR i IN 1..12 LOOP
    IF public.reserve_ranked_history_grade(a) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Reservation % failed',i; END IF;
  END LOOP;
  -- Pin a full counter to a future minute to avoid wall-clock rollover in this fixture.
  UPDATE public.ranked_history_grade_counters SET usage_count=12,bucket_start=date_trunc('minute',clock_timestamp())+interval '1 minute' WHERE user_id=a;
  IF public.reserve_ranked_history_grade(a) IS DISTINCT FROM false OR public.reserve_ranked_history_grade(b) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Quota isolation failed'; END IF;
END;
$cache$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: grade cache ownership, terminal source, versioning, score consistency, immutability and quota' AS result;
