import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const route = readFileSync("app/api/ranked/history/route.ts", "utf8");
const migrations = readdirSync("supabase/migrations").filter((file) =>
  /^\d+_ranked_outcome_xp_receipts\.sql$/.test(file),
);

test("Ranked receipts use signed-in RLS client while match and verified-win reads remain server-owned", () => {
  assert.match(route, /const client = await createClient\(\)/);
  assert.match(route, /client\.auth\.getUser\(\)/);
  assert.match(route, /const admin = createAdminClient\(\)/);
  assert.match(route, /admin\s*\.\s*from\(\s*['"]ranked_matches['"]\s*\)/);
  assert.match(route, /admin\s*\.\s*from\(\s*['"]ranked_verified_results['"]\s*\)/);
  assert.match(route, /client\s*\.\s*from\(\s*['"]player_xp_match_receipts['"]\s*\)/);
  assert.doesNotMatch(
    route,
    /admin\s*\.\s*from\(\s*['"]player_xp_match_receipts['"]\s*\)/,
  );
});

test("XP receipt permissions require authenticated owner reads and prohibit direct service-role reads", () => {
  assert.equal(migrations.length, 1, "expected one Ranked outcome XP receipt migration");
  const sql = readFileSync(`supabase/migrations/${migrations[0]}`, "utf8");
  assert.match(
    sql,
    /revoke all on table public\.player_xp_match_receipts from public, anon, authenticated, service_role/,
  );
  assert.match(
    sql,
    /grant select on table public\.player_xp_match_receipts to authenticated/,
  );
  assert.match(sql, /using \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.doesNotMatch(
    sql,
    /grant select on table public\.player_xp_match_receipts to service_role/i,
  );
});
