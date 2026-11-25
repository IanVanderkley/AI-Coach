import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  PUBLIC_LEADERBOARD_ENDPOINT,
  calculateSoloElo,
  projectPublicStandings,
  parsePublicStandings,
} from "../lib/leaderboard/public-standings.ts";

const read = (path) => readFileSync(path, "utf8");
const time = "2026-11-24T10:00:00Z";
const sampleElo = [
  { username: "Player_One", rating: 1016, games: 1, wins: 1, losses: 0 },
  { username: "Player_Two", rating: 984, games: 1, wins: 0, losses: 1 },
];
const sampleFast = [{ username: "Player_One", duration_ms: 54321, finished_at: time }];

test("solo Elo-style rating starts at 1000 with +16 / -16 versus benchmark", () => {
  assert.deepEqual(calculateSoloElo(1000, "won"), { rating: 1016, delta: 16 });
  assert.deepEqual(calculateSoloElo(1000, "lost"), { rating: 984, delta: -16 });
  assert.ok(calculateSoloElo(1016, "won").delta < 16);
  assert.ok(calculateSoloElo(984, "lost").delta > -16);
  assert.throws(() => calculateSoloElo(0, "won"));
  assert.throws(() => calculateSoloElo(10001, "won"));
});

test("ratings and verified times become two correctly ranked public boards", () => {
  assert.equal(PUBLIC_LEADERBOARD_ENDPOINT, "/api/leaderboard");
  const projected = projectPublicStandings(sampleElo, sampleFast);
  assert.deepEqual(
    projected.elo.map((x) => [x.rank, x.username, x.rating]),
    [
      [1, "Player_One", 1016],
      [2, "Player_Two", 984],
    ],
  );
  assert.deepEqual(projected.fastest[0], {
    rank: 1,
    username: "Player_One",
    durationMs: 54321,
    finishedAt: time,
  });
  assert.deepEqual(parsePublicStandings(projected), projected);
});

test("unexpected IDs, email addresses, and match metadata are stripped", () => {
  const projected = projectPublicStandings(
    [{ ...sampleElo[0], user_id: "private-id", email: "secret@example.com" }],
    [{ ...sampleFast[0], match_id: "private-match" }],
  );
  assert.doesNotMatch(JSON.stringify(projected), /private|secret@example/);
  assert.deepEqual(projected.elo[0], { rank: 1, ...sampleElo[0] });
});

test("rejects invalid usernames, inconsistent wins, and fake Elo sorting", () => {
  for (const rows of [
    [{ ...sampleElo[0], username: "bad name" }],
    [{ ...sampleElo[0], username: "victim@example.com" }],
    [{ ...sampleElo[0], games: 2 }],
    [{ ...sampleElo[0], rating: 100.5 }],
    [...sampleElo].reverse(),
    Array(51).fill(sampleElo[0]),
  ])
    assert.throws(() => projectPublicStandings(rows, sampleFast));
});

test("rejects invalid completion data, unsorted times, and forged source", () => {
  for (const rows of [
    [{ ...sampleFast[0], duration_ms: -1 }],
    [{ ...sampleFast[0], finished_at: "tomorrow" }],
    [{ ...sampleFast[0], duration_ms: "54321" }],
    [sampleFast[0], { ...sampleFast[0], duration_ms: 50000 }],
  ])
    assert.throws(() => projectPublicStandings(sampleElo, rows));
  assert.throws(() =>
    parsePublicStandings({
      ...projectPublicStandings([], []),
      source: "browser-submitted",
    }),
  );
});

test("SQL ledger is one event per match, owner rating starts private, and trusted triggers award", () => {
  const sql = read("docs/LEADERBOARD-ELO-PRIVACY.sql");
  assert.match(sql, /match_id uuid primary key references public\.ranked_matches/);
  assert.match(sql, /is_anonymous boolean not null default true/);
  assert.match(sql, /create trigger zz_record_ranked_elo/);
  assert.match(sql, /old\.status = 'active'/);
  assert.match(sql, /record_verified_ranked_win|capture_verified_ranked_win/);
  assert.match(sql, /from public\.ranked_verified_results/);
  assert.match(sql, /security definer/);
  assert.match(
    sql,
    /revoke all on schema ranked_internal from public, anon, authenticated/,
  );
  assert.match(sql, /row level security/);
  assert.match(
    sql,
    /grant select on public\.ranked_public_elo, public\.ranked_public_fastest to service_role/,
  );
  assert.doesNotMatch(
    sql,
    /grant update on public\.ranked_leaderboard_profiles to authenticated/,
  );
});

test("privacy filtered BEFORE LIMIT in both SQL views, and legacy public endpoint uses filtered view", () => {
  const sql = read("docs/LEADERBOARD-ELO-PRIVACY.sql");
  assert.match(sql, /create view public\.ranked_public_elo[\s\S]*where not is_anonymous/);
  assert.match(
    sql,
    /create view public\.ranked_public_fastest[\s\S]*where not p\.is_anonymous/,
  );
  const legacy = read("app/api/ranked-results/route.ts");
  assert.match(legacy, /\.from\("ranked_public_fastest"\)/);
  assert.doesNotMatch(legacy, /\.from\("ranked_verified_results"\)/);
});

test("public API reads only opt-in views, never user metadata, and emits no identifiers", () => {
  const route = read("app/api/leaderboard/route.ts");
  assert.match(route, /\.from\("ranked_public_elo"\)/);
  assert.match(route, /\.from\("ranked_public_fastest"\)/);
  assert.doesNotMatch(route, /auth\.users|user_metadata|user_id|email|request\.json/);
  assert.match(route, /projectPublicStandings/);
});

test("settings API checks owner and accepts only username/privacy, not score changes", () => {
  const route = read("app/api/leaderboard/preferences/route.ts");
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /\.eq\("user_id", user\.id\)/);
  assert.match(route, /parseIdentityMutation\(parsed\.value\)/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.doesNotMatch(route, /\.update\(\{\s*rating|rating:\s*payload/);
});

test("UI exposes two boards, public names, and a saved Anonymous mode control", () => {
  const board = read("components/leaderboard/verified-leaderboard.tsx");
  const privacy = read("components/leaderboard/leaderboard-privacy.tsx");
  const settings = read("components/settings/settings-workspace.tsx");
  assert.match(board, /Elo-style rating/);
  assert.match(board, /Fastest Wins/);
  assert.match(board, /entry\.username/);
  assert.match(board, /cache: "no-store"/);
  assert.match(board, /parsePublicStandings/);
  assert.match(privacy, /Anonymous mode/);
  assert.match(privacy, /method: "PUT"/);
  assert.match(settings, /<LeaderboardPrivacy \/>/);
});
