-- LOCAL ONLY: structural Practice recording fixtures, not verified competitive games.
BEGIN;
INSERT INTO auth.users (id) VALUES ('ee728f65-c438-493c-b2cf-57ef5a6f0031'), ('ee728f65-c438-493c-b2cf-57ef5a6f0032');
DO $permissions$
BEGIN
  IF has_table_privilege('anon','public.player_practice_xp_receipts','SELECT') OR
     has_table_privilege('authenticated','public.player_practice_xp_receipts','INSERT') OR
     has_table_privilege('authenticated','public.player_practice_xp_receipts','UPDATE') OR
     has_table_privilege('authenticated','public.player_practice_xp_receipts','DELETE') OR
     has_table_privilege('authenticated','public.player_xp_profiles','UPDATE') OR
     has_function_privilege('authenticated','xp_internal.award_recorded_practice_xp()','EXECUTE') THEN
    RAISE EXCEPTION 'Practice XP has unsafe grants';
  END IF;
END;
$permissions$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','ee728f65-c438-493c-b2cf-57ef5a6f0031',true);
DO $practice$
DECLARE
  a uuid := auth.uid();
  g uuid;
  i integer;
  difficulty_name text;
  result_name text;
  r integer;
  c integer;
  mines integer;
BEGIN
  IF a IS DISTINCT FROM 'ee728f65-c438-493c-b2cf-57ef5a6f0031'::uuid THEN RAISE EXCEPTION 'Missing fixture identity'; END IF;
  FOR i IN 1..13 LOOP
    difficulty_name := CASE WHEN i IN (1,2,9,12,13) THEN 'Beginner' WHEN i IN (3,4,10) THEN 'Intermediate' ELSE 'Expert' END;
    result_name := CASE WHEN i IN (2,4,6,9,11,12,13) THEN 'loss' ELSE 'win' END;
    r := CASE WHEN difficulty_name='Beginner' THEN 9 ELSE 16 END;
    c := CASE difficulty_name WHEN 'Beginner' THEN 9 WHEN 'Intermediate' THEN 16 ELSE 30 END;
    mines := CASE difficulty_name WHEN 'Beginner' THEN 10 WHEN 'Intermediate' THEN 40 ELSE 99 END;
    INSERT INTO public.practice_games (user_id,client_record_id,difficulty,rows,columns,mine_count,outcome,duration_seconds,mine_indices,move_count,completed_at)
    VALUES (a,'xp-fixture-'||i,difficulty_name,r,c,mines,result_name,CASE WHEN i=9 THEN 1 ELSE 20 END,ARRAY(SELECT generate_series(0,mines-1)),3,now()) RETURNING id INTO g;
    INSERT INTO public.practice_game_moves (game_id,move_number,"row","column",action_type,at_ms,after_hash)
    VALUES (g,1,8,0,'reveal',1000,'12345678'),(g,2,8,1,'reveal',10000,'12345678'),(g,3,8,2,'reveal',20000,'12345678');
    -- Retrying writes never creates an extra award.
    UPDATE public.practice_game_moves SET after_hash='12345678' WHERE game_id=g;
  END LOOP;
  IF (SELECT array_agg(amount ORDER BY substring(client_record_id from 12)::integer) FROM public.player_practice_xp_receipts) IS DISTINCT FROM ARRAY[50,10,100,20,150,30,0,0,0,100,30,10,0] THEN RAISE EXCEPTION 'Wrong Practice receipts'; END IF;
  IF (SELECT total_xp FROM public.player_xp_profiles WHERE user_id=a) IS DISTINCT FROM 500::bigint THEN RAISE EXCEPTION 'Wrong Practice XP total'; END IF;
  IF (SELECT reason FROM public.player_practice_xp_receipts WHERE client_record_id='xp-fixture-8') IS DISTINCT FROM 'daily_limit' THEN RAISE EXCEPTION 'Quota did not deny'; END IF;
  IF (SELECT reason FROM public.player_practice_xp_receipts WHERE client_record_id='xp-fixture-9') IS DISTINCT FROM 'participation' THEN RAISE EXCEPTION 'Participation did not deny'; END IF;
END;
$practice$;
SELECT set_config('request.jwt.claim.sub','ee728f65-c438-493c-b2cf-57ef5a6f0032',true);
DO $privacy$
BEGIN
  IF EXISTS (SELECT 1 FROM public.player_practice_xp_receipts) THEN RAISE EXCEPTION 'Foreign receipts exposed'; END IF;
  IF EXISTS (SELECT 1 FROM public.player_xp_profiles) THEN RAISE EXCEPTION 'Foreign balance exposed'; END IF;
END;
$privacy$;
RESET ROLE;
DO $quota$
BEGIN
  IF (SELECT amount FROM xp_internal.practice_daily_xp WHERE user_id='ee728f65-c438-493c-b2cf-57ef5a6f0031') IS DISTINCT FROM 500 THEN RAISE EXCEPTION 'Wrong quota balance'; END IF;
END;
$quota$;
ROLLBACK;
SELECT 'PASS: Practice XP v2 rewards, 500 cap, participation, deduplication and privacy' AS result;
