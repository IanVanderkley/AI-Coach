import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  EMAIL_UNAVAILABLE_MESSAGE,
  isEmailUnavailable,
} from "../lib/account/email-change-feedback.ts";

test("email change recognizes explicit duplicate-address errors", () => {
  assert.equal(isEmailUnavailable({ code: "email_exists" }), true);
  assert.equal(isEmailUnavailable({ code: "user_already_exists" }), true);
  assert.match(EMAIL_UNAVAILABLE_MESSAGE, /unavailable/);
});

test("unrelated authentication and delivery errors are not duplicate errors", () => {
  for (const error of [
    null,
    undefined,
    "email_exists",
    {},
    { code: "conflict" },
    { code: "over_email_send_rate_limit" },
    { message: "email already exists" },
  ]) {
    assert.equal(isEmailUnavailable(error), false);
  }
});

test("account settings uses an accessible modal for explicit rejection only", () => {
  const source = readFileSync(
    new URL("../components/account/account-management.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /if\s*\(isEmailUnavailable\(error\)\)/);
  assert.match(source, /emailDialog\.current\?\.showModal\(\)/);
  assert.match(source, /<dialog\b/);
  assert.match(source, /aria-labelledby="email-unavailable-title"/);
  assert.match(source, /emailDialog\.current\?\.close\(\)/);
  const signIn = readFileSync(
    new URL("../components/account/sign-in-form.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(signIn, /isEmailUnavailable|EMAIL_UNAVAILABLE_MESSAGE/);
});
