-- Batch 23B: forward-only solo rating policy v2. LOCAL TEST FIRST.
-- Do not push to the hosted database until the matching rank UI/API is ready.
BEGIN;

-- Reject unexpected function drift rather than overwriting unknown changes.
DO $guard$
BEGIN
  IF (SELECT p.prosrc FROM pg_catalog.pg_proc p
      WHERE p.oid = pg_catalog.to_regprocedure('ranked_internal.apply_verified_match_rating(uuid)'))
     IS DISTINCT FROM $original_body$
declare
  v_match record;
  v_rating integer;
  v_expected numeric;
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

  -- Fixed 1000-point benchmark, K=32. This is single-player Elo-style
  -- progression, NOT a comparison against an actual opponent.
  v_expected := 1::numeric / (
    1::numeric + power(10::numeric, (1000 - v_rating)::numeric / 400::numeric)
  );
  v_change := round(32::numeric * (
    (case when v_match.status = 'won' then 1 else 0 end)::numeric - v_expected
  ))::integer;
  v_after := greatest(100, least(10000, v_rating + v_change));
  v_change := v_after - v_rating;

  insert into public.ranked_elo_events (
    match_id, user_id, outcome, rating_before, rating_delta, rating_after
  ) values (
    v_match.id, v_match.user_id, v_match.status, v_rating, v_change, v_after
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
$original_body$ THEN
    RAISE EXCEPTION 'Existing rating function differs from reviewed v1; stop and inspect';
  END IF;
END;
$guard$;

-- Existing receipts retain their amounts and are tagged v1 by the default.
ALTER TABLE public.ranked_elo_events
  ADD COLUMN policy_version smallint NOT NULL DEFAULT 1
  CHECK (policy_version IN (1, 2));

-- Private pure calculation; no match IDs, user IDs or writable data.
CREATE FUNCTION ranked_internal.rating_delta_v2(p_rating integer, p_outcome text)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = ''
AS $formula$
DECLARE
  expected numeric;
  change integer;
BEGIN
  IF p_rating IS NULL OR p_rating NOT BETWEEN 100 AND 10000
     OR p_outcome IS NULL OR p_outcome NOT IN ('won', 'lost') THEN
    RAISE EXCEPTION 'Invalid rating or outcome' USING ERRCODE = '22023';
  END IF;
  expected := 1::numeric / (1::numeric + pg_catalog.power(10::numeric, (1700 - p_rating)::numeric / 1900::numeric));
  change := CASE WHEN p_outcome = 'won' THEN pg_catalog.round(90::numeric * (1 - expected))::integer
                 ELSE -pg_catalog.round(45::numeric * expected)::integer END;
  RETURN greatest(100, least(10000, p_rating + change)) - p_rating;
END;
$formula$;
REVOKE ALL ON FUNCTION ranked_internal.rating_delta_v2(integer,text) FROM public, anon, authenticated, service_role;

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

  -- Policy v2 applies to newly recorded completions only.
  v_change := ranked_internal.rating_delta_v2(v_rating, v_match.status);
  v_after := v_rating + v_change;

  insert into public.ranked_elo_events (
    match_id, user_id, outcome, rating_before, rating_delta, rating_after, policy_version
  ) values (
    v_match.id, v_match.user_id, v_match.status, v_rating, v_change, v_after, 2
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

-- No profile updates, historical replay, trigger replacement or XP changes.
COMMIT;
