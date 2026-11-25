import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { parseIdentityMutation, nextUsernameChangeAt } from "../lib/account/username.ts";
const read = (path) => readFileSync(path, "utf8");
const migration = readdirSync("supabase/migrations").filter((name) =>
  /^\d+_username_changes\.sql$/.test(name),
);
assert.equal(migration.length, 1);
const sql = read(`supabase/migrations/${migration[0]}`);
test("username and visibility are disjoint validated mutations", () => {
  assert.deepEqual(parseIdentityMutation({ username: "  Player_One  " }), {
    username: "Player_One",
  });
  assert.deepEqual(parseIdentityMutation({ isAnonymous: true }), { isAnonymous: true });
  for (const value of [
    null,
    [],
    {},
    { username: "ab" },
    { username: "a b" },
    { username: "x@example.com" },
    { username: "x".repeat(21) },
    { isAnonymous: "true" },
    { username: "NewName", isAnonymous: true },
    { username: "NewName", rating: 9000 },
    { username: "NewName", userId: "other" },
  ])
    assert.equal(parseIdentityMutation(value), null);
});
test("cooldown date is exactly 30 days and never fabricated", () => {
  assert.equal(nextUsernameChangeAt(null), null);
  assert.equal(nextUsernameChangeAt("2026-11-25T00:00:00Z"), "2026-12-25T00:00:00.000Z");
  assert.throws(() => nextUsernameChangeAt("bad"));
});
test("canonical name is unique regardless of anonymous mode; database owns the timestamp", () => {
  assert.match(
    sql,
    /CREATE UNIQUE INDEX ranked_account_username_unique ON public\.ranked_leaderboard_profiles \(lower\(username\)\) WHERE username IS NOT NULL/i,
  );
  assert.match(sql, /NEW\.username_changed_at := OLD\.username_changed_at/);
  assert.match(sql, /OLD\.username_changed_at \+ interval '720 hours'/);
  assert.match(sql, /NEW\.username IS DISTINCT FROM OLD\.username/);
  assert.match(sql, /BEFORE UPDATE ON public\.ranked_leaderboard_profiles/);
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION ranked_internal\.guard_account_username_change\(\) FROM PUBLIC, anon, authenticated, service_role/,
  );
  assert.doesNotMatch(sql, /SET (rating|games|wins|losses|is_anonymous)\s*=/i);
});
test("confirmed accounts initialize without rewriting existing names or visibility", () => {
  assert.match(sql, /AFTER INSERT OR UPDATE OF email_confirmed_at ON auth\.users/);
  assert.match(sql, /ON CONFLICT \(user_id\) DO NOTHING/);
  assert.match(sql, /Duplicate legacy usernames/);
  assert.match(sql, /pg_catalog\.pg_advisory_xact_lock/);
  assert.match(sql, /pg_catalog\.gen_random_uuid\(\)/);
  assert.doesNotMatch(sql, /UPDATE auth\.users/i);
});
test("account and privacy UIs send separate changes; navbar reads canonical owner identity", () => {
  const route = read("app/api/leaderboard/preferences/route.ts"),
    account = read("components/account/username-setting.tsx"),
    privacy = read("components/leaderboard/leaderboard-privacy.tsx"),
    nav = read("components/play/navbar.tsx");
  assert.match(route, /readBoundedJson\(request, 2048, true\)/);
  assert.match(route, /parseIdentityMutation\(parsed\.value\)/);
  assert.match(route, /\.eq\("user_id", user\.id\)/);
  assert.match(route, /writeError\?\.code === "PT409"/);
  assert.match(account, /JSON\.stringify\(\{\s*username\s*\}\)/);
  assert.match(privacy, /JSON\.stringify\(\{ isAnonymous \}\)/);
  assert.match(account, /ai-coach:username-updated/);
  assert.match(nav, /ai-coach:username-updated/);
  assert.match(nav, /\.from\("ranked_leaderboard_profiles"\)/);
  assert.doesNotMatch(nav, /user_metadata|email\?\.split/);
  assert.match(
    read("components/account/account-management.tsx"),
    /<UsernameSetting key=\{user\.id\}/,
  );
});
