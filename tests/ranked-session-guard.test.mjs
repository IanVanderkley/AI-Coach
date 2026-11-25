import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { readVerifiedRankedSessionId } from "../lib/ranked/session-claims.ts";
import { combinedMoveResponse } from "../lib/ranked/combined-move-response.ts";

const sub = "cce1b613-a3c2-4d1e-a6d6-b7defded2001";
const session_id = "cce1b613-a3c2-4d1e-a6d6-b7defded2002";
const now = 1_700_000_000_000;
const claims = { sub, session_id, role: "authenticated", exp: now / 1000 + 60 };
test("verified session claims require an unexpired authenticated subject and session UUID", () => {
  assert.equal(readVerifiedRankedSessionId(claims, now), session_id);
  for (const value of [
    null,
    [],
    {},
    { ...claims, sub: "bad" },
    { ...claims, session_id: null },
    { ...claims, session_id: "bad" },
    { ...claims, role: "anon" },
    { ...claims, exp: now / 1000 },
    { ...claims, exp: "9999999999" },
    { ...claims, exp: Infinity },
  ]) {
    assert.equal(readVerifiedRankedSessionId(value, now), undefined);
  }
});
test("revoked session response is private 401 without database details", async () => {
  const response = combinedMoveResponse(
    { status: "unauthorized", detail: "private" },
    false,
  );
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.doesNotMatch(await response.text(), /private/);
});
test("claims moves use the checked RPC overload with only one database request", () => {
  for (const action of ["reveal", "flag", "chord"]) {
    const s = readFileSync("app/api/ranked/matches/" + action + "/route.ts", "utf8");
    assert.ok(
      s.includes("verifiedSessionId = readVerifiedRankedSessionId(data?.claims)"),
    );
    assert.match(s, /if \(!verifiedSessionId\)\s*authError\s*=\s*new Error/);
    assert.ok(
      s.includes("...(useClaimsProbe ? { p_session_id: verifiedSessionId } : {})"),
    );
    assert.equal(s.split("admin.rpc(").length - 1, 1);
    assert.ok(
      s.indexOf("if (authError || !verifiedUserId)") <
        s.indexOf('admin.rpc("execute_ranked_move",'),
    );
  }
});
test("claims recovery checks the live session before lookup", () => {
  const s = readFileSync("app/api/ranked/matches/current/route.ts", "utf8");
  assert.ok(s.includes("verifiedSessionId = readVerifiedRankedSessionId(data?.claims)"));
  assert.match(s, /if \(!verifiedSessionId\)\s*authError\s*=\s*new Error/);
  const rpc = s.search(/admin\.rpc\(\s*"ranked_session_is_active",/);
  assert.ok(rpc > s.indexOf("await guardRankedRateLimit"));
  assert.ok(rpc > s.indexOf("if (rateLimited) return rateLimited;"));
  assert.ok(rpc < s.indexOf('"get_ranked_visible_board"'));
  assert.ok(s.includes("if (active !== true)"));
});
