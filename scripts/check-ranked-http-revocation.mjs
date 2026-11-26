// LOCAL ONLY. A disposable account is created and removed. No token is printed.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { localEnvironment } from "./run-local.mjs";

const api = "http://127.0.0.1:54321";
const app = "http://127.0.0.1:3000";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (message) => {
  throw new Error(message);
};
const windows = process.platform === "win32";
let admin, userId;
const cookieJar = new Map();
function db(sql) {
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_Ai-Coach",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: sql, encoding: "utf8", timeout: 15000 },
  );
  if (result.error || result.status !== 0) fail("Local SQL probe failed.");
  return result.stdout.trim();
}
async function request(path, method = "GET", body, cookie) {
  // Non-browser probe: do not synthesize an Origin header. Ranked accepts absent
  // Origin for non-browser clients; explicit browser-origin checks remain separate.
  const headers = {
    ...(cookie ? { Cookie: cookie } : {}),
    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
  };
  const response = await fetch(app + path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return {
    status: response.status,
    data,
    noStore: response.headers.get("cache-control")?.includes("no-store"),
  };
}
function expect(response, status, label) {
  if (response.status !== status || !response.noStore)
    fail(`${label}: expected HTTP ${status} and no-store, got HTTP ${response.status}.`);
  console.log(`PASS HTTP ${status}: ${label}`);
}
async function main() {
  const status = spawnSync(
    windows ? "cmd.exe" : "npx",
    windows
      ? ["/d", "/s", "/c", "npx supabase status -o env"]
      : ["supabase", "status", "-o", "env"],
    { encoding: "utf8", timeout: 20000, windowsHide: true },
  );
  if (status.error || status.status !== 0)
    fail("Cannot read local Supabase configuration.");
  const env = localEnvironment(status.stdout, {});
  if (env.NEXT_PUBLIC_SUPABASE_URL !== api) fail("Refusing nonlocal database.");
  expect(await request("/api/ranked/matches/current"), 401, "anonymous recovery");
  admin = createClient(api, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const email = `ranked-revoke-${randomBytes(10).toString("hex")}@example.com`;
  const password = randomBytes(32).toString("hex");
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !uuid.test(created.data.user?.id ?? ""))
    fail("Could not create disposable local user.");
  userId = created.data.user.id;
  const client = createServerClient(api, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => Array.from(cookieJar, ([name, value]) => ({ name, value })),
      setAll: (items) => {
        for (const { name, value, options } of items) {
          if (options?.maxAge === 0 || !value) cookieJar.delete(name);
          else cookieJar.set(name, value);
        }
      },
    },
  });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session || !cookieJar.size)
    fail("Local fixture sign-in failed.");
  // Decode only our own fixture token to locate its session; the application verifies it independently.
  const claims = JSON.parse(
    Buffer.from(signedIn.data.session.access_token.split(".")[1], "base64url").toString(
      "utf8",
    ),
  );
  if (claims.sub !== userId || !uuid.test(claims.session_id ?? ""))
    fail("Fixture session identity missing.");
  const sessionId = claims.session_id;
  const cookie = Array.from(
    cookieJar,
    ([name, value]) => `${name}=${encodeURIComponent(value)}`,
  ).join("; ");
  const start = await request("/api/ranked/matches", "POST", undefined, cookie);
  expect(start, 200, "authenticated start");
  const matchId = start.data?.matchId;
  if (!uuid.test(matchId ?? "")) fail("Invalid fixture match response.");
  const reveal = await request(
    "/api/ranked/matches/reveal",
    "POST",
    { matchId, row: 8, column: 8, expectedMoveCount: 0 },
    cookie,
  );
  expect(reveal, 200, "authenticated first reveal");
  expect(
    await request("/api/ranked/matches/current", "GET", undefined, cookie),
    200,
    "authenticated recovery",
  );
  if (
    db(
      `SELECT count(*) FROM public.ranked_matches WHERE id='${matchId}' AND user_id='${userId}' AND status='active' AND move_count=1;`,
    ) !== "1"
  )
    fail("Local fixture board did not match the HTTP request.");
  if (
    db(
      `WITH removed AS (DELETE FROM auth.sessions WHERE id='${sessionId}' AND user_id='${userId}' RETURNING 1) SELECT count(*) FROM removed;`,
    ) !== "1"
  )
    fail("Fixture session was not revoked.");
  console.log("PASS: disposable session revoked; original cookie retained for replay.");
  const failures = [];
  for (const [label, path, method, body] of [
    ["revoked recovery", "/api/ranked/matches/current", "GET", undefined],
    [
      "revoked reveal",
      "/api/ranked/matches/reveal",
      "POST",
      { matchId, row: 0, column: 0, expectedMoveCount: 1 },
    ],
    [
      "revoked flag",
      "/api/ranked/matches/flag",
      "POST",
      { matchId, row: 0, column: 0, expectedMoveCount: 1 },
    ],
    [
      "revoked chord",
      "/api/ranked/matches/chord",
      "POST",
      { matchId, row: 8, column: 8, expectedMoveCount: 1 },
    ],
    ["revoked start", "/api/ranked/matches", "POST", undefined],
  ]) {
    const res = await request(path, method, body, cookie);
    if (res.status === 401 && res.noStore) console.log(`PASS HTTP 401: ${label}`);
    else {
      console.error(`FAIL HTTP ${res.status}: ${label} (expected 401 and no-store)`);
      failures.push(label);
    }
  }
  const unchanged = db(
    `SELECT count(*) FROM public.ranked_matches WHERE id='${matchId}' AND user_id='${userId}' AND status='active' AND move_count=1;`,
  );
  if (unchanged !== "1") {
    console.error("FAIL: revoked requests changed fixture board.");
    failures.push("board changed");
  } else console.log("PASS: fixture board unchanged after revoked requests.");
  if (failures.length) fail(`${failures.length} revocation checks failed.`);
  console.log("Ranked HTTP session revocation checks passed.");
}
try {
  await main();
} catch (error) {
  // Never log raw SDK responses, cookie values or credential-bearing error objects.
  console.error(
    "HTTP revocation probe failed. Review PASS/FAIL lines above; no credentials printed.",
  );
  if (
    error instanceof Error &&
    /^(Local SQL|Cannot read|Refusing|Could not create|Local fixture|Fixture session|Invalid fixture|Local fixture board|anonymous recovery|authenticated|\d+ revocation)/.test(
      error.message,
    )
  )
    console.error(error.message);
  process.exitCode = 1;
} finally {
  if (admin && userId) {
    try {
      const removed = await admin.auth.admin.deleteUser(userId);
      if (removed.error) fail("Fixture cleanup failed.");
      if (db(`SELECT count(*) FROM auth.users WHERE id='${userId}';`) !== "0")
        fail("Fixture cleanup incomplete.");
      console.log("Disposable fixture cleaned up.");
    } catch {
      console.error(`Fixture cleanup failed; local disposable user ID: ${userId}`);
      process.exitCode = 1;
    }
  }
}
