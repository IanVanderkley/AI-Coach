-- Batch 26A.3: atomic settlement switch. LOCAL FIRST. No historical balance rewrite.
BEGIN;
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

  -- Policy v3 applies to newly recorded completions only.
  v_change := ranked_internal.rating_delta_v3(v_rating, v_match.status);
  v_after := v_rating + v_change;

  insert into public.ranked_elo_events (
    match_id, user_id, outcome, rating_before, rating_delta, rating_after, policy_version
  ) values (
    v_match.id, v_match.user_id, v_match.status, v_rating, v_change, v_after, 3
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
$reviewed$ THEN
    RAISE EXCEPTION 'Existing award function differs from reviewed v3';
  END IF;
  IF pg_catalog.to_regprocedure('ranked_internal.calculate_rating_v4(integer,text)') IS NULL THEN
    RAISE EXCEPTION 'Missing private v4 calculation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM ranked_internal.release_maintenance WHERE singleton AND (required_policy_version IS NULL OR required_policy_version = 3)) THEN
    RAISE EXCEPTION 'Unexpected Ranked release contract';
  END IF;
END;
$guard$;
-- The release row is locked before changing the award path; incompatible
-- application writes fail closed after commit. Preserve the maintenance flag.
LOCK TABLE ranked_internal.release_maintenance IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.ranked_leaderboard_profiles
  DROP CONSTRAINT ranked_leaderboard_profiles_rating_check,
  ADD CONSTRAINT ranked_leaderboard_profiles_rating_check CHECK (rating <= 10000),
  ALTER COLUMN rating SET DEFAULT 1500;
ALTER TABLE public.ranked_elo_events
  DROP CONSTRAINT ranked_elo_events_policy_version_check,
  ADD CONSTRAINT ranked_elo_events_policy_version_check CHECK (policy_version IN (1,2,3,4));
ALTER TABLE ranked_internal.release_maintenance
  DROP CONSTRAINT release_maintenance_required_policy_version_check,
  ADD CONSTRAINT release_maintenance_required_policy_version_check CHECK (required_policy_version IN (3,4));
UPDATE ranked_internal.release_maintenance SET required_policy_version = 4 WHERE singleton;
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
$$;
REVOKE ALL ON FUNCTION ranked_internal.apply_verified_match_rating(uuid) FROM public, anon, authenticated;
COMMIT;
