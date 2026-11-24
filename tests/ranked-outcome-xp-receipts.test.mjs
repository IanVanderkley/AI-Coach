import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const matches = readdirSync("supabase/migrations").filter((name) =>
  /^\d+_ranked_outcome_xp_receipts\.sql$/.test(name),
);
assert.equal(matches.length, 1, "expected exactly one CLI-created outcome XP migration");
const sql = readFileSync(`supabase/migrations/${matches[0]}`, "utf8");

test("loss rewards are exactly 10 XP and verified wins remain exactly 125 XP", () => {
  assert.match(sql, /event_type\s*=\s*'ranked_verified_win' and amount\s*=\s*125/);
  assert.match(sql, /event_type\s*=\s*'ranked_verified_loss' and amount\s*=\s*10/);
  assert.match(sql, /player_xp_ledger_verified_reward_check/);
  assert.match(sql, /source_match_id uuid primary key|source_match_id\) do nothing/);
});

test("only a real terminal lost move can trigger loss XP", () => {
  assert.match(sql, /after insert on public\.ranked_match_moves/);
  assert.match(sql, /status = 'lost'/);
  assert.match(sql, /move_count = new\.move_number/);
  assert.match(sql, /new\.action not in \('reveal', 'chord'\)/);
  assert.match(sql, /first_move_done is true/);
  assert.match(sql, /v_position = any\(v_state\.mine_positions\)/);
  assert.match(sql, /new\.action = 'chord'/);
  assert.match(sql, /not \(x = any\(v_state\.flagged_positions\)\)/);
  assert.match(sql, /on conflict \(source_match_id\) do nothing/);
});

test("the receipt is a ledger-backed read-only owner-scoped projection", () => {
  assert.match(sql, /after insert on xp_internal\.player_xp_ledger/);
  assert.match(sql, /create table public\.player_xp_match_receipts/);
  assert.match(
    sql,
    /alter table public\.player_xp_match_receipts enable row level security/,
  );
  assert.match(sql, /for select to authenticated/);
  assert.match(sql, /using \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.match(
    sql,
    /revoke all on table public\.player_xp_match_receipts from public, anon, authenticated, service_role/,
  );
  assert.match(
    sql,
    /grant select on table public\.player_xp_match_receipts to authenticated/,
  );
  assert.doesNotMatch(
    sql,
    /grant (?:insert|update|delete) on table public\.player_xp_match_receipts/i,
  );
});

test("private trigger functions have restricted permissions and a fixed search path", () => {
  assert.equal((sql.match(/security definer/g) || []).length, 2);
  assert.equal((sql.match(/set search_path = ''/g) || []).length, 2);
  assert.match(
    sql,
    /revoke all on function xp_internal\.award_verified_ranked_loss_xp\(\)/,
  );
  assert.match(sql, /revoke all on function xp_internal\.record_ranked_xp_receipt\(\)/);
  assert.doesNotMatch(sql, /create function public\..*award/i);
});

test("the migration refuses an unknown baseline and does not backfill", () => {
  assert.match(sql, /The verified Ranked win XP trigger is missing/);
  assert.match(sql, /XP match receipt table already exists/);
  assert.doesNotMatch(sql, /insert into public\.ranked_matches/);
  assert.doesNotMatch(sql, /update public\.ranked_matches/);
  assert.doesNotMatch(sql, /insert into public\.ranked_verified_results/);
});
