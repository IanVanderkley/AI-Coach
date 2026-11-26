import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  authLinkFailurePath,
  readSignInNotice,
} from "../lib/account/auth-link-feedback.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const notice = (query) => readSignInNotice(new URLSearchParams(query));

test("failed callbacks use fixed internal destinations without forwarding provider details", () => {
  assert.equal(authLinkFailurePath("signup"), "/sign-in?authError=signup#auth-link");
  assert.equal(authLinkFailurePath("recovery"), "/sign-in?authError=recovery#auth-link");
  assert.equal(
    authLinkFailurePath("email"),
    "/auth/email-change?status=error#email-change",
  );
  for (const kind of [null, "https://example.com", "signup&next=evil"]) {
    assert.equal(authLinkFailurePath(kind), "/sign-in?authError=link#auth-link");
  }
});

test("signup and legacy invalid links guide players to sign in first", () => {
  for (const query of ["authError=signup", "authError=link", "authError=unknown"]) {
    const result = notice(query);
    assert.equal(result.mode, "sign-in");
    assert.equal(result.isError, true);
    assert.match(result.message, /already verified, sign in below/);
    assert.match(result.message, /request a new verification email/);
  }
});

test("failed recovery links and direct recovery links select the reset request form", () => {
  assert.equal(notice("authError=recovery").mode, "recover");
  assert.equal(notice("authError=recovery").isError, true);
  assert.deepEqual(notice("mode=recover"), {
    mode: "recover",
    message: "",
    isError: false,
  });
  assert.equal(notice("mode=recover&mode=signup"), null);
});

test("untrusted and ambiguous query input never becomes a displayed provider error or external redirect", () => {
  const result = notice(
    "authError=recovery&authError=signup&error_description=PRIVATE&next=https://example.com&passwordChanged=1",
  );
  assert.equal(result.mode, "sign-in");
  assert.equal(result.isError, true);
  assert.doesNotMatch(result.message, /PRIVATE|example.com/);
  assert.equal(notice("next=https://example.com&error_description=PRIVATE"), null);
});

test("existing sign-in success notices remain informational", () => {
  assert.equal(
    notice("passwordChanged=1").message,
    "Password updated. Sign in with your new password.",
  );
  assert.equal(notice("accountDeleted=1").message, "Account deleted.");
  assert.equal(notice("passwordChanged=1").isError, false);
  assert.equal(notice(""), null);
});

test("UI wires safe feedback while preserving code exchange and explicit recovery verification", () => {
  const callback = read("app/auth/callback/route.ts");
  assert.match(callback, /redirect\(authLinkFailurePath\(kind\)\)/);
  assert.match(callback, /exchangeCodeForSession\(/);
  assert.match(callback, /return redirect\(callbackPath\(kind\)\)/);
  const signIn = read("components/account/sign-in-form.tsx");
  assert.match(
    signIn,
    /readSignInNotice\(new URLSearchParams\(window.location.search\)\)/,
  );
  assert.match(signIn, /setMode\(notice.mode\)/);
  assert.match(signIn, /signInWithPassword\(/);
  assert.match(signIn, /auth\.resend\(/);
  const recovery = read("components/account/reset-password-form.tsx");
  assert.match(recovery, /href="\/sign-in\?mode=recover"/);
  assert.match(recovery, /onClick=\{\(\) => void confirmRecovery\(\)\}/);
  assert.match(recovery, /verifyOtp\(/);
  assert.match(read("app/sign-in/page.tsx"), /referrer: "no-referrer"/);
});
