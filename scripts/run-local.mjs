import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const localUrl = "http://127.0.0.1:54321";

function jwtRole(key) {
  try {
    const pieces = key.split(".");
    if (pieces.length !== 3 || pieces.some((piece) => !piece)) return null;
    return JSON.parse(Buffer.from(pieces[1], "base64url").toString("utf8")).role;
  } catch {
    return null;
  }
}

// Only consume the three expected values; never evaluate CLI output as shell code.
export function localEnvironment(output, base = process.env) {
  const fields = new Map();
  for (const line of output.split(/\r?\n/)) {
    const match = /^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)="([^"\r\n]*)"$/.exec(line);
    if (!match) continue;
    if (fields.has(match[1])) throw new Error("Duplicate local configuration field.");
    fields.set(match[1], match[2]);
  }
  const anon = fields.get("ANON_KEY") ?? "";
  const service = fields.get("SERVICE_ROLE_KEY") ?? "";
  if (
    fields.get("API_URL") !== localUrl ||
    jwtRole(anon) !== "anon" ||
    jwtRole(service) !== "service_role"
  ) {
    throw new Error(
      "Local Supabase configuration missing or invalid. Start the local stack first.",
    );
  }
  return {
    ...base,
    NEXT_PUBLIC_SUPABASE_URL: localUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anon,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
    SUPABASE_SECRET_KEY: service,
    COACH_PAID_AI_ENABLED: "false",
    ACCOUNT_DELETION_ENABLED: "false",
    RANKED_AUTH_MODE: "",
    RANKED_AUTH_PROBE: "",
  };
}

async function main() {
  const mode = process.argv[2] ?? "--production";
  if (process.argv.length > 3 || !["--production", "--dev"].includes(mode))
    throw new Error("Use --production or --dev.");
  const root = fileURLToPath(new URL("../", import.meta.url));
  const next = resolve(root, "node_modules/next/dist/bin/next");
  if (!existsSync(next)) throw new Error("Install repository dependencies first.");
  // Only fixed arguments, no secrets passed to a command shell.
  const windows = process.platform === "win32";
  const result = spawnSync(
    windows ? "cmd.exe" : "npx",
    windows
      ? ["/d", "/s", "/c", "npx supabase status -o env"]
      : ["supabase", "status", "-o", "env"],
    { cwd: root, encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0 || result.error)
    throw new Error(
      "Cannot read local Supabase status. Check Docker and run npx supabase start.",
    );
  const env = localEnvironment(result.stdout);
  // Verify actual local API authorization before starting Next.js.
  const check = await fetch(`${localUrl}/rest/v1/ranked_matches?select=id&limit=1`, {
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
    },
    redirect: "error",
    signal: AbortSignal.timeout(5000),
  });
  if (!check.ok)
    throw new Error(`Local privileged API check failed (HTTP ${check.status}).`);
  await check.body?.cancel();
  console.log(
    "Local Supabase credentials verified. Paid AI and account deletion disabled.",
  );
  const run = (...args) =>
    spawnSync(process.execPath, [next, ...args], { cwd: root, env, stdio: "inherit" });
  if (mode === "--production") {
    const build = run("build");
    if (build.status !== 0 || build.error) {
      process.exitCode = build.status ?? 1;
      return;
    }
  }
  const server = run(
    mode === "--dev" ? "dev" : "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3000",
  );
  process.exitCode = server.status ?? (server.signal === "SIGINT" ? 0 : 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    // Avoid logging exception objects that could contain request credentials.
    console.error(
      error instanceof Error && /^(Local |Cannot |Install |Use )/.test(error.message)
        ? error.message
        : "Local launcher failed. Check Docker and port 3000.",
    );
    process.exitCode = 1;
  });
}
