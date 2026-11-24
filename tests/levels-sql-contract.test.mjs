import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const dir = new URL("../supabase/migrations/", import.meta.url);
const filenames = readdirSync(fileURLToPath(dir)).filter((name) =>
  /^\d+_player_levels\.sql$/.test(name),
);
assert.equal(
  filenames.length,
  1,
  "There should be exactly one CLI-generated player-level migration",
);
const sql = readFileSync(join(fileURLToPath(dir), filenames[0]), "utf8");

test("XP is only awarded through a verified Ranked result trigger", () => {
  assert.match(sql, /after insert on public\.ranked_verified_results/i);
  assert.match(sql, /create trigger award_player_xp_for_verified_ranked_win/i);
  assert.match(
    sql,
    /values\s*\(\s*new\.match_id,\s*new\.user_id,\s*'ranked_verified_win',\s*125\s*\)/i,
  );
});

test("awards are deduplicated by the exact server match ID", () => {
  assert.match(sql, /source_match_id uuid primary key/i);
  assert.match(sql, /on conflict\s*\(source_match_id\)\s*do nothing/i);
});

test("XP ledger is private, profile balance is read-only for the browser", () => {
  assert.match(sql, /create schema if not exists xp_internal/i);
  assert.match(
    sql,
    /alter table xp_internal\.player_xp_ledger enable row level security/i,
  );
  assert.match(sql, /alter table public\.player_xp_profiles enable row level security/i);
  assert.match(sql, /grant select on table public\.player_xp_profiles to authenticated/i);
  assert.match(sql, /using\s*\(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.doesNotMatch(
    sql,
    /grant\s+(?:insert|update|delete|all)\s+on table public\.player_xp_profiles to authenticated/i,
  );
});

test("sensitive trigger has no public RPC permission", () => {
  assert.match(sql, /security definer\s+set search_path = ''/i);
  assert.match(sql, /revoke all on function xp_internal\.award_verified_ranked_xp\(\)/i);
});

test("migration fails closed without verified results and never backfills", () => {
  assert.match(sql, /to_regclass\('public\.ranked_verified_results'\) is null/i);
  assert.doesNotMatch(sql, /insert into public\.player_xp_profiles\s*select /i);
});
