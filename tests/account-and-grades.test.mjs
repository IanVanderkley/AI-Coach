import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  validEmail,
  validUsername,
  passwordProblem,
  callbackPath,
  authError,
  confirmationMessage,
} from "../lib/account/validation.ts";
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
test("registration validates new credentials without restricting existing sign-in passwords", () => {
  assert.equal(validUsername("abc_123"), true);
  assert.equal(validUsername("a"), false);
  assert.equal(validUsername("a b"), false);
  assert.equal(validEmail("x@y.ca"), true);
  assert.equal(validEmail("x@y"), false);
  assert.equal(passwordProblem("longpass", "longpass"), null);
  assert.match(passwordProblem("short", "short"), /8/);
  assert.match(passwordProblem("longpass", "otherpass"), /match/);
  assert.match(passwordProblem("é".repeat(40), "é".repeat(40)), /72/);
  assert.match(
    read("components/account/sign-in-form.tsx"),
    /minLength=\{mode === "create" \? 8 : undefined\}/,
  );
});
test("email callback destinations are fixed and never follow an external URL", () => {
  assert.equal(callbackPath("recovery"), "/reset-password");
  assert.equal(callbackPath("email"), "/settings");
  assert.equal(callbackPath("https://example.org"), "/profile");
  assert.match(read("app/auth/callback/route.ts"), /exchangeCodeForSession\(\s*code\s*,/);
});
test("auth errors do not echo raw provider messages and recovery is enumeration-resistant", () => {
  assert.equal(
    authError({ code: "invalid_credentials", message: "private" }),
    "Email or password is incorrect.",
  );
  assert.doesNotMatch(authError({ message: "private" }), /private/);
  assert.match(confirmationMessage("recovery"), /If an account exists/);
  assert.match(read("components/account/sign-in-form.tsx"), /resetPasswordForEmail/);
  assert.match(read("components/account/sign-in-form.tsx"), /auth\.resend/);
});
test("reset requires a verified user and validates the new password", () => {
  const ui = read("components/account/reset-password-form.tsx");
  assert.match(ui, /auth\s*\.\s*getUser\(\)/);
  assert.match(ui, /passwordProblem\(/);
  assert.match(ui, /auth\.updateUser\(\{\s*password\s*\}\)/);
  assert.match(ui, /scope:\s*"global"/);
});
test("account deletion is disabled by default and targets only the reauthenticated owner", () => {
  const route = read("app/api/account/delete/route.ts");
  assert.match(route, /ACCOUNT_DELETION_ENABLED !== "true"/);
  assert.match(route, /readLimitedCoachJson\(request,\s*2048\)/);
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /data\.user\?\.id\s*!==\s*user\.id/);
  assert.match(route, /deleteUser\(user\.id,\s*false\)/);
  assert.ok(
    route.indexOf("admin.auth.admin.signOut") <
      route.indexOf("admin.auth.admin.deleteUser"),
  );
  assert.doesNotMatch(route, /body\.userId/);
});
test("automatic grades are opt-out, sequential, and never request a coaching provider", () => {
  const ui = read("components/coach/coach-console.tsx");
  const worker = ui.slice(
    ui.indexOf("async function populateGrades()"),
    ui.indexOf("const selectedReplay"),
  );
  assert.match(worker, /repository\.loadReview\(item\.id\)/);
  assert.match(worker, /scorePracticeReview\(recording\)/);
  assert.doesNotMatch(worker, /fetch\(|EvidenceCoachPanel|setSelection\(/);
  assert.match(ui, /!gradesReady \|\| !autoGrades \|\| reviewing/);
  assert.match(ui, /autoGrades \|\| reviewed\[game\.id\]/);
  assert.match(read("lib/settings/history-grades.ts"), /value !== false/);
  assert.match(read("lib/settings/history-grades.ts"), /auth\.updateUser/);
});
test("review and back actions use the same red flex button", () => {
  const ui = read("components/coach/coach-console.tsx");
  assert.match(ui, /className="practice-review-link coach-history-action"/);
  assert.match(ui, /className="coach-btn coach-history-action"/);
  const css = read("styles/coaching-lessons.css");
  assert.match(
    css,
    /\.coach-full-page \.coach-history-action\s*\{[^}]*display:\s*inline-flex[^}]*background:\s*#b62634/,
  );
});
