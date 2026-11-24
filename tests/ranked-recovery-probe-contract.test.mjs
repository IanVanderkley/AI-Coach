import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const route = readFileSync("app/api/ranked/matches/current/route.ts", "utf8");
const page = readFileSync("app/ranked/page.tsx", "utf8");
test("recovery claims authentication requires explicit opt-in", () => {
  assert.ok(route.includes("AI_COACH_RANKED_RECOVERY_CLAIMS_PROBE_V1"));
  assert.ok(route.includes('process.env.NODE_ENV === "development"'));
  assert.ok(route.includes('process.env.RANKED_AUTH_PROBE === "claims"'));
  assert.ok(route.includes('process.env.RANKED_AUTH_MODE === "claims"'));
  assert.ok(route.includes("supabase.auth.getClaims()"));
  assert.ok(route.includes("supabase.auth.getUser()"));
  assert.ok(route.includes("if (authError || !verifiedUserId)"));
  assert.ok(route.includes('.eq("user_id", verifiedUserId)'));
  assert.ok(route.includes("p_user_id: verifiedUserId"));
  assert.ok(!route.includes("[Ranked timing]"));
  assert.ok(!route.includes("performance.now()"));
});
test("initial mount recovery is guarded without blocking explicit reloads", () => {
  assert.ok(page.includes("AI_COACH_RANKED_SINGLE_INITIAL_LOAD_V1"));
  assert.ok(page.includes("const initialRecoveryRequested = useRef(false)"));
  assert.ok(page.includes("if (initialRecoveryRequested.current) return;"));
  assert.ok(page.includes("initialRecoveryRequested.current = true;"));
  assert.ok(page.includes("await loadBoard();"));
});
