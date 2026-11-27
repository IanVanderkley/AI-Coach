-- Account-private learning snapshots. Never used for Ranked Elo or XP.
BEGIN;
CREATE TABLE public.coaching_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('practice', 'ranked')),
  game_ref text NOT NULL CHECK (char_length(game_ref) BETWEEN 1 AND 128),
  practice_game_id uuid REFERENCES public.practice_games(id) ON DELETE CASCADE,
  ranked_match_id uuid REFERENCES public.ranked_matches(id) ON DELETE CASCADE,
  analysis_version integer NOT NULL CHECK (analysis_version > 0),
  difficulty text NOT NULL CHECK (difficulty IN ('Beginner','Intermediate','Expert')),
  outcome text NOT NULL CHECK (outcome IN ('win','loss')),
  completed_at timestamptz NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  recording_hash text NOT NULL CHECK (recording_hash ~ '^[0-9a-f]{64}$'),
  review jsonb NOT NULL CHECK (jsonb_typeof(review) = 'object' AND octet_length(review::text) <= 65536),
  CONSTRAINT coaching_review_source CHECK (
    (mode = 'practice' AND practice_game_id IS NOT NULL AND ranked_match_id IS NULL)
    OR (mode = 'ranked' AND ranked_match_id IS NOT NULL AND practice_game_id IS NULL
        AND game_ref = ranked_match_id::text)
  ),
  UNIQUE (user_id, mode, game_ref, analysis_version)
);
CREATE INDEX coaching_reviews_recent_idx
  ON public.coaching_reviews (user_id, mode, analysis_version, completed_at DESC, id DESC);
CREATE INDEX coaching_reviews_practice_fk_idx ON public.coaching_reviews(practice_game_id);
CREATE INDEX coaching_reviews_ranked_fk_idx ON public.coaching_reviews(ranked_match_id);
ALTER TABLE public.coaching_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coaching_reviews FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.coaching_reviews TO service_role;

-- Bound expensive report generation independently of the existing Ranked read bucket.
CREATE TABLE public.coaching_review_save_counters (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket_start timestamptz NOT NULL,
  usage_count integer NOT NULL CHECK (usage_count BETWEEN 1 AND 6)
);
ALTER TABLE public.coaching_review_save_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coaching_review_save_counters FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.coaching_review_save_counters TO service_role;
CREATE FUNCTION public.reserve_coaching_review_save(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  bucket timestamptz := pg_catalog.date_trunc('minute', pg_catalog.clock_timestamp());
  admitted boolean;
BEGIN
  IF p_user_id IS NULL THEN RETURN false; END IF;
  INSERT INTO public.coaching_review_save_counters AS c (user_id, bucket_start, usage_count)
  VALUES (p_user_id, bucket, 1)
  ON CONFLICT (user_id) DO UPDATE SET
    bucket_start = EXCLUDED.bucket_start,
    usage_count = CASE WHEN c.bucket_start < EXCLUDED.bucket_start THEN 1 ELSE c.usage_count + 1 END
  WHERE c.bucket_start < EXCLUDED.bucket_start
    OR (c.bucket_start = EXCLUDED.bucket_start AND c.usage_count < 6)
  RETURNING true INTO admitted;
  RETURN coalesce(admitted, false);
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_coaching_review_save(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reserve_coaching_review_save(uuid) TO service_role;
COMMIT;
