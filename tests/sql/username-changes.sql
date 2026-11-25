-- LOCAL ONLY: all accounts and identity changes roll back.
BEGIN;
INSERT INTO auth.users (id, email_confirmed_at, raw_user_meta_data) VALUES
 ('ee728f65-c438-493c-b2cf-57ef5a6f0041', now(), '{"username":"Batch22D_TestOne"}'),
 ('ee728f65-c438-493c-b2cf-57ef5a6f0042', now(), '{"username":"batch22d_testone"}'),
 ('ee728f65-c438-493c-b2cf-57ef5a6f0043', null, '{"username":"Batch22D_TestThree"}');
UPDATE auth.users SET email_confirmed_at = now() WHERE id = 'ee728f65-c438-493c-b2cf-57ef5a6f0043';
DO $initial$
BEGIN
 IF (SELECT username FROM public.ranked_leaderboard_profiles WHERE user_id='ee728f65-c438-493c-b2cf-57ef5a6f0041') IS DISTINCT FROM 'Batch22D_TestOne' THEN RAISE EXCEPTION 'Preferred username not initialized'; END IF;
 IF ((SELECT username FROM public.ranked_leaderboard_profiles WHERE user_id='ee728f65-c438-493c-b2cf-57ef5a6f0042') ~ '^Player[0-9a-f]{14}$') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Duplicate alias not allocated'; END IF;
 IF (SELECT username FROM public.ranked_leaderboard_profiles WHERE user_id='ee728f65-c438-493c-b2cf-57ef5a6f0043') IS DISTINCT FROM 'Batch22D_TestThree' THEN RAISE EXCEPTION 'Confirmation did not initialize profile'; END IF;
 IF pg_catalog.has_table_privilege('authenticated','public.ranked_leaderboard_profiles','UPDATE') OR pg_catalog.has_table_privilege('anon','public.ranked_leaderboard_profiles','UPDATE') THEN RAISE EXCEPTION 'Client can write identity'; END IF;
END;
$initial$;
SET LOCAL ROLE service_role;
UPDATE public.ranked_leaderboard_profiles SET is_anonymous=true,rating=1016,games=1,wins=1 WHERE user_id='ee728f65-c438-493c-b2cf-57ef5a6f0041';
DO $checks$
DECLARE a uuid := 'ee728f65-c438-493c-b2cf-57ef5a6f0041'; b uuid := 'ee728f65-c438-493c-b2cf-57ef5a6f0042'; stamp timestamptz;
BEGIN
 BEGIN
  UPDATE public.ranked_leaderboard_profiles SET username='batch22d_testone' WHERE user_id=b;
  RAISE EXCEPTION 'Duplicate private name accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 UPDATE public.ranked_leaderboard_profiles SET username='Batch22D_Renamed' WHERE user_id=a;
 SELECT username_changed_at INTO stamp FROM public.ranked_leaderboard_profiles WHERE user_id=a;
 IF stamp IS NULL THEN RAISE EXCEPTION 'Missing cooldown timestamp'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.ranked_leaderboard_profiles WHERE user_id=a AND is_anonymous AND rating=1016 AND games=1 AND wins=1 AND username='Batch22D_Renamed') THEN RAISE EXCEPTION 'Rename changed stats or privacy'; END IF;
 IF EXISTS (SELECT 1 FROM public.ranked_public_elo WHERE username='Batch22D_Renamed') THEN RAISE EXCEPTION 'Private player leaked'; END IF;
 BEGIN
  UPDATE public.ranked_leaderboard_profiles SET username='Batch22D_Again' WHERE user_id=a;
  RAISE EXCEPTION 'Cooldown bypass';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 UPDATE public.ranked_leaderboard_profiles SET username='Batch22D_Renamed', username_changed_at=NULL, is_anonymous=false WHERE user_id=a;
 IF (SELECT username_changed_at FROM public.ranked_leaderboard_profiles WHERE user_id=a) IS DISTINCT FROM stamp THEN RAISE EXCEPTION 'Privacy/no-op modified cooldown'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.ranked_public_elo WHERE username='Batch22D_Renamed' AND rating=1016) THEN RAISE EXCEPTION 'Public board not updated'; END IF;
END;
$checks$;
RESET ROLE;
UPDATE auth.users SET raw_user_meta_data = '{"username":"Batch22D_Bypass"}' WHERE id='ee728f65-c438-493c-b2cf-57ef5a6f0041';
DO $metadata$
BEGIN
 IF (SELECT username FROM public.ranked_leaderboard_profiles WHERE user_id='ee728f65-c438-493c-b2cf-57ef5a6f0041') IS DISTINCT FROM 'Batch22D_Renamed' THEN RAISE EXCEPTION 'Auth metadata bypassed canonical name'; END IF;
END;
$metadata$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','ee728f65-c438-493c-b2cf-57ef5a6f0042',true);
DO $rls$
BEGIN
 IF EXISTS(SELECT 1 FROM public.ranked_leaderboard_profiles WHERE user_id='ee728f65-c438-493c-b2cf-57ef5a6f0041') THEN RAISE EXCEPTION 'Cross-account read'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ranked_leaderboard_profiles WHERE user_id='ee728f65-c438-493c-b2cf-57ef5a6f0042') THEN RAISE EXCEPTION 'Owner read failed'; END IF;
 BEGIN
  UPDATE public.ranked_leaderboard_profiles SET username='Bypass' WHERE user_id='ee728f65-c438-493c-b2cf-57ef5a6f0042';
  RAISE EXCEPTION 'Direct client write accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$rls$;
RESET ROLE;
ROLLBACK;
SELECT 'Username changes SQL checks passed' AS result;
