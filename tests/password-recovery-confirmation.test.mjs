import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { readRecoveryToken } from "../lib/account/recovery-link.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const token = "pkce_" + "a".repeat(64);

test("recovery fragment accepts a single bounded token and rejects ambiguous input", () => {
  assert.equal(readRecoveryToken(`#recovery_token=${token}`), token);
  for (const input of [
    "",
    "#",
    "#recovery_token=short",
    `?recovery_token=${token}`,
    `#recovery_token=${token}&recovery_token=${token}`,
    `#recovery_token=${token}&next=https://example.org`,
    `#recovery_token=${"x".repeat(513)}`,
    "#recovery_token=%3Cscript%3E",
  ])
    assert.equal(readRecoveryToken(input), null);
});

test("recovery is confirmed by an explicit click rather than an initial page effect", () => {
  const ui = read("components/account/reset-password-form.tsx");
  const effect = ui.slice(
    ui.indexOf("useEffect(() =>"),
    ui.indexOf("async function confirmRecovery"),
  );
  assert.match(effect, /window\.location\.hash/);
  assert.match(effect, /window\.history\.replaceState/);
  assert.doesNotMatch(effect, /verifyOtp\(|updateUser\(/);
  assert.match(ui, /onClick=\{\(\) => void confirmRecovery\(\)\}/);
  assert.match(ui, /verifyOtp\(\{\s*token_hash: token,\s*type: "recovery"/);
  assert.doesNotMatch(ui, /localStorage|sessionStorage/);
});

test("password update requires the identity from the recovery verification", () => {
  const ui = read("components/account/reset-password-form.tsx");
  assert.match(ui, /setVerifiedUserId\(data\.user\.id\)/);
  const submit = ui.slice(ui.indexOf("async function submit"), ui.indexOf("  return ("));
  assert.match(submit, /if \(busy \|\| !verifiedUserId\) return/);
  assert.match(submit, /verified\.data\.user\?\.id !== verifiedUserId/);
  assert.ok(submit.indexOf("getUser()") < submit.indexOf("updateUser("));
  assert.match(submit, /scope: "global"/);
});

test("both recovery request paths use the recovery landing page", () => {
  for (const path of [
    "components/account/sign-in-form.tsx",
    "components/account/account-management.tsx",
  ]) {
    const ui = read(path);
    assert.match(ui, /redirectTo:\s*window\.location\.origin \+ "\/reset-password"/);
  }
  assert.match(read("app/reset-password/page.tsx"), /referrer: "no-referrer"/);
});
