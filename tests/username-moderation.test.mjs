import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import {
  usernameContentProblem,
  BLOCKED_SUBSTRINGS,
  BLOCKED_TOKENS,
} from "../lib/account/username-moderation.ts";
const read = (path) => readFileSync(path, "utf8");
const bad = [
  "fuckhead69",
  "FuCkHeAd69",
  "f_u_c_k",
  "fuuuck",
  "f_4_g_g_0_t",
  "sh1t69",
  "b1tch_69",
  "N1gg3r69",
  "n_i_g_g_a",
  "K1ke",
  "ass69",
  "69_ass",
  "d1ck",
  "d1ckhead",
  "cunt",
  "slut",
  "whore",
  "wanker",
  "heilhitler",
  "whitepower",
  "p1ss",
  "retard",
  "tr4nny",
];
const good = [
  "Player69",
  "Classic69",
  "Classical",
  "Passion",
  "Peacock",
  "Dickens",
  "Grasshopper",
  "MineSweeper_69",
  "Player00000000000000",
  "Player123",
  "Assistant",
  "Bassist",
  "Ace_69",
  "Rock_69",
];
test("blocks explicit profanity, slurs and common obfuscations", () => {
  for (const name of bad) assert.ok(usernameContentProblem(name), name);
});
test("numbers and common innocent words are not banned", () => {
  for (const name of good) assert.equal(usernameContentProblem(name), null, name);
});
test("SQL and TypeScript share the same moderation vocabulary", () => {
  const names = readdirSync("supabase/migrations").filter((name) =>
    /^\d+_username_moderation\.sql$/.test(name),
  );
  assert.equal(names.length, 1);
  const sql = read(`supabase/migrations/${names[0]}`);
  for (const [variable, words] of [
    ["blocked_substrings", BLOCKED_SUBSTRINGS],
    ["blocked_tokens", BLOCKED_TOKENS],
  ]) {
    const matched = sql.match(
      new RegExp(`${variable}\\s+constant\\s+text\\[\\]\\s*:=\\s*ARRAY\\[([^\\]]+)\\]`),
    );
    assert.ok(matched, variable);
    assert.deepEqual(
      [...matched[1].matchAll(/'([^']+)'/g)].map((m) => m[1]),
      [...words],
    );
  }
  assert.match(sql, /CREATE TRIGGER enforce_account_username_content/);
  assert.match(sql, /username_changed_at\s*=\s*NULL/);
  assert.match(sql, /ranked_internal\.username_content_allowed\(candidate\)/);
});
test("signup, username setting and server API call moderation", () => {
  for (const path of [
    "components/account/sign-in-form.tsx",
    "components/account/username-setting.tsx",
    "app/api/leaderboard/preferences/route.ts",
  ])
    assert.match(read(path), /usernameContentProblem\(/, path);
  assert.match(
    read("app/api/leaderboard/preferences/route.ts"),
    /writeError\?\.code === "PT422"/,
  );
});
