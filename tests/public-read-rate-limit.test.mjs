import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { checkPublicReadLimit } from "../lib/http/public-read-limit-core.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("public read admission accepts only an explicit true", async () => {
  let calls = 0;
  assert.equal(
    await checkPublicReadLimit(async () => {
      calls++;
      return true;
    }),
    null,
  );
  assert.equal(calls, 1);
});

test("exhausted public quota returns uncached 429 with Retry-After", async () => {
  const response = await checkPublicReadLimit(async () => false);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("retry-after"), "60");
});

test("failed or malformed admission fails closed without exposing internal errors", async () => {
  for (const reserve of [
    async () => null,
    async () => "true",
    async () => ({}),
    async () => {
      throw new Error("PRIVATE_TEST_ERROR");
    },
  ]) {
    const response = await checkPublicReadLimit(reserve);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("retry-after"), "5");
    assert.doesNotMatch(await response.text(), /PRIVATE_TEST_ERROR/);
  }
});

test("both public GET routes reserve their own scope before any leaderboard query", () => {
  for (const [route, scope, view] of [
    ["app/api/leaderboard/route.ts", "leaderboard", "ranked_public_elo"],
    ["app/api/ranked-results/route.ts", "verified_results", "ranked_public_fastest"],
  ]) {
    const source = read(route);
    const admission = `const denied = await admitPublicRead(admin, "${scope}");`;
    assert.ok(source.includes(admission));
    assert.ok(source.indexOf(admission) < source.indexOf(`.from("${view}")`));
    assert.match(source, /if \(denied\) return denied;/);
    assert.match(source, /"Cache-Control": "(?:public, )?no-store"/);
  }
  const legacy = read("app/api/ranked-results/route.ts");
  assert.doesNotMatch(
    legacy.slice(legacy.indexOf("export async function POST")),
    /admitPublicRead/,
  );
});

test("public read counter migration is bounded and service-only", () => {
  const folder = new URL("../supabase/migrations/", import.meta.url);
  const names = readdirSync(folder).filter((name) =>
    /^\d+_public_read_rate_limits\.sql$/.test(name),
  );
  assert.equal(names.length, 1);
  const sql = read(`supabase/migrations/${names[0]}`);
  assert.match(
    sql,
    /scope text PRIMARY KEY CHECK \(scope IN \('leaderboard', 'verified_results'\)\)/i,
  );
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql, /SECURITY INVOKER/i);
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.reserve_public_read_request\(text\) FROM PUBLIC, anon, authenticated, service_role/i,
  );
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.reserve_public_read_request\(text\) TO service_role/i,
  );
  assert.match(sql, /ON CONFLICT \(scope\) DO UPDATE/i);
  assert.match(sql, /WHEN 'leaderboard' THEN 300 WHEN 'verified_results' THEN 120/i);
});
