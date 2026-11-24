import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  VERIFIED_LEADERBOARD_ENDPOINT,
  VERIFIED_LEADERBOARD_LIMIT,
  parseVerifiedLeaderboardResponse,
} from "../lib/leaderboard/verified-leaderboard.ts";

const payload = (results) => ({
  mode: "ranked",
  source: "server-verified",
  boardSize: 16,
  mineCount: 40,
  timing: "server-wall-clock",
  results,
});
const entry = (rank, durationMs, finishedAt = "2026-11-24T06:30:00Z") => ({
  rank,
  durationMs,
  finishedAt,
});

test("reads only the existing verified Intermediate endpoint", () => {
  assert.equal(
    VERIFIED_LEADERBOARD_ENDPOINT,
    "/api/ranked-results?boardSize=16&mineCount=40",
  );
  assert.equal(VERIFIED_LEADERBOARD_LIMIT, 50);
});

test("accepts an empty verified leaderboard without fabricating rows", () => {
  assert.deepEqual(parseVerifiedLeaderboardResponse(payload([])).results, []);
});

test("parses verified rankings and strips any extra or sensitive fields", () => {
  const result = parseVerifiedLeaderboardResponse(
    payload([
      { ...entry(1, 45320), userId: "private-id", email: "private@example.test" },
      { ...entry(2, 52700), matchId: "private-match" },
    ]),
  );
  assert.deepEqual(result.results, [entry(1, 45320), entry(2, 52700)]);
  assert.equal(JSON.stringify(result).includes("private"), false);
});

test("rejects unverified responses, other boards and unexpected payload shape", () => {
  for (const bad of [
    null,
    [],
    {},
    { ...payload([]), source: "browser" },
    { ...payload([]), boardSize: 9 },
    { ...payload([]), mineCount: 10 },
    { ...payload([]), mode: "practice" },
    { ...payload([]), timing: "client-clock" },
    { ...payload([]), results: null },
  ]) {
    assert.throws(() => parseVerifiedLeaderboardResponse(bad), /Invalid verified/);
  }
});

test("rejects forged ranks, invalid durations and unparseable dates", () => {
  for (const bad of [
    entry(2, 1000),
    entry(1, 0),
    entry(1, -100),
    entry(1, 1.5),
    entry(1, "2000"),
    entry(1, Number.MAX_SAFE_INTEGER + 1),
    entry(1, 1000, "not-a-date"),
    entry(1, 1000, "2026-11-24"),
    null,
  ]) {
    assert.throws(
      () => parseVerifiedLeaderboardResponse(payload([bad])),
      /Invalid verified/,
    );
  }
});

test("rejects unsorted times, tied times out of completion order and over 50 results", () => {
  assert.throws(
    () => parseVerifiedLeaderboardResponse(payload([entry(1, 3000), entry(2, 1000)])),
    /Invalid verified/,
  );
  assert.throws(
    () =>
      parseVerifiedLeaderboardResponse(
        payload([
          entry(1, 3000, "2026-11-24T09:30:00Z"),
          entry(2, 3000, "2026-11-24T06:30:00Z"),
        ]),
      ),
    /Invalid verified/,
  );
  assert.throws(
    () => parseVerifiedLeaderboardResponse(payload(Array(51).fill(entry(1, 1000)))),
    /Invalid verified/,
  );
});

test("leaderboard UI is read-only and reachable through the navbar", () => {
  const page = readFileSync("app/leaderboard/page.tsx", "utf8");
  const component = readFileSync(
    "components/leaderboard/verified-leaderboard.tsx",
    "utf8",
  );
  const navbar = readFileSync("components/play/navbar.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(page, /<VerifiedLeaderboard \/>/);
  assert.match(navbar, /label: "Leaderboard", icon: Trophy, route: "\/leaderboard"/);
  assert.match(component, /fetch\(PUBLIC_LEADERBOARD_ENDPOINT/);
  assert.match(component, /cache: "no-store"/);
  assert.match(component, /parsePublicStandings/);
  assert.match(component, /<table className="verified-board-table">/);
  assert.match(component, /role="alert"/);
  assert.match(component, /No public/);
  assert.match(css, /leaderboard\.css/);
  assert.doesNotMatch(component, /method:\s*"POST"|\.rpc\(|SUPABASE_SECRET_KEY/);
});
