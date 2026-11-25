import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { isFirstEmailConfirmation } from "../lib/account/email-confirmation.ts";

const message =
  "Confirmation link accepted. Please proceed to confirm link sent to the other email";
const params = () => new URLSearchParams({ kind: "email", message });
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("first secure email confirmation is recognized without an authorization code", () => {
  assert.equal(isFirstEmailConfirmation(params()), true);
  assert.equal(isFirstEmailConfirmation(new URLSearchParams(params().toString())), true);
});

test("first confirmation hint cannot override errors, codes or other auth flows", () => {
  for (const key of ["code", "error", "error_code", "error_description"]) {
    const query = params();
    query.set(key, "");
    assert.equal(isFirstEmailConfirmation(query), false);
  }
  for (const kind of ["signup", "recovery", "", "https://example.org"]) {
    const query = params();
    query.set("kind", kind);
    assert.equal(isFirstEmailConfirmation(query), false);
  }
  assert.equal(isFirstEmailConfirmation(new URLSearchParams({ kind: "email" })), false);
});

test("only the exact unambiguous provider message is accepted", () => {
  const query = params();
  query.append("message", message);
  assert.equal(isFirstEmailConfirmation(query), false);
  const other = params();
  other.append("kind", "signup");
  assert.equal(isFirstEmailConfirmation(other), false);
  assert.equal(
    isFirstEmailConfirmation(new URLSearchParams({ kind: "email", message: "success" })),
    false,
  );
});

test("email completion follows code exchange and status pages never authorize an action", () => {
  const route = read("app/auth/callback/route.ts");
  assert.match(
    route,
    /if \(isFirstEmailConfirmation\(params\)\) return emailStatus\("pending"\)/,
  );
  assert.ok(
    route.indexOf("exchangeCodeForSession(") < route.indexOf('emailStatus("complete")'),
  );
  assert.ok(
    route.indexOf("if (error) return fail()") < route.indexOf('emailStatus("complete")'),
  );
  assert.match(route, /return redirect\(callbackPath\(kind\)\)/);
  assert.match(route, /"Cache-Control", "no-store"/);
  const page = read("app/auth/email-change/page.tsx");
  assert.doesNotMatch(
    page,
    /verifyOtp|updateUser|exchangeCodeForSession|createAdminClient/,
  );
  assert.match(page, /referrer: "no-referrer"/);
});
