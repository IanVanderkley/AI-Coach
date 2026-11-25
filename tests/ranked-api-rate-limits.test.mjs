import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { checkRankedRateLimit } from "../lib/ranked/api-rate-limit-core.ts";

const sql = readFileSync(
  "supabase/migrations/20261125063351_ranked_api_rate_limits.sql",
  "utf8",
);

test("Ranked admission accepts only a literal true reservation", async () => {
  assert.equal(await checkRankedRateLimit(async () => true), null);
  for (const unexpected of [null, undefined, "true", 1, {}, []]) {
    const response = await checkRankedRateLimit(async () => unexpected);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Retry-After"), "5");
  }
});

test("Ranked admission returns a retryable, non-cacheable 429 on exhaustion", async () => {
  const response = await checkRankedRateLimit(async () => false);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "60");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});

test("Ranked admission fails closed without leaking internal errors", async () => {
  const response = await checkRankedRateLimit(async () => {
    throw new Error("private database detail");
  });
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private database detail/);
});

test("Ranked counters are bounded per account and scope, with atomic reservations", () => {
  assert.match(sql, /PRIMARY KEY \(user_id, scope\)/);
  assert.match(sql, /REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
  assert.match(sql, /ON CONFLICT \(user_id, scope\) DO UPDATE/);
  assert.match(
    sql,
    /c\.bucket_start = EXCLUDED\.bucket_start AND c\.usage_count < v_limit/,
  );
  assert.match(sql, /WHEN 'start' THEN 30/);
  assert.match(sql, /WHEN 'move' THEN 600/);
  assert.match(sql, /WHEN 'read' THEN 120/);
});

test("Ranked reservation storage and RPC are server-only", () => {
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(
    sql,
    /REVOKE ALL ON TABLE public\.ranked_api_rate_counters FROM PUBLIC, anon, authenticated, service_role/,
  );
  assert.match(sql, /SECURITY INVOKER/);
  assert.match(sql, /SET search_path = ''/);
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.reserve_ranked_api_request\(uuid, text\) FROM PUBLIC, anon, authenticated, service_role/,
  );
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.reserve_ranked_api_request\(uuid, text\) TO service_role/,
  );
});

const routes = [
  ["ranked/matches", "user.id", "start", "rpc("],
  ["ranked/matches/current", "verifiedUserId", "read", "rpc("],
  ["ranked/history", "user.id", "read", ".from("],
];

test("Ranked start and read routes reserve using verified account identity before privileged work", () => {
  for (const [route, identity, scope, operation] of routes) {
    const source = readFileSync(`app/api/${route}/route.ts`, "utf8");
    const guard = `guardRankedRateLimit(admin, ${identity}, "${scope}")`;
    const auth = source.indexOf("status: 401");
    const admission = source.indexOf(guard);
    assert.ok(auth >= 0 && admission > auth, route);
    assert.ok(
      source.indexOf("if (rateLimited) return rateLimited;", admission) > admission,
      route,
    );
    const firstAdmin = source.indexOf("const admin = createAdminClient();");
    assert.ok(firstAdmin > auth && admission > firstAdmin, route);
    assert.ok(source.indexOf(operation, firstAdmin) > admission, route);
  }
});
