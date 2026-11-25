-- Batch 22D follow-up: moderate canonical names, without touching progression.
-- Atomic migration; previous username migration stays unchanged.
DO $migration$
DECLARE
  affected record;
  replacement text;
BEGIN
  LOCK TABLE auth.users IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.ranked_leaderboard_profiles IN SHARE ROW EXCLUSIVE MODE;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.ranked_leaderboard_profiles'::regclass AND tgname='guard_account_username_change' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Username changes migration required first';
  END IF;

CREATE FUNCTION ranked_internal.username_content_allowed(value text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = '' AS $policy$
DECLARE
  raw text := pg_catalog.lower(value);
  compact text := pg_catalog.replace(raw, '_', '');
  variant text;
  part text;
  stripped text;
  word text;
  blocked_substrings constant text[] := ARRAY['fuck','shit','bitch','cunt','whore','slut','asshole','arsehole','dickhead','cockhead','dickface','cocksucker','dickwad','dumbass','jackass','smartass','piss','bollocks','bastard','wanker','nigger','nigga','faggot','fagot','kike','chink','wetback','gook','raghead','towelhead','sandnigger','tranny','retard','beaner','zipperhead','heilhitler','whitepower'];
  blocked_tokens constant text[] := ARRAY['ass','arse','damn','hell','dick','cock','tit','tits','twat','fag','homo','jap','spic','coon','dyke','nazi','wop','paki','chode','prick'];
BEGIN
  FOREACH variant IN ARRAY ARRAY[compact, pg_catalog.translate(compact,'01345789','oieastbg'), pg_catalog.translate(compact,'01345789','oleastbg')] LOOP
    FOREACH word IN ARRAY blocked_substrings LOOP
      IF pg_catalog.strpos(variant,word)>0 OR pg_catalog.strpos(pg_catalog.regexp_replace(variant, '(.)\1+', '\1','g'), pg_catalog.regexp_replace(word, '(.)\1+', '\1','g'))>0 THEN RETURN false; END IF;
    END LOOP;
  END LOOP;
  FOREACH part IN ARRAY (pg_catalog.regexp_split_to_array(raw,'_+') || ARRAY[compact]) LOOP
    stripped := pg_catalog.regexp_replace(part, '^[0-9]+|[0-9]+$', '', 'g');
    FOREACH variant IN ARRAY ARRAY[stripped, pg_catalog.translate(stripped,'01345789','oieastbg'), pg_catalog.translate(stripped,'01345789','oleastbg')] LOOP
      FOREACH word IN ARRAY blocked_tokens LOOP
        IF variant=word OR pg_catalog.regexp_replace(variant, '(.)\1+', '\1','g')=pg_catalog.regexp_replace(word, '(.)\1+', '\1','g') THEN RETURN false; END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  RETURN true;
END;
$policy$;
REVOKE ALL ON FUNCTION ranked_internal.username_content_allowed(text) FROM PUBLIC, anon, authenticated, service_role;

-- Existing names are retained unless blocked; only moderation replacements reset cooldown.
-- The table locks and transactional trigger disable prevent concurrent bypass.
ALTER TABLE public.ranked_leaderboard_profiles DISABLE TRIGGER guard_account_username_change;
FOR affected IN SELECT user_id FROM public.ranked_leaderboard_profiles WHERE NOT ranked_internal.username_content_allowed(username) ORDER BY user_id LOOP
  LOOP
    replacement := 'Player' || pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-',''),1,14);
    EXIT WHEN ranked_internal.username_content_allowed(replacement) AND NOT EXISTS (SELECT 1 FROM public.ranked_leaderboard_profiles WHERE pg_catalog.lower(username)=pg_catalog.lower(replacement));
  END LOOP;
  UPDATE public.ranked_leaderboard_profiles SET username=replacement, username_changed_at=NULL WHERE user_id=affected.user_id;
END LOOP;
ALTER TABLE public.ranked_leaderboard_profiles ENABLE TRIGGER guard_account_username_change;

-- Raw auth metadata is not authoritative. Direct registration clients may supply
-- any metadata, but unacceptable requested names are never assigned to profiles.
CREATE OR REPLACE FUNCTION ranked_internal.allocate_account_username(p_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $allocate$
DECLARE candidate text;
BEGIN
  SELECT username INTO candidate FROM public.ranked_leaderboard_profiles WHERE user_id=p_user_id;
  IF candidate IS NOT NULL THEN RETURN candidate; END IF;
  SELECT raw_user_meta_data ->> 'username' INTO candidate FROM auth.users WHERE id=p_user_id;
  IF candidate ~ '^[A-Za-z0-9_]{3,20}$' AND ranked_internal.username_content_allowed(candidate) THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.lower(candidate),22104));
    IF NOT EXISTS (SELECT 1 FROM public.ranked_leaderboard_profiles WHERE pg_catalog.lower(username)=pg_catalog.lower(candidate)) THEN RETURN candidate; END IF;
  END IF;
  LOOP
    candidate := 'Player' || pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-',''),1,14);
    IF NOT ranked_internal.username_content_allowed(candidate) THEN CONTINUE; END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.lower(candidate),22104));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.ranked_leaderboard_profiles WHERE pg_catalog.lower(username)=pg_catalog.lower(candidate));
  END LOOP;
  RETURN candidate;
END;
$allocate$;
REVOKE ALL ON FUNCTION ranked_internal.allocate_account_username(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Fires after choose_default_ranked_public_name on INSERT and before the
-- cooldown guard on UPDATE. No new public RPC or client write privileges.
CREATE FUNCTION ranked_internal.enforce_account_username_content()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $guard$
BEGIN
  IF NEW.username IS NULL OR NOT ranked_internal.username_content_allowed(NEW.username) THEN
    RAISE EXCEPTION USING ERRCODE='PT422', MESSAGE='Username content is not allowed';
  END IF;
  RETURN NEW;
END;
$guard$;
REVOKE ALL ON FUNCTION ranked_internal.enforce_account_username_content() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER enforce_account_username_content BEFORE INSERT OR UPDATE OF username ON public.ranked_leaderboard_profiles FOR EACH ROW EXECUTE FUNCTION ranked_internal.enforce_account_username_content();
END;
$migration$;
