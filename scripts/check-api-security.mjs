import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// No cookies, credentials, remote targets, or successful gameplay mutations.
const move = JSON.stringify({
  matchId: "12345678-1234-4123-8123-123456789abc",
  row: 0,
  column: 0,
  expectedMoveCount: 0,
  firstMoveDone: false,
});
const json = { "Content-Type": "application/json" };
const evil = { Origin: "https://outside.invalid" };
const start = "/api/ranked/matches";
const preferences = "/api/leaderboard/preferences";
const verified = "/api/ranked-results?boardSize=16&mineCount=40";

export const cases = [
  { name: "Public standings", path: "/api/leaderboard", status: 200, shape: "standings" },
  { name: "Public verified results", path: verified, status: 200, shape: "results" },
  {
    name: "Invalid leaderboard board",
    path: "/api/ranked-results?boardSize=99&mineCount=40",
    status: 400,
  },
  { name: "Private history", path: "/api/ranked/history", status: 401 },
  { name: "Private active match", path: `${start}/current`, status: 401 },
  {
    name: "Private lifetime statistics",
    path: "/api/profile/ranked-lifetime",
    status: 401,
  },
  { name: "Private leaderboard settings", path: preferences, status: 401 },
  { name: "Anonymous match start", path: start, method: "POST", status: 401 },
  { name: "Cross-origin start", path: start, method: "POST", headers: evil, status: 403 },
  {
    name: "Unexpected start body",
    path: start,
    method: "POST",
    headers: json,
    body: "{}",
    status: 400,
  },
  ...["reveal", "flag", "chord"].map((action) => ({
    name: `Anonymous ${action}`,
    path: `${start}/${action}`,
    method: "POST",
    headers: json,
    body: move,
    status: 401,
  })),
  {
    name: "Cross-origin flag",
    path: `${start}/flag`,
    method: "POST",
    headers: { ...json, ...evil },
    body: move,
    status: 403,
  },
  {
    name: "Same-site foreign request",
    path: `${start}/flag`,
    method: "POST",
    headers: { ...json, "Sec-Fetch-Site": "same-site" },
    body: move,
    status: 403,
  },
  {
    name: "Wrong move content type",
    path: `${start}/reveal`,
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: move,
    status: 415,
  },
  {
    name: "Malformed move JSON",
    path: `${start}/chord`,
    method: "POST",
    headers: json,
    body: "{",
    status: 400,
  },
  {
    name: "Oversized move",
    path: `${start}/flag`,
    method: "POST",
    headers: json,
    body: JSON.stringify({ padding: "x".repeat(1100) }),
    status: 413,
  },
  {
    name: "Cross-origin privacy update",
    path: preferences,
    method: "PUT",
    headers: { ...json, ...evil },
    body: "{}",
    status: 403,
  },
  {
    name: "Missing privacy origin",
    path: preferences,
    method: "PUT",
    headers: json,
    body: "{}",
    status: 403,
  },
  {
    name: "Anonymous privacy update",
    path: preferences,
    method: "PUT",
    headers: json,
    sameOrigin: true,
    body: JSON.stringify({ isAnonymous: true }),
    status: 401,
  },
  {
    name: "Cross-origin direct result submission",
    path: "/api/ranked-results",
    method: "POST",
    headers: evil,
    status: 403,
  },
];

export function localTarget(value = "http://localhost:3000") {
  if (!new Set(["http://localhost:3000", "http://127.0.0.1:3000"]).has(value))
    throw new Error("Only http://localhost:3000 or http://127.0.0.1:3000 is allowed.");
  return value;
}

function exactKeys(value, keys) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort())
  );
}

function rows(value, keys) {
  return (
    Array.isArray(value) &&
    value.length <= 50 &&
    value.every((row, i) => exactKeys(row, keys) && row.rank === i + 1)
  );
}

export function validShape(value, shape) {
  if (shape === "standings") {
    return (
      exactKeys(value, ["source", "ratingSystem", "board", "elo", "fastest"]) &&
      value.source === "server-verified" &&
      value.ratingSystem === "solo-elo-benchmark-v1" &&
      value.board === "intermediate-16x16-40" &&
      rows(value.elo, ["rank", "username", "rating", "games", "wins", "losses"]) &&
      rows(value.fastest, ["rank", "username", "durationMs", "finishedAt"])
    );
  }
  if (shape === "results") {
    return (
      exactKeys(value, [
        "mode",
        "source",
        "boardSize",
        "mineCount",
        "timing",
        "results",
      ]) &&
      value.mode === "ranked" &&
      value.source === "server-verified" &&
      value.boardSize === 16 &&
      value.mineCount === 40 &&
      value.timing === "server-wall-clock" &&
      rows(value.results, ["rank", "durationMs", "finishedAt"])
    );
  }
  return (
    exactKeys(value, ["error"]) &&
    typeof value.error === "string" &&
    value.error.length > 0
  );
}

export async function checkApiSecurity({
  base = "http://localhost:3000",
  fetcher = fetch,
  report = () => {},
} = {}) {
  const origin = localTarget(base);
  const failures = [];
  for (const item of cases) {
    try {
      const response = await fetcher(`${origin}${item.path}`, {
        method: item.method ?? "GET",
        headers: { ...item.headers, ...(item.sameOrigin ? { Origin: origin } : {}) },
        ...(item.body === undefined ? {} : { body: item.body }),
        credentials: "omit",
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (response.status !== item.status) {
        await response.body?.cancel();
        throw new Error(`expected HTTP ${item.status}, received ${response.status}`);
      }
      if (
        !response.headers
          .get("cache-control")
          ?.split(",")
          .some((v) => v.trim().toLowerCase() === "no-store")
      ) {
        await response.body?.cancel();
        throw new Error("missing no-store");
      }
      if (!validShape(await response.json(), item.shape))
        throw new Error("unexpected JSON response fields");
      report(`PASS ${item.name} (${item.status})`);
    } catch (error) {
      const message =
        error instanceof Error &&
        /^(expected HTTP|missing no-store|unexpected JSON)/.test(error.message)
          ? error.message
          : "request or JSON parsing failed";
      failures.push(`${item.name}: ${message}`);
      report(`FAIL ${item.name}: ${message}`);
    }
  }
  return { passed: cases.length - failures.length, total: cases.length, failures };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await checkApiSecurity({ base: process.argv[2], report: console.log });
    console.log(`API security: ${result.passed}/${result.total} passed`);
    if (result.failures.length) process.exitCode = 1;
  } catch {
    console.error("Run the smoke test against localhost:3000 only.");
    process.exitCode = 1;
  }
}
