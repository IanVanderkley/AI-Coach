import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  deletionDigest,
  newDeletionChallenge,
  parseDeletionAction,
} from "../lib/account/deletion-verification.ts";
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const id = "12345678-1234-4123-8123-123456789abc";
const issue = { action: "issue", password: "test-password", confirmation: "DELETE" };
const final = { action: "delete", challengeId: id, code: "012345" };

test("deletion parser rejects legacy password-only requests and extra identity fields", () => {
  assert.equal(
    parseDeletionAction({ password: "test-password", confirmation: "DELETE" }),
    null,
  );
  assert.equal(parseDeletionAction({ ...final, userId: id }), null);
  assert.equal(parseDeletionAction({ ...issue, email: "other@example.com" }), null);
  assert.deepEqual(parseDeletionAction(issue), issue);
  assert.deepEqual(parseDeletionAction(final), final);
  assert.deepEqual(parseDeletionAction({ action: "cancel", challengeId: id }), {
    action: "cancel",
    challengeId: id,
  });
});
test("issuance requires password and confirmation; deletion requires a six digit code", () => {
  for (const body of [
    { ...final, code: "12345" },
    { ...final, code: 123456 },
    { ...final, code: "12345a" },
    { ...final, challengeId: "bad" },
    { ...final, password: "test-password" },
    { ...final, confirmation: "DELETE" },
    { ...issue, password: "" },
    { ...issue, confirmation: "delete" },
    { ...issue, password: "x".repeat(1025) },
    null,
    [],
  ])
    assert.equal(parseDeletionAction(body), null);
});
test("challenge generation uses unique UUIDs and six digit codes", () => {
  const results = Array.from({ length: 100 }, newDeletionChallenge);
  assert.equal(new Set(results.map((x) => x.challengeId)).size, 100);
  for (const result of results) {
    assert.match(result.challengeId, /^[0-9a-f-]{36}$/);
    assert.match(result.code, /^\d{6}$/);
  }
});
test("HMAC binds the code to key, account, session, address and challenge", () => {
  const args = ["ab".repeat(32), id, id, "a@example.com", id, "012345"];
  const digest = deletionDigest(...args);
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.equal(digest, deletionDigest(...args));
  for (const [i, changed] of [
    "cd".repeat(32),
    "another-user",
    "another-session",
    "b@example.com",
    "other-challenge",
    "012346",
  ].entries()) {
    const copy = [...args];
    copy[i] = changed;
    assert.notEqual(digest, deletionDigest(...copy));
  }
  assert.throws(() => deletionDigest("weak", ...args.slice(1)));
});
test("endpoint consumes an account and session-bound challenge before global revocation and deletion", () => {
  const route = read("app/api/account/delete/route.ts");
  assert.match(route, /ACCOUNT_DELETION_ENABLED !== "true"/);
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /auth\.getClaims\(\)/);
  assert.match(route, /claimsData\?\.claims\.sub !== user\.id/);
  assert.match(route, /p_session_id:\s*sessionId/);
  assert.match(route, /p_email:\s*user\.email/);
  assert.match(route, /data\.user\?\.id !== user\.id/);
  assert.match(route, /consumed !== "consumed"/);
  assert.ok(
    route.indexOf('consumed !== "consumed"') < route.indexOf("admin.auth.admin.signOut"),
  );
  assert.ok(
    route.indexOf("admin.auth.admin.signOut") <
      route.indexOf("admin.auth.admin.deleteUser"),
  );
  assert.match(route, /success\(\{ challengeId \}\)/);
  assert.doesNotMatch(route, /console\.|success\(\{[^}]*\bcode\b/);
});
test("email delivery uses server-only configuration and cancellation is explicit", () => {
  const mail = read("lib/account/deletion-mail.ts");
  const ui = read("components/account/account-deletion-form.tsx");
  assert.match(mail, /import "server-only"/);
  assert.match(mail, /process\.env\.RESEND_ACCOUNT_DELETION_API_KEY/);
  assert.match(mail, /to:\s*\[email\]/);
  assert.doesNotMatch(mail, /console\.|NEXT_PUBLIC/);
  assert.match(ui, /autoComplete="one-time-code"/);
  assert.match(ui, /Verify code and permanently delete account/);
  assert.match(ui, /action:\s*"cancel"/);
  assert.match(ui, /form\.reset\(\)/);
});

test("final deletion sends only the code and challenge, after fresh server identity verification", () => {
  const route = read("app/api/account/delete/route.ts");
  const ui = read("components/account/account-deletion-form.tsx");
  assert.match(route, /body.action === "issue"[\s\S]*signInWithPassword/);
  assert.match(route, /auth\.getUser\(accessToken\)/);
  assert.match(route, /finalClaims\.claims\.session_id !== sessionId/);
  assert.match(route, /admin\.auth\.admin\.signOut\(accessToken,\s*"global"\)/);
  assert.match(ui, /send\(\{\s*action: "delete",\s*challengeId,\s*code\s*,?\s*\}\)/);
  assert.match(ui, /length: 6/);
  assert.match(ui, /disabled=\{busy \|\| code.length !== 6\}/);
  assert.doesNotMatch(ui, /localStorage|sessionStorage/);
  assert.equal(
    parseDeletionAction({ ...final, password: "test-password", confirmation: "DELETE" }),
    null,
  );
});

test("verification card shows an accessible error dialog and full-width primary action", () => {
  const ui = read("components/account/account-deletion-form.tsx");
  assert.match(ui, /Invalid verification code/);
  assert.match(ui, /Verification code unavailable/);
  assert.match(ui, /invalidDialog\.current\?\.showModal\(\)/);
  assert.match(ui, /onClose=\{dismissCodeError\}/);
  assert.match(ui, /setCode\(""\);\s*setCodeError\("incorrect"\)/);
  assert.match(ui, /setCode\(""\);\s*setCodeError\("unavailable"\)/);
  assert.match(
    ui,
    /className="auth-submit"\s+style=\{\{\s*width: "100%",[\s\S]*?alignSelf: "stretch"/,
  );
  assert.match(ui, /disabled=\{busy \|\| code.length !== 6\}/);
});
