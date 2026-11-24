import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const marker = "AI_COACH_RANKED_ACTION_CLAIMS_PROBE_V1";
const routes = [
  ["flag", "toggle_ranked_flag"],
  ["chord", "chord_ranked_cell"],
];
for (const [action, rpc] of routes) {
  test(`${action} claims mode requires opt-in and default still calls getUser`, () => {
    const source = readFileSync(`app/api/ranked/matches/${action}/route.ts`, "utf8");
    assert.ok(source.includes(marker));
    assert.ok(source.includes('process.env.NODE_ENV === "development"'));
    assert.ok(source.includes('process.env.RANKED_AUTH_PROBE === "claims"'));
    assert.ok(source.includes('process.env.RANKED_AUTH_MODE === "claims"'));
    assert.ok(source.includes("supabase.auth.getClaims()"));
    assert.ok(source.includes("supabase.auth.getUser()"));
    assert.ok(source.includes('typeof data?.claims?.sub === "string"'));
    assert.ok(source.includes("if (authError || !verifiedUserId)"));
    assert.ok(source.includes(`admin.rpc("${rpc}"`));
    assert.ok(source.includes("p_user_id: verifiedUserId"));
    assert.ok(!source.includes("[Ranked timing]"));
    assert.ok(!source.includes("performance.now()"));
  });
}
