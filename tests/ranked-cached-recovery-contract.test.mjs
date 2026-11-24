import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const route = readFileSync("app/api/ranked/matches/current/route.ts", "utf8");
const page = readFileSync("app/ranked/page.tsx", "utf8");
const sql = readFileSync(
  "supabase/migrations/202610280001_ranked_gameplay_baseline.sql",
  "utf8",
);
const marker = "AI_COACH_RANKED_CACHED_RECOVERY_V1";

test("recovery hint never overrides verified account identity", () => {
  assert.ok(route.includes(marker));
  assert.match(route, /if \(authError \|\| !verifiedUserId\)/);
  assert.match(route, /p_match_id: knownMatchId/);
  assert.match(route, /p_user_id: verifiedUserId/);
  assert.match(route, /knownBoard\.matchId === knownMatchId/);
  assert.match(route, /knownBoard\.status === "active"/);
});

test("untrusted stale or missing hint falls back to original owner-scoped lookup", () => {
  assert.match(route, /\.from\("ranked_matches"\)/);
  assert.match(route, /\.eq\("user_id", verifiedUserId\)/);
  assert.match(route, /\.eq\("status", "active"\)/);
  assert.match(route, /admin\.rpc\("get_ranked_visible_board", \{/);
  assert.match(route, /\^\[0-9a-f\]/);
});

test("browser stores only an opaque session-scoped hint, not game state", () => {
  assert.ok(page.includes(marker));
  assert.match(page, /window\.sessionStorage/);
  assert.match(page, /X-Ranked-Known-Match/);
  assert.match(page, /rememberMatchId\(null\)/);
  assert.match(
    page,
    /rememberMatchId\(data\.status === "active" \? data\.matchId : null\)/,
  );
  assert.doesNotMatch(page, /window\.localStorage/);
});

test("database visible-board RPC verifies owner and active match", () => {
  const fn = sql
    .split("CREATE OR REPLACE FUNCTION public.get_ranked_visible_board(")[1]
    ?.split("CREATE OR REPLACE FUNCTION public.reveal_first_ranked_cell(")[0];
  assert.ok(fn);
  assert.match(fn, /user_id = p_user_id/);
  assert.match(fn, /status = 'active'/);
});
