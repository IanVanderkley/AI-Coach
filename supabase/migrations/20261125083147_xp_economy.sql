-- New rewards only. Historical receipts and balances remain untouched.
-- Deploy the compatible frontend BEFORE applying remotely.
BEGIN;
ALTER TABLE xp_internal.player_xp_ledger DROP CONSTRAINT player_xp_ledger_verified_reward_check;
ALTER TABLE xp_internal.player_xp_ledger ADD CONSTRAINT player_xp_ledger_verified_reward_check CHECK (
  (event_type = 'ranked_verified_win' AND amount IN (125, 210)) OR
  (event_type = 'ranked_verified_loss' AND amount IN (10, 17))
);
ALTER TABLE public.player_xp_match_receipts DROP CONSTRAINT player_xp_match_receipts_check;
ALTER TABLE public.player_xp_match_receipts ADD CONSTRAINT player_xp_match_receipts_amount_check CHECK (
  (outcome = 'won' AND amount IN (125, 210)) OR (outcome = 'lost' AND amount IN (10, 17))
);
create or replace function xp_internal.award_verified_ranked_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted_match uuid;
begin
  -- Do not trust input from an API call. This trigger only runs on rows
  -- written by the existing server-verified Ranked completion mechanism.
  if new.match_id is null or new.user_id is null then
    raise exception 'Invalid verified Ranked XP source';
  end if;

  insert into xp_internal.player_xp_ledger (
    source_match_id, user_id, event_type, amount
  ) values (
    new.match_id, new.user_id, 'ranked_verified_win', 210
  ) on conflict (source_match_id) do nothing
    returning source_match_id into v_inserted_match;

  if v_inserted_match is null then
    return new;
  end if;

  insert into public.player_xp_profiles (user_id, total_xp)
  values (new.user_id, 210)
  on conflict (user_id) do update
    set total_xp = public.player_xp_profiles.total_xp + excluded.total_xp,
        updated_at = now();
  return new;
end;
$$;
REVOKE ALL ON FUNCTION xp_internal.award_verified_ranked_xp() FROM PUBLIC, anon, authenticated, service_role;
create or replace function xp_internal.award_verified_ranked_loss_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.ranked_matches%rowtype;
  v_state public.ranked_match_state%rowtype;
  v_position integer;
  v_verified_loss boolean := false;
  v_recorded_match uuid;
begin
  if new.action not in ('reveal', 'chord')
     or new.move_number < 2
     or new.row_index not between 0 and 15
     or new.column_index not between 0 and 15 then
    return new;
  end if;

  select * into v_match from public.ranked_matches
  where id = new.match_id and status = 'lost'
    and move_count = new.move_number
    and rows = 16 and columns = 16 and mine_count = 40
    and finished_at is not null and started_at is not null
    and finished_at >= started_at and duration_ms is not null and duration_ms >= 0;
  if not found then return new; end if;

  select * into v_state from public.ranked_match_state
  where match_id = new.match_id and first_move_done is true
    and mine_positions is not null
    and cardinality(mine_positions) = 40;
  if not found then return new; end if;
  if (select count(distinct x) from unnest(v_state.mine_positions) as mine(x)) <> 40 then
    return new;
  end if;
  if exists (
    select 1 from unnest(v_state.mine_positions) as mine(x)
    where x is null or x not between 0 and 255
  ) then return new; end if;

  v_position := new.row_index * 16 + new.column_index;
  if new.action = 'reveal' then
    -- Direct reveal: the exact server-recorded clicked cell must be a mine.
    v_verified_loss := v_position = any(v_state.mine_positions)
      and not (v_position = any(v_state.flagged_positions));
  elsif new.action = 'chord' then
    -- Chord loss: a revealed numbered center had matching nearby flags but
    -- at least one adjacent mine was unflagged and therefore got triggered.
    v_verified_loss :=
      v_position = any(v_state.revealed_positions)
      and (
        select count(*) from unnest(v_state.flagged_positions) as flag(x)
        where abs(x / 16 - new.row_index) <= 1
          and abs(x % 16 - new.column_index) <= 1
      ) = (
        select count(*) from unnest(v_state.mine_positions) as mine(x)
        where abs(x / 16 - new.row_index) <= 1
          and abs(x % 16 - new.column_index) <= 1
      )
      and exists (
        select 1 from unnest(v_state.mine_positions) as mine(x)
        where abs(x / 16 - new.row_index) <= 1
          and abs(x % 16 - new.column_index) <= 1
          and not (x = any(v_state.flagged_positions))
      );
  end if;
  if not coalesce(v_verified_loss, false) then return new; end if;

  -- The same source_match_id primary key protects against duplicate awards.
  insert into xp_internal.player_xp_ledger (source_match_id, user_id, event_type, amount)
  values (new.match_id, v_match.user_id, 'ranked_verified_loss', 17)
  on conflict (source_match_id) do nothing
  returning source_match_id into v_recorded_match;

  if v_recorded_match is not null then
    insert into public.player_xp_profiles (user_id, total_xp)
    values (v_match.user_id, 17)
    on conflict (user_id) do update
      set total_xp = public.player_xp_profiles.total_xp + excluded.total_xp,
          updated_at = now();
  end if;
  return new;
end;
$$;
REVOKE ALL ON FUNCTION xp_internal.award_verified_ranked_loss_xp() FROM PUBLIC, anon, authenticated, service_role;
-- Practice is client-recorded, not competitive proof. No historical backfill.
-- First recorded game identity is immutable in practice_stats_internal.recorded_games.
CREATE TABLE public.player_practice_xp_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_record_id text NOT NULL CHECK (char_length(client_record_id) BETWEEN 1 AND 128),
  difficulty text NOT NULL CHECK (difficulty IN ('Beginner','Intermediate','Expert')),
  outcome text NOT NULL CHECK (outcome IN ('win','loss')),
  amount integer NOT NULL,
  reason text NOT NULL CHECK (reason IN ('earned','participation','daily_limit')),
  awarded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, client_record_id),
  CHECK ((reason <> 'earned' AND amount = 0) OR
    (reason = 'earned' AND amount = CASE difficulty
      WHEN 'Beginner' THEN CASE outcome WHEN 'win' THEN 25 ELSE 5 END
      WHEN 'Intermediate' THEN CASE outcome WHEN 'win' THEN 50 ELSE 10 END
      WHEN 'Expert' THEN CASE outcome WHEN 'win' THEN 75 ELSE 15 END END))
);
ALTER TABLE public.player_practice_xp_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_practice_xp_receipts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.player_practice_xp_receipts TO authenticated;
CREATE POLICY "Players read only their Practice XP receipts"
  ON public.player_practice_xp_receipts FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE TABLE xp_internal.practice_daily_xp (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket_day date NOT NULL,
  amount integer NOT NULL CHECK (amount BETWEEN 1 AND 300)
);
ALTER TABLE xp_internal.practice_daily_xp ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON xp_internal.practice_daily_xp FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION xp_internal.award_recorded_practice_xp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $practice_xp$
DECLARE
  g public.practice_games%ROWTYPE;
  v_amount integer := 0;
  v_reason text := 'participation';
  v_day date := (pg_catalog.transaction_timestamp() AT TIME ZONE 'UTC')::date;
  v_reserved integer;
  v_actions bigint;
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN RETURN NEW; END IF;
  SELECT * INTO g FROM public.practice_games
    WHERE user_id = NEW.user_id AND client_record_id = NEW.client_record_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  -- The existing tracking trigger only inserts its first complete numbered sequence.
  -- Check canonical dimensions, nonempty reveals and checkpoint-shaped recordings.
  IF g.difficulty = NEW.difficulty AND g.outcome = NEW.outcome AND
     ((g.difficulty = 'Beginner' AND g.rows = 9 AND g.columns = 9 AND g.mine_count = 10) OR
      (g.difficulty = 'Intermediate' AND g.rows = 16 AND g.columns = 16 AND g.mine_count = 40) OR
      (g.difficulty = 'Expert' AND g.rows = 16 AND g.columns = 30 AND g.mine_count = 99)) AND
     g.move_count <= 5000 AND
     NOT EXISTS (SELECT 1 FROM public.practice_game_moves m WHERE m.game_id = g.id
       AND (m."row" >= g.rows OR m."column" >= g.columns OR m.after_hash IS NULL)) AND
     EXISTS (SELECT 1 FROM public.practice_game_moves m WHERE m.game_id = g.id AND m.action_type = 'reveal') THEN
    SELECT count(DISTINCT (m."row", m."column")) INTO v_actions
      FROM public.practice_game_moves m WHERE m.game_id = g.id AND m.action_type IN ('reveal','chord');
    IF NEW.outcome = 'win' OR (NEW.duration_seconds >= 15 AND v_actions >= 3) THEN
      v_amount := CASE NEW.difficulty
        WHEN 'Beginner' THEN CASE NEW.outcome WHEN 'win' THEN 25 ELSE 5 END
        WHEN 'Intermediate' THEN CASE NEW.outcome WHEN 'win' THEN 50 ELSE 10 END
        WHEN 'Expert' THEN CASE NEW.outcome WHEN 'win' THEN 75 ELSE 15 END END;
      -- Atomic per-account UTC-day reservation; no more than one counter row per user.
      INSERT INTO xp_internal.practice_daily_xp AS c (user_id, bucket_day, amount)
        VALUES (NEW.user_id, v_day, v_amount)
      ON CONFLICT (user_id) DO UPDATE SET bucket_day = EXCLUDED.bucket_day,
        amount = CASE WHEN c.bucket_day < EXCLUDED.bucket_day THEN EXCLUDED.amount
                      ELSE c.amount + EXCLUDED.amount END
      WHERE c.bucket_day < EXCLUDED.bucket_day OR
        (c.bucket_day = EXCLUDED.bucket_day AND c.amount + EXCLUDED.amount <= 300)
      RETURNING amount INTO v_reserved;
      IF v_reserved IS NULL THEN v_amount := 0; v_reason := 'daily_limit';
      ELSE v_reason := 'earned'; END IF;
    END IF;
  END IF;
  -- The source ledger's unique key prevents re-awarding even after history pruning.
  -- A receipt, quota and account balance are committed together; never accept XP from the browser.
  INSERT INTO public.player_practice_xp_receipts (user_id, client_record_id, difficulty, outcome, amount, reason)
    VALUES (NEW.user_id, NEW.client_record_id, NEW.difficulty, NEW.outcome, v_amount, v_reason);
  IF v_amount > 0 THEN
    INSERT INTO public.player_xp_profiles (user_id, total_xp) VALUES (NEW.user_id, v_amount)
    ON CONFLICT (user_id) DO UPDATE SET total_xp = public.player_xp_profiles.total_xp + EXCLUDED.total_xp,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$practice_xp$;
REVOKE ALL ON FUNCTION xp_internal.award_recorded_practice_xp() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER award_recorded_practice_xp_after_insert
  AFTER INSERT ON practice_stats_internal.recorded_games
  FOR EACH ROW EXECUTE FUNCTION xp_internal.award_recorded_practice_xp();

COMMIT;
