-- Verified Ranked outcome XP receipts (staging-first migration).
-- The existing authenticated, server-only Ranked RPCs remain the only gameplay path.
-- This migration never awards historical games retroactively.
-- New verified wins remain 125 XP. Genuinely lost Ranked matches earn 10 XP.
-- The private ledger is still unique by match ID: a match cannot pay twice.

begin;

do $$
begin
  if to_regclass('public.ranked_matches') is null
     or to_regclass('public.ranked_match_state') is null
     or to_regclass('public.ranked_match_moves') is null
     or to_regclass('public.ranked_verified_results') is null
     or to_regclass('public.player_xp_profiles') is null
     or to_regclass('xp_internal.player_xp_ledger') is null then
    raise exception 'Ranked and player XP baseline is required before outcome XP.';
  end if;
  if to_regclass('public.player_xp_match_receipts') is not null then
    raise exception 'XP match receipt table already exists; review migration history.';
  end if;
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='ranked_verified_results'
    and t.tgname='award_player_xp_for_verified_ranked_win' and not t.tgisinternal
  ) then
    raise exception 'The verified Ranked win XP trigger is missing.';
  end if;
  if not exists (
    select 1 from pg_constraint k join pg_class c on c.oid=k.conrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='xp_internal' and c.relname='player_xp_ledger'
    and k.conname='player_xp_ledger_event_type_check'
  ) or not exists (
    select 1 from pg_constraint k join pg_class c on c.oid=k.conrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='xp_internal' and c.relname='player_xp_ledger'
    and k.conname='player_xp_ledger_amount_check'
  ) then
    raise exception 'The original XP ledger constraints do not match the reviewed staging schema.';
  end if;
end;
$$;

-- Keep one ledger row per match, and bind each exact event to its exact award.
alter table xp_internal.player_xp_ledger
  drop constraint player_xp_ledger_event_type_check,
  drop constraint player_xp_ledger_amount_check;
alter table xp_internal.player_xp_ledger
  add constraint player_xp_ledger_verified_reward_check check (
    (event_type = 'ranked_verified_win' and amount = 125) or
    (event_type = 'ranked_verified_loss' and amount = 10)
  );

-- The receipt is an owner-readable *projection* of the private XP ledger.
-- Neither browser roles nor service_role can insert or change a receipt directly.
create table public.player_xp_match_receipts (
  match_id uuid primary key references public.ranked_matches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  outcome text not null check (outcome in ('won', 'lost')),
  amount integer not null check (
    (outcome = 'won' and amount = 125) or
    (outcome = 'lost' and amount = 10)
  ),
  awarded_at timestamptz not null default now()
);
create index player_xp_match_receipts_owner_idx
  on public.player_xp_match_receipts (user_id, awarded_at desc);
alter table public.player_xp_match_receipts enable row level security;
revoke all on table public.player_xp_match_receipts from public, anon, authenticated, service_role;
grant select on table public.player_xp_match_receipts to authenticated;
create policy "Players read only their own Ranked XP receipts"
  on public.player_xp_match_receipts for select to authenticated
  using ((select auth.uid()) = user_id);

-- Both old win awards and new loss awards now produce the same type of
-- owner-readable receipt. It is written in the *same transaction* as the ledger.
create function xp_internal.record_ranked_xp_receipt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_type not in ('ranked_verified_win', 'ranked_verified_loss') then
    raise exception 'Unexpected Ranked XP event';
  end if;
  insert into public.player_xp_match_receipts (match_id, user_id, outcome, amount, awarded_at)
  values (
    new.source_match_id,
    new.user_id,
    case when new.event_type='ranked_verified_win' then 'won' else 'lost' end,
    new.amount,
    new.awarded_at
  );
  return new;
end;
$$;
revoke all on function xp_internal.record_ranked_xp_receipt()
  from public, anon, authenticated, service_role;
create trigger record_ranked_xp_receipt
  after insert on xp_internal.player_xp_ledger
  for each row execute function xp_internal.record_ranked_xp_receipt();

-- Existing Ranked gameplay updates ranked_matches.status BEFORE it inserts the
-- terminal ranked_match_moves row. This trigger runs *after that move*, when
-- the server-owned final status and exact losing action are both available.
-- A separate user-submitted XP endpoint is intentionally NOT provided.
create function xp_internal.award_verified_ranked_loss_xp()
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
  values (new.match_id, v_match.user_id, 'ranked_verified_loss', 10)
  on conflict (source_match_id) do nothing
  returning source_match_id into v_recorded_match;

  if v_recorded_match is not null then
    insert into public.player_xp_profiles (user_id, total_xp)
    values (v_match.user_id, 10)
    on conflict (user_id) do update
      set total_xp = public.player_xp_profiles.total_xp + excluded.total_xp,
          updated_at = now();
  end if;
  return new;
end;
$$;
revoke all on function xp_internal.award_verified_ranked_loss_xp()
  from public, anon, authenticated, service_role;
create trigger award_xp_for_verified_ranked_loss
  after insert on public.ranked_match_moves
  for each row execute function xp_internal.award_verified_ranked_loss_xp();

commit;
