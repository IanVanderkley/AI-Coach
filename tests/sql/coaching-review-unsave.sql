-- Local-only privilege and delete test. Roll back all fixtures.
BEGIN;
DO $$
DECLARE a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); ga uuid; gb uuid; r text;
BEGIN
  IF NOT has_table_privilege('service_role','public.coaching_reviews','DELETE') THEN RAISE EXCEPTION 'Missing service-only delete grant'; END IF;
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_table_privilege(r,'public.coaching_reviews','DELETE') THEN RAISE EXCEPTION 'Unsafe browser delete grant'; END IF;
  END LOOP;
  INSERT INTO auth.users(id) VALUES(a),(b);
  INSERT INTO public.practice_games(user_id,client_record_id,difficulty,rows,columns,mine_count,outcome,duration_seconds,mine_indices,move_count,completed_at)
  VALUES(a,'unsave-fixture','Beginner',9,9,10,'loss',1,ARRAY[0,1,2,3,4,5,6,7,8,9],1,now()) RETURNING id INTO ga;
  INSERT INTO public.practice_games(user_id,client_record_id,difficulty,rows,columns,mine_count,outcome,duration_seconds,mine_indices,move_count,completed_at)
  VALUES(b,'unsave-fixture','Beginner',9,9,10,'loss',1,ARRAY[0,1,2,3,4,5,6,7,8,9],1,now()) RETURNING id INTO gb;
  INSERT INTO public.coaching_reviews(user_id,mode,game_ref,practice_game_id,analysis_version,difficulty,outcome,completed_at,recording_hash,review)
  VALUES(a,'practice','unsave-fixture',ga,1,'Beginner','loss',now(),repeat('a',64),'{}'),
        (a,'practice','unsave-fixture',ga,2,'Beginner','loss',now(),repeat('a',64),'{}'),
        (b,'practice','unsave-fixture',gb,1,'Beginner','loss',now(),repeat('b',64),'{}');
  PERFORM set_config('role','service_role',true);
  DELETE FROM public.coaching_reviews WHERE user_id=a AND mode='practice' AND game_ref='unsave-fixture';
  PERFORM set_config('role','postgres',true);
  IF EXISTS(SELECT 1 FROM public.coaching_reviews WHERE user_id=a) OR NOT EXISTS(SELECT 1 FROM public.coaching_reviews WHERE user_id=b AND game_ref='unsave-fixture') THEN RAISE EXCEPTION 'Scoped unsave failed'; END IF;
  IF (SELECT count(*) FROM public.practice_games WHERE id IN(ga,gb)) <> 2 THEN RAISE EXCEPTION 'Original recordings removed'; END IF;
END $$;
ROLLBACK;
SELECT 'Coaching report unsave SQL checks passed' AS result;
