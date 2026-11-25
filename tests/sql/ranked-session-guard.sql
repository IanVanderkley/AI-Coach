-- LOCAL ONLY: isolated fixture data, always rolled back.
BEGIN;
DO $permissions$
DECLARE signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'ranked_auth_private.session_is_active(uuid,uuid)',
    'public.ranked_session_is_active(uuid,uuid)',
    'public.execute_ranked_move(uuid,uuid,text,integer,integer,integer,uuid)'
  ] LOOP
    IF has_function_privilege('anon', signature, 'EXECUTE') OR
       has_function_privilege('authenticated', signature, 'EXECUTE') OR
       NOT has_function_privilege('service_role', signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'Invalid function permissions: %', signature;
    END IF;
  END LOOP;
  IF has_schema_privilege('anon','ranked_auth_private','USAGE') OR
     has_schema_privilege('authenticated','ranked_auth_private','USAGE') THEN
    RAISE EXCEPTION 'Private schema is exposed';
  END IF;
END;
$permissions$;
INSERT INTO auth.users(id) VALUES
 ('cce1b613-a3c2-4d1e-a6d6-b7defded2001'), ('cce1b613-a3c2-4d1e-a6d6-b7defded2003');
INSERT INTO auth.sessions(id,user_id,not_after,created_at,updated_at) VALUES
 ('cce1b613-a3c2-4d1e-a6d6-b7defded2002','cce1b613-a3c2-4d1e-a6d6-b7defded2001',now()+interval '1 hour',now(),now()),
 ('cce1b613-a3c2-4d1e-a6d6-b7defded2004','cce1b613-a3c2-4d1e-a6d6-b7defded2003',now()-interval '1 hour',now(),now());
SET LOCAL ROLE service_role;
DO $valid$
DECLARE a uuid := 'cce1b613-a3c2-4d1e-a6d6-b7defded2001';
 b uuid := 'cce1b613-a3c2-4d1e-a6d6-b7defded2003';
 s uuid := 'cce1b613-a3c2-4d1e-a6d6-b7defded2002';
 expired uuid := 'cce1b613-a3c2-4d1e-a6d6-b7defded2004';
 m uuid; r jsonb;
BEGIN
  IF public.ranked_session_is_active(a,s) IS DISTINCT FROM true OR
     public.ranked_session_is_active(b,s) IS DISTINCT FROM false OR
     public.ranked_session_is_active(b,expired) IS DISTINCT FROM false OR
     public.ranked_session_is_active(a,NULL) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Session validation failed';
  END IF;
  m := public.start_ranked_match(a);
  r := public.execute_ranked_move(a,m,'reveal',8,8,0,NULL);
  IF r->>'status' IS DISTINCT FROM 'unauthorized' THEN RAISE EXCEPTION 'Missing session accepted'; END IF;
  r := public.execute_ranked_move(a,m,'reveal',8,8,0,expired);
  IF r->>'status' IS DISTINCT FROM 'unauthorized' THEN RAISE EXCEPTION 'Wrong session accepted'; END IF;
  r := public.execute_ranked_move(a,m,'reveal',8,8,0,s);
  IF r->>'status' IS DISTINCT FROM 'ok' OR (r->'result'->>'moveCount')::integer IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Valid session move failed';
  END IF;
END;
$valid$;
RESET ROLE;
UPDATE auth.users SET banned_until=now()+interval '1 hour' WHERE id='cce1b613-a3c2-4d1e-a6d6-b7defded2001';
SET LOCAL ROLE service_role;
DO $ban$
DECLARE a uuid := 'cce1b613-a3c2-4d1e-a6d6-b7defded2001'; s uuid := 'cce1b613-a3c2-4d1e-a6d6-b7defded2002'; m uuid;
BEGIN
 SELECT id INTO STRICT m FROM public.ranked_matches WHERE user_id=a AND status='active';
 IF public.ranked_session_is_active(a,s) IS DISTINCT FROM false OR
    (public.execute_ranked_move(a,m,'flag',0,0,1,s)->>'status') IS DISTINCT FROM 'unauthorized' THEN
   RAISE EXCEPTION 'Banned account accepted'; END IF;
END;
$ban$;
RESET ROLE;
UPDATE auth.users SET banned_until=NULL, deleted_at=now() WHERE id='cce1b613-a3c2-4d1e-a6d6-b7defded2001';
SET LOCAL ROLE service_role;
DO $deleted$
BEGIN
 IF public.ranked_session_is_active('cce1b613-a3c2-4d1e-a6d6-b7defded2001','cce1b613-a3c2-4d1e-a6d6-b7defded2002') IS DISTINCT FROM false THEN
   RAISE EXCEPTION 'Deleted account accepted'; END IF;
END;
$deleted$;
RESET ROLE;
UPDATE auth.users SET deleted_at=NULL WHERE id='cce1b613-a3c2-4d1e-a6d6-b7defded2001';
DELETE FROM auth.sessions WHERE id='cce1b613-a3c2-4d1e-a6d6-b7defded2002';
SET LOCAL ROLE service_role;
DO $revoked$
DECLARE a uuid := 'cce1b613-a3c2-4d1e-a6d6-b7defded2001'; s uuid := 'cce1b613-a3c2-4d1e-a6d6-b7defded2002'; m uuid;
BEGIN
 SELECT id INTO STRICT m FROM public.ranked_matches WHERE user_id=a AND status='active';
 IF public.ranked_session_is_active(a,s) IS DISTINCT FROM false OR
    (public.execute_ranked_move(a,m,'flag',0,0,1,s)->>'status') IS DISTINCT FROM 'unauthorized' THEN
   RAISE EXCEPTION 'Revoked session accepted'; END IF;
 IF (SELECT move_count FROM public.ranked_matches WHERE id=m) IS DISTINCT FROM 1 THEN
   RAISE EXCEPTION 'Rejected requests changed board'; END IF;
END;
$revoked$;
RESET ROLE;
ROLLBACK;
SELECT 'Ranked session guard SQL checks passed' AS result;
