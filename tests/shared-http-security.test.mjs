import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedRequestOrigin, readBoundedJson } from "../lib/http/request-security.ts";
import { localEnvironment } from "../scripts/run-local.mjs";

const url = "https://mindsweepercoach.com/api/leaderboard/preferences";
const make = (body, headers = {}) =>
  new Request(url, {
    method: "PUT",
    body,
    headers: {
      "Content-Type": "application/json",
      Origin: new URL(url).origin,
      ...headers,
    },
  });

test("strict mutations reject sibling origins, conflicting metadata, and missing origin", () => {
  for (const headers of [
    { Origin: "https://www.mindsweepercoach.com" },
    { Origin: `${new URL(url).origin}/path` },
    { Origin: "null" },
    { Origin: "" },
    { "Sec-Fetch-Site": "cross-site" },
    { "Sec-Fetch-Site": "same-site" },
  ])
    assert.equal(isAllowedRequestOrigin(make("{}", headers), true), false);
  const absent = new Request(url, { method: "PUT" });
  assert.equal(isAllowedRequestOrigin(absent, true), false);
  assert.equal(isAllowedRequestOrigin(absent), true);
});

test("same origin JSON permits correct preferences and case-insensitive media type", async () => {
  const result = await readBoundedJson(
    make('{"username":"player","isAnonymous":false}', {
      "Content-Type": "Application/JSON; charset=utf-8",
    }),
    2048,
    true,
  );
  assert.deepEqual(result, {
    ok: true,
    value: { username: "player", isAnonymous: false },
  });
});

test("shared reader rejects invalid lengths, types, UTF-8, and JSON", async () => {
  for (const [request, status] of [
    [make("{}", { "Content-Length": "2x" }), 400],
    [make("{}", { "Content-Length": "2049" }), 413],
    [make("{}", { "Content-Type": "text/plain" }), 415],
    [make(new Uint8Array([0xff])), 400],
    [make("{"), 400],
    [make(""), 400],
    [make("{}", { Origin: "https://evil.test" }), 403],
  ]) {
    const result = await readBoundedJson(request, 2048, true);
    assert.equal(result.ok, false);
    assert.equal(result.response.status, status);
    assert.equal(result.response.headers.get("cache-control"), "no-store");
  }
});

test("actual byte cap rejects a forged small length", async () => {
  const result = await readBoundedJson(
    make(JSON.stringify({ value: "é".repeat(1100) }), { "Content-Length": "2" }),
    2048,
    true,
  );
  assert.equal(result.ok, false);
  assert.equal(result.response.status, 413);
});

const jwt = (role) =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.fake-signature`;
const status = (
  url = "http://127.0.0.1:54321",
  anon = jwt("anon"),
  service = jwt("service_role"),
) => `API_URL="${url}"\r\nANON_KEY="${anon}"\r\nSERVICE_ROLE_KEY="${service}"\r\n`;

test("launcher overrides hosted values without modifying the original environment", () => {
  const base = {
    NEXT_PUBLIC_SUPABASE_URL: "https://hosted.example",
    SUPABASE_SECRET_KEY: "hosted",
    COACH_PAID_AI_ENABLED: "true",
    ACCOUNT_DELETION_ENABLED: "true",
  };
  const env = localEnvironment(status(), base);
  assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
  assert.equal(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, jwt("anon"));
  assert.equal(env.SUPABASE_SECRET_KEY, jwt("service_role"));
  assert.equal(env.COACH_PAID_AI_ENABLED, "false");
  assert.equal(env.ACCOUNT_DELETION_ENABLED, "false");
  assert.equal(base.SUPABASE_SECRET_KEY, "hosted");
});

test("launcher fails closed for remote URLs, swapped roles, missing or duplicate keys", () => {
  for (const input of [
    status("https://hosted.example"),
    status(undefined, jwt("service_role"), jwt("anon")),
    status(undefined, "", jwt("service_role")),
    `${status()}ANON_KEY="duplicate"`,
    "",
  ])
    assert.throws(() => localEnvironment(input, {}));
});
