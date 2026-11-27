-- Compact derived grades only. No Elo, XP, gameplay or saved coaching-report writes.
BEGIN;
CREATE TABLE public.ranked_history_grades (
  match_id uuid NOT NULL REFERENCES public.ranked_matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_version integer NOT NULL CHECK (analysis_version > 0),
  score integer,
  grade text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, analysis_version),
  CONSTRAINT ranked_history_grade_consistency CHECK (
    CASE WHEN score IS NULL THEN grade IS NULL
      ELSE score BETWEEN 0 AND 100 AND grade IS NOT NULL AND grade = CASE
        WHEN score >= 90 THEN 'S' WHEN score >= 78 THEN 'A'
        WHEN score >= 65 THEN 'B' WHEN score >= 50 THEN 'C' ELSE 'D' END END
  )
);
CREATE INDEX ranked_history_grades_owner_idx ON public.ranked_history_grades(user_id);
ALTER TABLE public.ranked_history_grades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ranked_history_grades FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.ranked_history_grades TO service_role;

-- Defend the cache boundary independently of the route's verified replay reader.
CREATE FUNCTION ranked_internal.validate_history_grade_source()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.ranked_matches m WHERE m.id = NEW.match_id
      AND m.user_id = NEW.user_id AND m.rows = 16 AND m.columns = 16 AND m.mine_count = 40
      AND m.finished_at IS NOT NULL AND m.duration_ms IS NOT NULL AND m.duration_ms >= 0
      AND m.move_count BETWEEN 1 AND 1000
      AND (m.status = 'lost' OR (m.status = 'won' AND EXISTS (
        SELECT 1 FROM public.ranked_verified_results r WHERE r.match_id = m.id AND r.user_id = m.user_id
          AND r.board_rows = 16 AND r.board_columns = 16 AND r.mine_count = 40
          AND r.duration_ms = m.duration_ms AND r.finished_at = m.finished_at
      )))
  ) THEN RAISE EXCEPTION 'Invalid Ranked history grade source'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION ranked_internal.validate_history_grade_source() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER validate_ranked_history_grade_source BEFORE INSERT ON public.ranked_history_grades
FOR EACH ROW EXECUTE FUNCTION ranked_internal.validate_history_grade_source();

-- Separate expensive-work quota; one bounded counter row per account.
CREATE TABLE public.ranked_history_grade_counters (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket_start timestamptz NOT NULL,
  usage_count integer NOT NULL CHECK (usage_count BETWEEN 1 AND 12)
);
ALTER TABLE public.ranked_history_grade_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ranked_history_grade_counters FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ranked_history_grade_counters TO service_role;
CREATE FUNCTION public.reserve_ranked_history_grade(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  bucket timestamptz := pg_catalog.date_trunc('minute', pg_catalog.clock_timestamp());
  admitted boolean;
BEGIN
  IF p_user_id IS NULL THEN RETURN false; END IF;
  INSERT INTO public.ranked_history_grade_counters AS c (user_id, bucket_start, usage_count)
  VALUES (p_user_id, bucket, 1)
  ON CONFLICT (user_id) DO UPDATE SET bucket_start = EXCLUDED.bucket_start,
    usage_count = CASE WHEN c.bucket_start < EXCLUDED.bucket_start THEN 1 ELSE c.usage_count + 1 END
  WHERE c.bucket_start < EXCLUDED.bucket_start OR (c.bucket_start = EXCLUDED.bucket_start AND c.usage_count < 12)
  RETURNING true INTO admitted;
  RETURN coalesce(admitted, false);
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_ranked_history_grade(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reserve_ranked_history_grade(uuid) TO service_role;
COMMIT;
