-- Batch 23G.3a: change only the default for future Ranked profiles.
-- Existing ratings, privacy choices and receipt history remain unchanged.
DO $migration$
BEGIN
  IF pg_catalog.to_regprocedure('ranked_internal.rating_delta_v2(integer,text)') IS NULL THEN
    RAISE EXCEPTION 'Ranked policy v2 migration must be installed first';
  END IF;
  ALTER TABLE public.ranked_leaderboard_profiles
    ALTER COLUMN rating SET DEFAULT 1600;
END;
$migration$;
