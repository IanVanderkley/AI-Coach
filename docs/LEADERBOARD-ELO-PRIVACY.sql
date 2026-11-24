-- Batch 11: solo Ranked Elo-style rating and opt-in public leaderboards.
-- Apply to the AI-Coach STAGING Supabase project only after review.
-- No changes to the existing XP ledger or verified match source.
-- This is an Elo-style rating versus a fixed benchmark, NOT player-vs-player Elo.

-- Refuse to create a fake leaderboard when the trusted match tables are absent.
do $$
begin
  if to_regclass('public.ranked_matches') is null
     or to_regclass('public.ranked_verified_results') is null then
    raise exception 'Ranked verified match tables must exist before Batch 11';
  end if;
end;
$$;

create schema if not exists ranked_internal;
revoke all on schema ranked_internal from public, anon, authenticated;

create table public.ranked_leaderboard_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text,
  is_anonymous boolean not null default true,
  rating integer not null default 1000 check (rating >= 100 and rating <= 10000),
  games integer not null default 0 check (games >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  last_ranked_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint ranked_public_username_valid check (
    username is null or username ~ '^[A-Za-z0-9_]{3,20}$'
  ),
  constraint ranked_public_username_required check (is_anonymous or username is not null),
  constraint ranked_elo_games_consistent check (games = wins + losses)
);

-- Users can read their own rating/preferences, not other accounts' private data.
alter table public.ranked_leaderboard_profiles enable row level security;
revoke all on public.ranked_leaderboard_profiles from public, anon, authenticated;
grant select on public.ranked_leaderboard_profiles to authenticated;
create policy "Owners read their Ranked rating and privacy settings"
  on public.ranked_leaderboard_profiles for select to authenticated
  using ((select auth.uid()) = user_id);

-- A name can be held while private; uniqueness is enforced for public names.
create unique index ranked_public_username_unique
  on public.ranked_leaderboard_profiles (lower(username))
  where not is_anonymous;

create table public.ranked_elo_events (
  match_id uuid primary key references public.ranked_matches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  outcome text not null check (outcome in ('won', 'lost')),
  rating_before integer not null,
  rating_delta integer not null,
  rating_after integer not null,
  recorded_at timestamptz not null default now(),
  constraint ranked_elo_math check (rating_after = rating_before + rating_delta)
);
alter table public.ranked_elo_events enable row level security;
revoke all on public.ranked_elo_events from public, anon, authenticated;
-- Admin API and trusted server only; never grant writes to browser roles.
grant select, insert, update on public.ranked_leaderboard_profiles to service_role;
grant select, insert on public.ranked_elo_events to service_role;
create index ranked_elo_events_user_idx on public.ranked_elo_events (user_id, recorded_at desc);

-- This private routine is callable only by trusted database code. It verifies
-- stored match ownership/status and the verified win receipt before awarding.
create function ranked_internal.apply_verified_match_rating(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all on function ranked_internal.apply_verified_match_rating(uuid)
  from public, anon, authenticated;

create function ranked_internal.record_ranked_elo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'active' and new.status in ('won', 'lost') then
    perform ranked_internal.apply_verified_match_rating(new.id);
  end if;
  return new;
end;
$$;
revoke all on function ranked_internal.record_ranked_elo()
  from public, anon, authenticated;

-- The verified win trigger is named capture_verified_ranked_win, which fires
-- before this alphabetically-named trigger on the same AFTER UPDATE event.
create trigger zz_record_ranked_elo
  after update of status on public.ranked_matches
  for each row
  execute function ranked_internal.record_ranked_elo();

-- Backfill real historical completed matches in completion order. This neither
-- writes XP nor changes old match statuses; event PKs make it idempotent.
do $$
declare v record;
begin
  for v in
    select m.id from public.ranked_matches m
    where m.status in ('won','lost')
      and m.rows = 16 and m.columns = 16 and m.mine_count = 40
      and m.finished_at is not null
    order by m.finished_at, m.id
  loop
    perform ranked_internal.apply_verified_match_rating(v.id);
  end loop;
end;
$$;

-- Both public boards are privacy-filtered IN POSTGRES, before LIMIT.
-- They expose no e-mail addresses, auth identifiers, or private match IDs.
create view public.ranked_public_elo
  with (security_invoker = true)
as
select username, rating, games, wins, losses
from public.ranked_leaderboard_profiles
where not is_anonymous and username is not null and games > 0;

create view public.ranked_public_fastest
  with (security_invoker = true)
as
select p.username, best.duration_ms, best.finished_at
from (
  select distinct on (r.user_id)
    r.user_id, r.duration_ms, r.finished_at
  from public.ranked_verified_results r
  where r.board_rows = 16 and r.board_columns = 16 and r.mine_count = 40
  order by r.user_id, r.duration_ms, r.finished_at, r.match_id
) best
join public.ranked_leaderboard_profiles p on p.user_id = best.user_id
where not p.is_anonymous and p.username is not null and p.games > 0;

revoke all on public.ranked_public_elo from public, anon, authenticated;
revoke all on public.ranked_public_fastest from public, anon, authenticated;
grant select on public.ranked_public_elo, public.ranked_public_fastest to service_role;

-- The trusted server may update privacy settings via service_role only.
-- Do NOT grant INSERT/UPDATE to authenticated; those would also modify ratings.
