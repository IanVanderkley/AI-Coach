import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  AI_COACH_STAGING_REF,
  inspectDeploymentEnvironment,
  runDeploymentPreflight,
} from "../scripts/verify-deployment-config.mjs";

const BASE = {
  NEXT_PUBLIC_SUPABASE_URL: `https://${AI_COACH_STAGING_REF}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-public-publishable-key",
  SUPABASE_SECRET_KEY: "test-server-only-secret-key",
  COACH_PAID_AI_ENABLED: "false",
};
function inspect(changes = {}) {
  return inspectDeploymentEnvironment({ ...BASE, ...changes });
}
function rejects(changes, message) {
  const result = inspect(changes);
  assert.equal(result.ok, false);
  assert.match(result.failures.join(" "), message);
}

test("only the approved AI-Coach staging project is accepted", () => {
  assert.equal(inspect().ok, true);
  assert.equal(AI_COACH_STAGING_REF, "bzjkmiwwrpcshumamkvq");
  rejects(
    { NEXT_PUBLIC_SUPABASE_URL: "https://squusumcekygqdkaabcm.supabase.co" },
    /AI-Coach-Staging/,
  );
  rejects(
    { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" },
    /AI-Coach-Staging/,
  );
});

test("missing or malformed public URL fails closed", () => {
  rejects({ NEXT_PUBLIC_SUPABASE_URL: "" }, /required/);
  rejects({ NEXT_PUBLIC_SUPABASE_URL: "not-a-url" }, /malformed/);
  for (const value of [
    `http://${AI_COACH_STAGING_REF}.supabase.co`,
    `https://${AI_COACH_STAGING_REF}.supabase.co/path`,
    `https://${AI_COACH_STAGING_REF}.supabase.co/?debug=1`,
    `https://person:pass@${AI_COACH_STAGING_REF}.supabase.co`,
    `https://${AI_COACH_STAGING_REF}.supabase.co/#fragment`,
  ])
    rejects({ NEXT_PUBLIC_SUPABASE_URL: value }, /AI-Coach-Staging/);
});

test("server and publishable Supabase keys are both required", () => {
  rejects({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "" }, /PUBLISHABLE_KEY/);
  rejects({ SUPABASE_SECRET_KEY: "" }, /SUPABASE_SECRET_KEY/);
  rejects(
    {
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "legacy-anon-key",
    },
    /PUBLISHABLE_KEY/,
  );
});

test("server-only key cannot equal either browser key", () => {
  rejects(
    { SUPABASE_SECRET_KEY: BASE.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
    /must not equal/,
  );
  rejects(
    { SUPABASE_SECRET_KEY: "legacy", NEXT_PUBLIC_SUPABASE_ANON_KEY: "legacy" },
    /must not equal/,
  );
});

test("secret-looking browser environment variable names are refused", () => {
  rejects(
    { NEXT_PUBLIC_SUPABASE_SECRET_KEY: "private-test-value" },
    /NEXT_PUBLIC_SUPABASE_SECRET_KEY/,
  );
  rejects(
    { NEXT_PUBLIC_OPENAI_API_KEY: "private-test-value" },
    /NEXT_PUBLIC_OPENAI_API_KEY/,
  );
  rejects({ NEXT_PUBLIC_SERVICE_ROLE: "private-test-value" }, /NEXT_PUBLIC_SERVICE_ROLE/);
});

test("paid AI stays disabled for staging preview", () => {
  assert.equal(inspect({ COACH_PAID_AI_ENABLED: "" }).ok, true);
  assert.equal(inspect({ COACH_PAID_AI_ENABLED: "FALSE" }).ok, true);
  rejects({ COACH_PAID_AI_ENABLED: "true" }, /must be false/);
  rejects({ COACH_PAID_AI_ENABLED: "yes" }, /must be false/);
});

test("experimental claims authentication is blocked", () => {
  rejects({ RANKED_AUTH_MODE: "claims" }, /claims authentication/);
  rejects({ RANKED_AUTH_PROBE: "claims" }, /claims authentication/);
});

test("staging guard refuses Vercel production environment", () => {
  rejects({ VERCEL_ENV: "production" }, /production deployment/);
  assert.equal(inspect({ VERCEL_ENV: "preview" }).ok, true);
});

test("CLI requires an explicit staging target", () => {
  const messages = [];
  const io = { log: (s) => messages.push(s), error: (s) => messages.push(s) };
  assert.equal(runDeploymentPreflight([], BASE, io), 1);
  assert.equal(runDeploymentPreflight(["--target=production"], BASE, io), 1);
  assert.equal(runDeploymentPreflight(["--target=staging"], BASE, io), 0);
  assert.match(messages.join(" "), /Only AI-Coach-Staging previews/);
});

test("preflight diagnostics never print secret values", () => {
  const messages = [];
  const io = { log: (s) => messages.push(s), error: (s) => messages.push(s) };
  const env = {
    ...BASE,
    SUPABASE_SECRET_KEY: "extremely-private-test-value",
    NEXT_PUBLIC_SUPABASE_SECRET_KEY: "another-secret-test-value",
  };
  assert.equal(runDeploymentPreflight(["--target=staging"], env, io), 1);
  const output = messages.join(" ");
  assert.doesNotMatch(
    output,
    /extremely-private-test-value|another-secret-test-value|test-public-publishable-key/,
  );
});

test("legacy Ranked config checker delegates instead of referring to MindSweeper", () => {
  const source = readFileSync("scripts/verify-ranked-config.mjs", "utf8");
  assert.match(source, /runDeploymentPreflight/);
  assert.match(source, /--target=staging/);
  assert.doesNotMatch(source, /squusumcekygqdkaabcm/);
});

test("anonymous HTTP smoke suite covers both private statistics endpoints", () => {
  const source = readFileSync("scripts/check-ranked-http.mjs", "utf8");
  assert.match(source, /Unauthenticated Ranked history/);
  assert.match(source, /Unauthenticated Ranked lifetime statistics/);
  assert.match(source, /\/api\/profile\/ranked-lifetime/);
  assert.match(source, /\/api\/ranked\/history/);
  assert.match(source, /expected: 401/);
});

test("release documentation distinguishes preview from public launch", () => {
  const guide = readFileSync("docs/DEPLOYMENT-READINESS.md", "utf8");
  const readme = readFileSync("README.md", "utf8");
  assert.match(guide, /AI-Coach-Staging/);
  assert.match(guide, /Preview.*Production/s);
  assert.match(guide, /account switching/i);
  assert.match(guide, /COACH_PAID_AI_ENABLED=false/);
  assert.match(readme, /tracked account statistics/i);
  assert.match(readme, /verify-deployment-config/);
  assert.doesNotMatch(
    readme,
    /Durable, account-backed gameplay history \(currently a limited browser-tab history\)/,
  );
});
