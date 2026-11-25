import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { combinedMoveResponse } from "../lib/ranked/combined-move-response.ts";

const files = readdirSync("supabase/migrations").filter((name) =>
  /^\d+_ranked_combined_move\.sql$/.test(name),
);
assert.equal(files.length, 1);
const sql = readFileSync(`supabase/migrations/${files[0]}`, "utf8");

test("combined move returns the existing result body, not its private envelope", async () => {
  const result = { matchId: "example", moveCount: 2, flagged: true, flagCount: 1 };
  const response = combinedMoveResponse({ status: "ok", result }, false);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), result);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});

test("combined move preserves distributed admission exhaustion", async () => {
  const response = combinedMoveResponse({ status: "rate_limited" }, false);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "60");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});

test("conflicts and rejected moves remain recoverable 409 responses", async () => {
  for (const status of ["conflict", "rejected"]) {
    const response = combinedMoveResponse({ status, detail: "private" }, false);
    assert.equal(response.status, 409);
    assert.doesNotMatch(await response.text(), /private/);
  }
});

test("combined move fails closed on RPC failures and malformed envelopes", async () => {
  for (const [data, failed] of [
    [null, false],
    [[], false],
    [{ status: "ok" }, false],
    [{ status: "ok", result: [] }, false],
    [{ status: "ok", result: {} }, true],
    [{ status: "unavailable", detail: "private" }, false],
    [{ status: "unknown" }, false],
  ]) {
    const response = combinedMoveResponse(data, failed);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Retry-After"), "5");
    assert.doesNotMatch(await response.text(), /private/);
  }
});

test("combined admission precedes the move subtransaction and delegates to revision guards", () => {
  const reservation = sql.indexOf("public.reserve_ranked_api_request(p_user_id, 'move')");
  assert.ok(reservation > 0 && reservation < sql.indexOf("CASE p_action"));
  assert.match(sql, /IF v_admitted IS DISTINCT FROM true/);
  assert.match(sql, /SECURITY INVOKER/);
  assert.match(sql, /SET search_path = ''/);
  for (const name of [
    "reveal_first_ranked_cell",
    "reveal_ranked_cell",
    "toggle_ranked_flag",
    "chord_ranked_cell",
  ]) {
    assert.match(
      sql,
      new RegExp(
        `public\\.${name}\\(p_match_id, p_user_id, p_row,\\s*p_column, p_expected_move_count\\)`,
      ),
    );
  }
  assert.match(sql, /WHEN SQLSTATE 'PT409'/);
  assert.match(sql, /WHEN SQLSTATE 'P0001'/);
  assert.match(sql, /FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(sql, /TO service_role/);
});

test("move endpoints call only one privileged RPC after authentication and revision validation", () => {
  for (const action of ["reveal", "flag", "chord"]) {
    const source = readFileSync(`app/api/ranked/matches/${action}/route.ts`, "utf8");
    const auth = source.indexOf("status: 401");
    const revision = source.indexOf("if (!isRankedMoveRevision(expectedMoveCount))");
    const rpc = source.indexOf('admin.rpc("execute_ranked_move",');
    assert.ok(auth >= 0 && revision > auth && rpc > revision);
    assert.equal((source.match(/admin\.rpc\(/g) ?? []).length, 1);
    assert.match(source, /p_user_id: verifiedUserId/);
    assert.ok(source.includes(`p_action: "${action}"`));
    assert.match(source, /p_expected_move_count: expectedMoveCount/);
    assert.doesNotMatch(source, /guardRankedRateLimit|admin\s*\.from\(/);
    assert.match(source, /combinedMoveResponse\(data, Boolean\(error\)\)/);
  }
});
