-- Local only: rollback all test fixtures, keep production policy guard active.
BEGIN;
SET LOCAL request.headers = '{"x-ai-coach-ranked-policy":"3"}';
DO $checks$
DECLARE
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  g uuid;
  i integer;
  role_name text;
  privilege_name text;
  table_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOREACH table_name IN ARRAY ARRAY['public.coaching_reviews','public.coaching_review_save_counters'] LOOP
      FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        IF has_table_privilege(role_name,table_name,privilege_name) THEN RAISE EXCEPTION 'Unsafe % % %',role_name,table_name,privilege_name; END IF;
      END LOOP;
    END LOOP;
    IF has_function_privilege(role_name,'public.reserve_coaching_review_save(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Unsafe quota RPC'; END IF;
  END LOOP;
  IF NOT has_function_privilege('service_role','public.reserve_coaching_review_save(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Service quota RPC unavailable'; END IF;
  INSERT INTO auth.users(id) VALUES(a),(b);
  FOR i IN 1..6 LOOP
    IF public.reserve_coaching_review_save(a) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Expected request % admitted',i; END IF;
  END LOOP;
  IF public.reserve_coaching_review_save(a) IS DISTINCT FROM false THEN RAISE EXCEPTION 'Save quota exceeded or minute rolled over'; END IF;
  IF public.reserve_coaching_review_save(b) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Accounts not isolated'; END IF;
  UPDATE public.coaching_review_save_counters SET bucket_start=clock_timestamp()-interval '2 minutes' WHERE user_id=a;
  IF public.reserve_coaching_review_save(a) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Quota did not reset'; END IF;
  INSERT INTO public.practice_games(user_id,client_record_id,difficulty,rows,columns,mine_count,outcome,duration_seconds,mine_indices,move_count,completed_at)
  VALUES(a,'coach-fixture','Beginner',9,9,10,'loss',1,ARRAY[0,1,2,3,4,5,6,7,8,9],1,now()) RETURNING id INTO g;
  INSERT INTO public.coaching_reviews(user_id,mode,game_ref,practice_game_id,analysis_version,difficulty,outcome,completed_at,recording_hash,review)
  VALUES(a,'practice','coach-fixture',g,1,'Beginner','loss',now(),repeat('a',64),'{}');
  INSERT INTO public.coaching_reviews(user_id,mode,game_ref,practice_game_id,analysis_version,difficulty,outcome,completed_at,recording_hash,review)
  VALUES(a,'practice','coach-fixture',g,1,'Beginner','loss',now(),repeat('b',64),'{}')
  ON CONFLICT(user_id,mode,game_ref,analysis_version) DO UPDATE SET recording_hash=EXCLUDED.recording_hash;
  IF (SELECT count(*) FROM public.coaching_reviews WHERE user_id=a) <> 1 THEN RAISE EXCEPTION 'Duplicate report'; END IF;
  INSERT INTO public.coaching_reviews(user_id,mode,game_ref,practice_game_id,analysis_version,difficulty,outcome,completed_at,recording_hash,review)
  VALUES(a,'practice','coach-fixture',g,2,'Beginner','loss',now(),repeat('c',64),'{}');
  IF (SELECT count(*) FROM public.coaching_reviews WHERE user_id=a) <> 2 THEN RAISE EXCEPTION 'Report version not preserved'; END IF;
  DELETE FROM public.practice_games WHERE id=g;
  IF EXISTS (SELECT 1 FROM public.coaching_reviews WHERE user_id=a) THEN RAISE EXCEPTION 'Report deletion did not cascade'; END IF;
  DELETE FROM auth.users WHERE id IN (a,b);
  IF EXISTS (SELECT 1 FROM public.coaching_review_save_counters WHERE user_id IN (a,b)) THEN RAISE EXCEPTION 'Counter deletion did not cascade'; END IF;
END;
$checks$;
ROLLBACK;
SELECT 'Coaching report persistence SQL checks passed' AS result;
