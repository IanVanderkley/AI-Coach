-- Local only. All test accounts and updates roll back.
BEGIN;
DO $test$
DECLARE candidate text;
BEGIN
  FOREACH candidate IN ARRAY ARRAY['fuckhead69','FuCkHeAd69','f_u_c_k','fuuuck','f_4_g_g_0_t','sh1t69','b1tch_69','N1gg3r69','n_i_g_g_a','K1ke','ass69','69_ass','d1ck','d1ckhead','cunt','slut','whore','wanker','heilhitler','whitepower','p1ss','retard','tr4nny'] LOOP
    IF ranked_internal.username_content_allowed(candidate) IS DISTINCT FROM false THEN RAISE EXCEPTION 'Blocked username accepted'; END IF;
  END LOOP;
  FOREACH candidate IN ARRAY ARRAY['Player69','Classic69','Classical','Passion','Peacock','Dickens','Grasshopper','MineSweeper_69','Player00000000000000','Player123','Assistant','Bassist','Ace_69','Rock_69'] LOOP
    IF ranked_internal.username_content_allowed(candidate) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Innocent username rejected: %',candidate; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.ranked_leaderboard_profiles WHERE NOT ranked_internal.username_content_allowed(username)) THEN RAISE EXCEPTION 'Legacy blocked name remains'; END IF;
END;
$test$;
INSERT INTO auth.users(id,email_confirmed_at,raw_user_meta_data) VALUES
 ('ee728f65-c438-493c-b2cf-57ef5a6f0051',now(),'{"username":"fuckhead69"}'),
 ('ee728f65-c438-493c-b2cf-57ef5a6f0052',now(),'{"username":"Batch22D_Mod69"}'),
 ('ee728f65-c438-493c-b2cf-57ef5a6f0053',null,'{}');
DO $alias$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.ranked_leaderboard_profiles WHERE user_id='ee728f65-c438-493c-b2cf-57ef5a6f0051' AND username ~ '^Player[0-9a-f]{14}$' AND username_changed_at IS NULL) THEN RAISE EXCEPTION 'Direct signup did not receive safe alias'; END IF;
END;
$alias$;
SET LOCAL ROLE service_role;
DO $writes$
DECLARE a uuid := 'ee728f65-c438-493c-b2cf-57ef5a6f0051';
BEGIN
  UPDATE public.ranked_leaderboard_profiles SET is_anonymous=true WHERE user_id=a;
  BEGIN
    UPDATE public.ranked_leaderboard_profiles SET username='f_u_c_k' WHERE user_id=a;
    RAISE EXCEPTION 'Blocked update accepted';
  EXCEPTION WHEN SQLSTATE 'PT422' THEN NULL; END;
  BEGIN
    INSERT INTO public.ranked_leaderboard_profiles(user_id,username,is_anonymous) VALUES('ee728f65-c438-493c-b2cf-57ef5a6f0053','fuckhead69',true);
    RAISE EXCEPTION 'Blocked insert accepted';
  EXCEPTION WHEN SQLSTATE 'PT422' THEN NULL; END;
  IF (SELECT username_changed_at FROM public.ranked_leaderboard_profiles WHERE user_id=a) IS NOT NULL THEN RAISE EXCEPTION 'Rejected username consumed cooldown'; END IF;
  UPDATE public.ranked_leaderboard_profiles SET username='Batch22D_Clean69' WHERE user_id=a;
  IF NOT EXISTS(SELECT 1 FROM public.ranked_leaderboard_profiles WHERE user_id=a AND username='Batch22D_Clean69' AND is_anonymous AND username_changed_at IS NOT NULL) THEN RAISE EXCEPTION 'Clean rename did not preserve privacy'; END IF;
END;
$writes$;
RESET ROLE;
ROLLBACK;
SELECT 'Username moderation SQL checks passed' AS result;
