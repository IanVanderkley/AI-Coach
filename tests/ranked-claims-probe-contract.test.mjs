import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const route = readFileSync("app/api/ranked/matches/reveal/route.ts", "utf8");

test("claims authentication requires an explicit development or deployment opt-in", () => {
  assert.match(route, /AI_COACH_RANKED_DEV_CLAIMS_PROBE_V1/);
  assert.match(route, /process\.env\.NODE_ENV === "development"/);
  assert.match(route, /process\.env\.RANKED_AUTH_PROBE === "claims"/);
  assert.match(route, /process\.env\.RANKED_AUTH_MODE === "claims"/);
  assert.match(route, /if \(useClaimsProbe\) \{/);
  assert.match(route, /supabase\.auth\.getClaims\(\)/);
  assert.match(route, /supabase\.auth\.getUser\(\)/);
});

test("claims require a verified nonempty subject, not browser-supplied identity", () => {
  assert.match(route, /typeof data\?\.claims\?\.sub === "string"/);
  assert.match(route, /data\.claims\.sub\.length > 0/);
  assert.match(route, /if \(authError \|\| !verifiedUserId\)/);
  assert.match(route, /p_user_id: verifiedUserId/);
  assert.doesNotMatch(route, /p_user_id: user\.id/);
  assert.match(route, /admin\.rpc\("execute_ranked_move",/);
});
