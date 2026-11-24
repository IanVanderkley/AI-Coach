import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Release guard for AI-Coach's STAGING preview only. Never prints secret values. */
export const AI_COACH_STAGING_REF = "bzjkmiwwrpcshumamkvq";
const EXPECTED_HOST = `${AI_COACH_STAGING_REF}.supabase.co`;
const FORBIDDEN_PUBLIC_NAME =
  /(SECRET|SERVICE_ROLE|PRIVATE_KEY|API_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY)/i;

const present = (value) => typeof value === "string" && value.trim().length > 0;

/** Pure validator: accepts an injected environment for deterministic tests. */
export function inspectDeploymentEnvironment(env) {
  const failures = [];
  const success = [];
  const urlText = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!present(urlText)) {
    failures.push("NEXT_PUBLIC_SUPABASE_URL is required.");
  } else {
    try {
      const url = new URL(urlText.trim());
      if (
        url.protocol !== "https:" ||
        url.hostname !== EXPECTED_HOST ||
        url.port ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      ) {
        failures.push(
          "The public Supabase URL must be the exact AI-Coach-Staging origin.",
        );
      } else {
        success.push("Supabase host matches the approved AI-Coach-Staging project.");
      }
    } catch {
      failures.push("NEXT_PUBLIC_SUPABASE_URL is malformed.");
    }
  }

  const publicKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serverKey = env.SUPABASE_SECRET_KEY;
  if (!present(publicKey)) {
    failures.push(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required by server and browser auth.",
    );
  } else {
    success.push("Browser publishable key is configured.");
  }
  if (!present(serverKey)) {
    failures.push("SUPABASE_SECRET_KEY is required by server-owned Ranked routes.");
  } else {
    success.push("Server-only Supabase key is configured.");
  }
  if (
    present(serverKey) &&
    (serverKey.trim() === publicKey?.trim() ||
      (present(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
        serverKey.trim() === env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim()))
  ) {
    failures.push("The server-only key must not equal any browser key.");
  }

  const exposed = Object.keys(env).filter(
    (key) =>
      key.startsWith("NEXT_PUBLIC_") &&
      FORBIDDEN_PUBLIC_NAME.test(key) &&
      present(env[key]),
  );
  if (exposed.length) {
    // Variable names are useful; secret VALUES must never appear in diagnostics.
    failures.push(`Secret-looking variables are public: ${exposed.join(", ")}.`);
  } else {
    success.push("No secret-looking NEXT_PUBLIC_ variables are populated.");
  }

  const paid = env.COACH_PAID_AI_ENABLED?.trim().toLowerCase();
  if (paid && paid !== "false") {
    failures.push("COACH_PAID_AI_ENABLED must be false or unset for this preview.");
  }
  if (
    env.RANKED_AUTH_MODE?.trim().toLowerCase() === "claims" ||
    env.RANKED_AUTH_PROBE?.trim().toLowerCase() === "claims"
  ) {
    failures.push("Experimental Ranked claims authentication must remain disabled.");
  }
  if (env.VERCEL_ENV?.trim().toLowerCase() === "production") {
    failures.push("This staging preflight must not be run for a production deployment.");
  }
  if (failures.length === 0) {
    success.push(
      "Preview preflight passed; live auth and browser checks are still required.",
    );
  }
  return { ok: failures.length === 0, failures, success };
}

/** Requires an explicit staging target so this cannot bless an unknown production host. */
export function runDeploymentPreflight(args, env = process.env, output = console) {
  if (args.length !== 1 || args[0] !== "--target=staging") {
    output.error("Usage: node scripts/verify-deployment-config.mjs --target=staging");
    output.error("Only AI-Coach-Staging previews are supported by this release guard.");
    return 1;
  }
  const result = inspectDeploymentEnvironment(env);
  for (const item of result.success) output.log(`PASS ${item}`);
  for (const item of result.failures) output.error(`FAIL ${item}`);
  if (!result.ok)
    output.error(`${result.failures.length} deployment configuration check(s) failed.`);
  return result.ok ? 0 : 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = runDeploymentPreflight(process.argv.slice(2));
}
