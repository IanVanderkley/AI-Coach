-- AI-Coach Batch 12, STAGING FIRST: public-by-default for NEW Ranked profiles.
-- Existing rows (including manually selected Anonymous mode) are NOT changed.
-- Separate from existing 20261124072607_ranked_elo_visibility migration.
-- Verified match triggers still own rating and XP. This migration changes no scores.

DO $$
BEGIN
  IF to_regclass('public.ranked_leaderboard_profiles') IS NULL
     OR to_regclass('public.ranked_elo_events') IS NULL
     OR to_regclass('public.ranked_matches') IS NULL THEN
    RAISE EXCEPTION 'Batch 11 Ranked rating tables must exist first';
  END IF;
END;
$$;

-- The existing profile check requires a non-null public username.
-- When the trusted Ranked completion trigger inserts a new profile with
-- no username, supply a valid public name before CHECK constraints run.
-- Prefer the registered username when valid/unused; otherwise issue a
-- random public display alias (not a user's email, UUID, or match ID).
CREATE FUNCTION ranked_internal.choose_default_public_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_preferred text;
BEGIN
  IF new.is_anonymous = false AND new.username IS NULL THEN
    SELECT u.raw_user_meta_data ->> 'username' INTO v_preferred
      FROM auth.users AS u WHERE u.id = new.user_id;

    IF v_preferred ~ '^[A-Za-z0-9_]{3,20}$' THEN
      -- Prevent concurrent new players from claiming the same registered name.
      PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(pg_catalog.lower(v_preferred)));
      IF NOT EXISTS (
        SELECT 1 FROM public.ranked_leaderboard_profiles p
         WHERE NOT p.is_anonymous
           AND pg_catalog.lower(p.username) = pg_catalog.lower(v_preferred)
      ) THEN
        new.username := v_preferred;
      END IF;
    END IF;

    IF new.username IS NULL THEN
      -- The random alias is just a public display label, never an identity key.
      -- Keep a valid 3..20 character name without leaking personal details.
      LOOP
        new.username := 'Player' || pg_catalog.substr(
          pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 14
        );
        EXIT WHEN NOT EXISTS (
          SELECT 1 FROM public.ranked_leaderboard_profiles p
           WHERE NOT p.is_anonymous
             AND pg_catalog.lower(p.username) = pg_catalog.lower(new.username)
        );
      END LOOP;
    END IF;
  END IF;
  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION ranked_internal.choose_default_public_name()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER choose_default_ranked_public_name
  BEFORE INSERT ON public.ranked_leaderboard_profiles
  FOR EACH ROW
  EXECUTE FUNCTION ranked_internal.choose_default_public_name();

-- Only future newly inserted rows use this default.
-- Explicit `is_anonymous=true` choices and existing rows remain unchanged.
ALTER TABLE public.ranked_leaderboard_profiles
  ALTER COLUMN is_anonymous SET DEFAULT false;
