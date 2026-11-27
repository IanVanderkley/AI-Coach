-- Batch 26B.3: verified final 50/50 compensation. LOCAL FIRST.
BEGIN;
LOCK TABLE ranked_internal.release_maintenance IN ACCESS EXCLUSIVE MODE;
DO $guard$
BEGIN
  IF (SELECT prosrc FROM pg_catalog.pg_proc WHERE oid = pg_catalog.to_regprocedure('ranked_internal.apply_verified_match_rating(uuid)')) IS DISTINCT FROM $reviewed$
declare
  v_match record;
  v_rating integer;
  v_change integer;
  v_after integer;
  v_inserted uuid;
begin
  select id, user_id, status, rows, columns, mine_count, started_at,
         finished_at, duration_ms
    into v_match
  from public.ranked_matches
  where id = p_match_id;

  if not found or v_match.status not in ('won', 'lost')
     or v_match.rows <> 16 or v_match.columns <> 16
     or v_match.mine_count <> 40 or v_match.finished_at is null
     or v_match.started_at is null
     or v_match.finished_at < v_match.started_at
     or v_match.duration_ms is null or v_match.duration_ms < 0 then
    return;
  end if;

  if v_match.status = 'won' and not exists (
    select 1 from public.ranked_verified_results r
     where r.match_id = v_match.id and r.user_id = v_match.user_id
       and r.board_rows = 16 and r.board_columns = 16 and r.mine_count = 40
  ) then
    return;
  end if;

  insert into public.ranked_leaderboard_profiles (user_id)
    values (v_match.user_id) on conflict (user_id) do nothing;

  -- Serialise concurrent completions for the same account. Duplicate match IDs
  -- cannot pay twice, including a retried request or backfill rerun.
  select rating into v_rating
  from public.ranked_leaderboard_profiles
  where user_id = v_match.user_id
  for update;

  if exists (select 1 from public.ranked_elo_events where match_id = v_match.id) then
    return;
  end if;

  -- Policy v4 applies to newly recorded completions only.
  select r.rating_delta, r.rating_after into strict v_change, v_after
  from ranked_internal.calculate_rating_v4(v_rating, v_match.status) r;

  insert into public.ranked_elo_events (
    match_id, user_id, outcome, rating_before, rating_delta, rating_after, policy_version
  ) values (
    v_match.id, v_match.user_id, v_match.status, v_rating, v_change, v_after, 4
  ) on conflict (match_id) do nothing returning match_id into v_inserted;

  if v_inserted is null then
    return;
  end if;

  update public.ranked_leaderboard_profiles
  set rating = v_after,
      games = games + 1,
      wins = wins + (case when v_match.status = 'won' then 1 else 0 end),
      losses = losses + (case when v_match.status = 'lost' then 1 else 0 end),
      last_ranked_at = greatest(coalesce(last_ranked_at, v_match.finished_at),
                               v_match.finished_at),
      updated_at = now()
  where user_id = v_match.user_id;
end;
$reviewed$ THEN RAISE EXCEPTION 'Unexpected v4 settlement function'; END IF;
  IF (SELECT prosrc FROM pg_catalog.pg_proc WHERE oid = pg_catalog.to_regprocedure('ranked_internal.record_ranked_elo()')) IS DISTINCT FROM $trigger$
begin
  if old.status = 'active' and new.status in ('won', 'lost') then
    perform ranked_internal.apply_verified_match_rating(new.id);
  end if;
  return new;
end;
$trigger$ THEN RAISE EXCEPTION 'Unexpected Elo status trigger function'; END IF;
  IF pg_catalog.to_regprocedure('ranked_internal.prove_final_guess_loss_v1(integer[],integer[],integer,integer)') IS NULL THEN RAISE EXCEPTION 'Missing private final guess proof'; END IF;
  IF NOT EXISTS (SELECT 1 FROM ranked_internal.release_maintenance WHERE singleton AND required_policy_version = 4) THEN RAISE EXCEPTION 'Unexpected Ranked write contract'; END IF;
END;
$guard$;
ALTER TABLE public.ranked_elo_events
  ADD COLUMN final_guess_compensated boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT ranked_elo_final_guess_check CHECK (NOT final_guess_compensated OR (policy_version = 4 AND outcome = 'lost' AND rating_delta BETWEEN 0 AND 80));
ALTER TABLE ranked_internal.release_maintenance
  DROP CONSTRAINT release_maintenance_required_policy_version_check,
  ADD CONSTRAINT release_maintenance_required_policy_version_check CHECK (required_policy_version IN (3,4,5));
UPDATE ranked_internal.release_maintenance SET required_policy_version = 5 WHERE singleton;
create or replace function ranked_internal.apply_verified_match_rating(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match record;
  v_rating integer;
  v_change integer;
  v_after integer;
  v_inserted uuid;
  v_final_guess boolean := false;
  v_first integer;
  v_target integer;
  v_nominal integer;
begin
  select id, user_id, status, rows, columns, mine_count, started_at,
         finished_at, duration_ms, move_count
    into v_match
  from public.ranked_matches
  where id = p_match_id;

  if not found or v_match.status not in ('won', 'lost')
     or v_match.rows <> 16 or v_match.columns <> 16
     or v_match.mine_count <> 40 or v_match.finished_at is null
     or v_match.started_at is null
     or v_match.finished_at < v_match.started_at
     or v_match.duration_ms is null or v_match.duration_ms < 0 then
    return;
  end if;

  if v_match.status = 'won' and not exists (
    select 1 from public.ranked_verified_results r
     where r.match_id = v_match.id and r.user_id = v_match.user_id
       and r.board_rows = 16 and r.board_columns = 16 and r.mine_count = 40
  ) then
    return;
  end if;

  -- Losses settle only after the terminal move is recorded. Wins retain the
  -- verified-results trigger. Never award a loss from the earlier status trigger.
  if v_match.status = 'lost' and not exists (
    select 1 from public.ranked_match_moves m
    where m.match_id = v_match.id and m.move_number = v_match.move_count
      and m.action in ('reveal', 'chord')
  ) then
    return;
  end if;

  insert into public.ranked_leaderboard_profiles (user_id)
    values (v_match.user_id) on conflict (user_id) do nothing;

  -- Serialise concurrent completions for the same account. Duplicate match IDs
  -- cannot pay twice, including a retried request or backfill rerun.
  select rating into v_rating
  from public.ranked_leaderboard_profiles
  where user_id = v_match.user_id
  for update;

  if exists (select 1 from public.ranked_elo_events where match_id = v_match.id) then
    return;
  end if;

  -- A direct final reveal is the only eligible losing action. Read the
  -- opening and terminal move from the server's recorded sequence. The state
  -- of a losing direct reveal retains exactly the pre-action safe reveals.
  if v_match.status = 'lost' and v_match.move_count > 1 then
    select m.row_index * 16 + m.column_index into v_first
    from public.ranked_match_moves m
    where m.match_id = v_match.id and m.move_number = 1 and m.action = 'reveal';
    select m.row_index * 16 + m.column_index into v_target
    from public.ranked_match_moves m
    where m.match_id = v_match.id and m.move_number = v_match.move_count
      and m.action = 'reveal';
    if v_first is not null and v_target is not null then
      select ranked_internal.prove_final_guess_loss_v1(
        s.mine_positions, s.revealed_positions, v_first, v_target)
        into v_final_guess
      from public.ranked_match_state s
      where s.match_id = v_match.id and s.first_move_done
        and cardinality(s.revealed_positions) = 215
        and not (v_target = any(s.flagged_positions));
      v_final_guess := coalesce(v_final_guess, false);
    end if;
  end if;

  if v_final_guess then
    select r.nominal_delta into strict v_nominal
      from ranked_internal.calculate_rating_v4(v_rating, 'won') r;
    v_after := least(10000::bigint, v_rating::bigint + (v_nominal + 1) / 2)::integer;
    v_change := v_after - v_rating;
  else
    select r.rating_delta, r.rating_after into strict v_change, v_after
      from ranked_internal.calculate_rating_v4(v_rating, v_match.status) r;
  end if;

  insert into public.ranked_elo_events (
    match_id, user_id, outcome, rating_before, rating_delta, rating_after, policy_version, final_guess_compensated
  ) values (
    v_match.id, v_match.user_id, v_match.status, v_rating, v_change, v_after, 4, v_final_guess
  ) on conflict (match_id) do nothing returning match_id into v_inserted;

  if v_inserted is null then
    return;
  end if;

  update public.ranked_leaderboard_profiles
  set rating = v_after,
      games = games + 1,
      wins = wins + (case when v_match.status = 'won' then 1 else 0 end),
      losses = losses + (case when v_match.status = 'lost' then 1 else 0 end),
      last_ranked_at = greatest(coalesce(last_ranked_at, v_match.finished_at),
                               v_match.finished_at),
      updated_at = now()
  where user_id = v_match.user_id;
end;
$$;
REVOKE ALL ON FUNCTION ranked_internal.apply_verified_match_rating(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- The existing verified win capture trigger precedes this status trigger.
-- Direct reveal and chord RPCs both insert the terminal move AFTER updating
-- the match status. The loss receipt must see that move, in the same transaction.
CREATE OR REPLACE FUNCTION ranked_internal.record_ranked_elo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'active' AND NEW.status = 'won' THEN
    PERFORM ranked_internal.apply_verified_match_rating(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION ranked_internal.record_ranked_elo() FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION ranked_internal.record_ranked_loss_after_move()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.action IN ('reveal', 'chord') AND EXISTS (
    SELECT 1 FROM public.ranked_matches m
    WHERE m.id = NEW.match_id AND m.status = 'lost' AND m.move_count = NEW.move_number
  ) THEN
    PERFORM ranked_internal.apply_verified_match_rating(NEW.match_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION ranked_internal.record_ranked_loss_after_move() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER zz_record_ranked_loss_after_move
AFTER INSERT ON public.ranked_match_moves
FOR EACH ROW EXECUTE FUNCTION ranked_internal.record_ranked_loss_after_move();
COMMIT;
