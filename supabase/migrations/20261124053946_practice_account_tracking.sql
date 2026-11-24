-- Batch 7B: account-recorded Practice outcomes, retained across history pruning.
-- Install using a NEW Supabase CLI-generated migration. This SQL intentionally has
-- no BEGIN/COMMIT so it can also be tested inside an outer ROLLBACK transaction.
-- First-seen outcome is immutable for accounting purposes; Practice is not verified.

DO $guard$
BEGIN
  IF to_regclass('public.practice_games') IS NULL
     OR to_regclass('public.practice_game_moves') IS NULL
  THEN
    RAISE EXCEPTION 'Practice persistence baseline is required before account tracking';
  END IF;
  IF to_regclass('public.practice_account_totals') IS NOT NULL
     OR to_regclass('practice_stats_internal.recorded_games') IS NOT NULL
  THEN
    RAISE EXCEPTION 'Practice account tracking is already installed; refusing duplicate migration';
  END IF;
END;
$guard$;

CREATE SCHEMA IF NOT EXISTS practice_stats_internal;
REVOKE ALL ON SCHEMA practice_stats_internal FROM PUBLIC, anon, authenticated;

-- Non-exposed deduplication ledger. Pruning/deleting original recordings never
-- erases this key, but deleting the auth account cascades into the ledger.
CREATE TABLE practice_stats_internal.recorded_games (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_record_id text NOT NULL CHECK (char_length(client_record_id) BETWEEN 1 AND 128),
  difficulty text NOT NULL CHECK (difficulty IN ('Beginner', 'Intermediate', 'Expert')),
  outcome text NOT NULL CHECK (outcome IN ('win', 'loss')),
  duration_seconds integer NOT NULL CHECK (duration_seconds >= 0),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, client_record_id)
);
ALTER TABLE practice_stats_internal.recorded_games ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON practice_stats_internal.recorded_games FROM PUBLIC, anon, authenticated;

-- The only browser-readable surface. Updates and deletes are trigger-owned.
CREATE TABLE public.practice_account_totals (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  difficulty text NOT NULL CHECK (difficulty IN ('Beginner', 'Intermediate', 'Expert')),
  games_played bigint NOT NULL DEFAULT 0 CHECK (games_played >= 0),
  wins bigint NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses bigint NOT NULL DEFAULT 0 CHECK (losses >= 0),
  fastest_win_seconds integer CHECK (fastest_win_seconds >= 0),
  tracking_activated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, difficulty),
  CONSTRAINT practice_account_totals_consistent CHECK (games_played = wins + losses)
);
ALTER TABLE public.practice_account_totals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.practice_account_totals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.practice_account_totals TO authenticated;
CREATE POLICY "Players can read their own tracked Practice totals"
  ON public.practice_account_totals FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- All currently complete retained recordings form the starting baseline.
-- Older records already pruned before this migration cannot be recovered.
LOCK TABLE public.practice_games, public.practice_game_moves IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO practice_stats_internal.recorded_games (
  user_id, client_record_id, difficulty, outcome, duration_seconds, recorded_at
)
SELECT g.user_id, g.client_record_id, g.difficulty, g.outcome,
       g.duration_seconds, g.created_at
FROM public.practice_games AS g
JOIN LATERAL (
  SELECT count(*) AS move_total,
         min(m.move_number) AS earliest,
         max(m.move_number) AS latest
  FROM public.practice_game_moves AS m
  WHERE m.game_id = g.id
) AS moves ON TRUE
WHERE moves.move_total = g.move_count
  AND moves.earliest = 1
  AND moves.latest = g.move_count
ON CONFLICT (user_id, client_record_id) DO NOTHING;

INSERT INTO public.practice_account_totals (
  user_id, difficulty, games_played, wins, losses, fastest_win_seconds
)
SELECT user_id, difficulty, count(*),
       count(*) FILTER (WHERE outcome = 'win'),
       count(*) FILTER (WHERE outcome = 'loss'),
       min(duration_seconds) FILTER (WHERE outcome = 'win')
FROM practice_stats_internal.recorded_games
GROUP BY user_id, difficulty;

-- Trigger fires after a move has been persisted. A game is counted only after
-- its complete sequence of numbered moves is saved, not on an incomplete game
-- header insert. The dedup ledger and aggregate update are atomic.
CREATE FUNCTION practice_stats_internal.record_complete_practice_game()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $record$
DECLARE
  game_row record;
  inserted_row record;
  move_total bigint;
  earliest integer;
  latest integer;
BEGIN
  SELECT g.id, g.user_id, g.client_record_id, g.difficulty,
         g.outcome, g.duration_seconds, g.move_count
    INTO game_row
    FROM public.practice_games AS g
    WHERE g.id = NEW.game_id
      AND g.user_id = auth.uid();
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF EXISTS (
    SELECT 1 FROM practice_stats_internal.recorded_games AS seen
    WHERE seen.user_id = game_row.user_id
      AND seen.client_record_id = game_row.client_record_id
  ) THEN
    RETURN NULL;
  END IF;

  -- Fast negative path: no expensive full-count scan until last numbered move
  -- exists, including when moves arrive in a different order.
  IF NOT EXISTS (
    SELECT 1 FROM public.practice_game_moves AS last_move
    WHERE last_move.game_id = game_row.id
      AND last_move.move_number = game_row.move_count
  ) THEN
    RETURN NULL;
  END IF;

  SELECT count(*), min(m.move_number), max(m.move_number)
    INTO move_total, earliest, latest
    FROM public.practice_game_moves AS m
    WHERE m.game_id = game_row.id;
  IF move_total <> game_row.move_count OR earliest <> 1 OR latest <> game_row.move_count
  THEN
    RETURN NULL;
  END IF;

  INSERT INTO practice_stats_internal.recorded_games (
    user_id, client_record_id, difficulty, outcome, duration_seconds
  )
  VALUES (
    game_row.user_id, game_row.client_record_id, game_row.difficulty,
    game_row.outcome, game_row.duration_seconds
  )
  ON CONFLICT (user_id, client_record_id) DO NOTHING
  RETURNING user_id, difficulty, outcome, duration_seconds INTO inserted_row;
  IF NOT FOUND THEN RETURN NULL; END IF;

  INSERT INTO public.practice_account_totals (
    user_id, difficulty, games_played, wins, losses, fastest_win_seconds
  )
  VALUES (
    inserted_row.user_id, inserted_row.difficulty, 1,
    CASE WHEN inserted_row.outcome = 'win' THEN 1 ELSE 0 END,
    CASE WHEN inserted_row.outcome = 'loss' THEN 1 ELSE 0 END,
    CASE WHEN inserted_row.outcome = 'win' THEN inserted_row.duration_seconds ELSE NULL END
  )
  ON CONFLICT (user_id, difficulty) DO UPDATE
  SET games_played = public.practice_account_totals.games_played + EXCLUDED.games_played,
      wins = public.practice_account_totals.wins + EXCLUDED.wins,
      losses = public.practice_account_totals.losses + EXCLUDED.losses,
      fastest_win_seconds = CASE
        WHEN public.practice_account_totals.fastest_win_seconds IS NULL THEN EXCLUDED.fastest_win_seconds
        WHEN EXCLUDED.fastest_win_seconds IS NULL THEN public.practice_account_totals.fastest_win_seconds
        ELSE LEAST(public.practice_account_totals.fastest_win_seconds, EXCLUDED.fastest_win_seconds)
      END;
  RETURN NULL;
END;
$record$;
REVOKE ALL ON FUNCTION practice_stats_internal.record_complete_practice_game() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER record_complete_practice_game_after_move
AFTER INSERT OR UPDATE ON public.practice_game_moves
FOR EACH ROW EXECUTE FUNCTION practice_stats_internal.record_complete_practice_game();
