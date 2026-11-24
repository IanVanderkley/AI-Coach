-- AI-Coach player levels (1,000 XP per level, read-only account balances).
-- DEPLOY TO STAGING FIRST. Do not apply to a production project until the
-- verified Ranked results migration and its authentic win trigger are confirmed.
-- Fresh verified Ranked wins only: no retroactive/backfilled XP.
-- Browser-controlled Practice recordings cannot create XP.

begin;

do $$
begin
  if to_regclass('public.ranked_verified_results') is null then
    raise exception 'Verified Ranked results are missing. Deploy/verify Ranked before player XP.';
  end if;
  if to_regclass('public.player_xp_profiles') is not null
     or to_regclass('xp_internal.player_xp_ledger') is not null then
    raise exception 'Player XP schema already exists. Review migrations; do not overwrite.';
  end if;
end;
$$;

create schema if not exists xp_internal;
revoke all on schema xp_internal from public, anon, authenticated;

-- Only the verified Ranked result trigger can write this private ledger.
-- A match ID can award XP once, even if an insert is attempted again.
create table xp_internal.player_xp_ledger (
  source_match_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null check (event_type = 'ranked_verified_win'),
  amount integer not null check (amount = 125),
  awarded_at timestamptz not null default now()
);
create index player_xp_ledger_user_idx
  on xp_internal.player_xp_ledger (user_id, awarded_at desc);
alter table xp_internal.player_xp_ledger enable row level security;
revoke all on table xp_internal.player_xp_ledger from public, anon, authenticated, service_role;

-- Browser may SELECT only its own total. It cannot INSERT/UPDATE/DELETE XP.
create table public.player_xp_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  total_xp bigint not null default 0 check (total_xp >= 0),
  updated_at timestamptz not null default now()
);
alter table public.player_xp_profiles enable row level security;
revoke all on table public.player_xp_profiles from public, anon, authenticated, service_role;
grant select on table public.player_xp_profiles to authenticated;
create policy "Players read only their own XP"
  on public.player_xp_profiles for select to authenticated
  using ((select auth.uid()) = user_id);

-- Trigger is under an unexposed schema and fully qualifies all references.
-- Atomic write: insert-on-conflict prevents a second award; balance and
-- ledger are committed (or rolled back) together in the same transaction.
create function xp_internal.award_verified_ranked_xp()
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
    new.match_id, new.user_id, 'ranked_verified_win', 125
  ) on conflict (source_match_id) do nothing
    returning source_match_id into v_inserted_match;

  if v_inserted_match is null then
    return new;
  end if;

  insert into public.player_xp_profiles (user_id, total_xp)
  values (new.user_id, 125)
  on conflict (user_id) do update
    set total_xp = public.player_xp_profiles.total_xp + excluded.total_xp,
        updated_at = now();
  return new;
end;
$$;

revoke all on function xp_internal.award_verified_ranked_xp()
  from public, anon, authenticated, service_role;

create trigger award_player_xp_for_verified_ranked_win
  after insert on public.ranked_verified_results
  for each row execute function xp_internal.award_verified_ranked_xp();

commit;
