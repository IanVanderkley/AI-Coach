-- Account usernames share the existing leaderboard profile identity. No score changes.
-- All names (including anonymous accounts) are unique, case-insensitively.
-- Existing names and visibility choices are preserved; no cooldown on migration.
DO $migration$
BEGIN
  LOCK TABLE auth.users IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.ranked_leaderboard_profiles IN SHARE ROW EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM public.ranked_leaderboard_profiles WHERE username IS NOT NULL GROUP BY lower(username) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate legacy usernames: resolve explicitly before installing username changes';
  END IF;
  ALTER TABLE public.ranked_leaderboard_profiles ADD COLUMN username_changed_at timestamptz;
  CREATE UNIQUE INDEX ranked_account_username_unique ON public.ranked_leaderboard_profiles (lower(username)) WHERE username IS NOT NULL;

CREATE FUNCTION ranked_internal.allocate_account_username(p_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE candidate text;
BEGIN
  SELECT username INTO candidate FROM public.ranked_leaderboard_profiles WHERE user_id = p_user_id;
  IF candidate IS NOT NULL THEN RETURN candidate; END IF;
  SELECT raw_user_meta_data ->> 'username' INTO candidate FROM auth.users WHERE id = p_user_id;
  IF candidate ~ '^[A-Za-z0-9_]{3,20}$' THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.lower(candidate), 22104));
    IF NOT EXISTS (SELECT 1 FROM public.ranked_leaderboard_profiles WHERE pg_catalog.lower(username) = pg_catalog.lower(candidate)) THEN RETURN candidate; END IF;
  END IF;
  LOOP
    candidate := 'Player' || pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 14);
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.lower(candidate), 22104));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.ranked_leaderboard_profiles WHERE pg_catalog.lower(username) = pg_catalog.lower(candidate));
  END LOOP;
  RETURN candidate;
END;
$$;
REVOKE ALL ON FUNCTION ranked_internal.allocate_account_username(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Replace only the default-name trigger function. Existing Elo triggers are untouched.
CREATE OR REPLACE FUNCTION ranked_internal.choose_default_public_name()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.username IS NULL THEN
    NEW.username := ranked_internal.allocate_account_username(NEW.user_id);
  ELSE
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.lower(NEW.username), 22104));
  END IF;
  NEW.username_changed_at := NULL;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION ranked_internal.choose_default_public_name() FROM PUBLIC, anon, authenticated, service_role;

-- Initialize a name for legacy unnamed private rows and confirmed accounts with no profile.
UPDATE public.ranked_leaderboard_profiles SET username = ranked_internal.allocate_account_username(user_id) WHERE username IS NULL;
INSERT INTO public.ranked_leaderboard_profiles (user_id)
SELECT id FROM auth.users WHERE email_confirmed_at IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;
ALTER TABLE public.ranked_leaderboard_profiles ALTER COLUMN username SET NOT NULL;

-- Enforce the cooldown on every write path, including an older deployed API.
-- Timestamp is server-owned. Case-only changes count; exact no-ops do not.
CREATE FUNCTION ranked_internal.guard_account_username_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.username_changed_at := OLD.username_changed_at;
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    IF NEW.username IS NULL OR NEW.username !~ '^[A-Za-z0-9_]{3,20}$' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid username';
    END IF;
    IF OLD.username_changed_at IS NOT NULL AND OLD.username_changed_at + interval '720 hours' > pg_catalog.clock_timestamp() THEN
      RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'Username change cooldown active';
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.lower(NEW.username), 22104));
    NEW.username_changed_at := pg_catalog.clock_timestamp();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION ranked_internal.guard_account_username_change() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER guard_account_username_change BEFORE UPDATE ON public.ranked_leaderboard_profiles FOR EACH ROW EXECUTE FUNCTION ranked_internal.guard_account_username_change();

-- Reserve a canonical name on email confirmation. A requested name that is
-- already reserved receives a random alias instead of breaking authentication.
-- Users may immediately rename that alias in Account settings.
CREATE FUNCTION ranked_internal.initialize_confirmed_account_username()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.ranked_leaderboard_profiles (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION ranked_internal.initialize_confirmed_account_username() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER initialize_confirmed_account_username AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW EXECUTE FUNCTION ranked_internal.initialize_confirmed_account_username();
END;
$migration$;
