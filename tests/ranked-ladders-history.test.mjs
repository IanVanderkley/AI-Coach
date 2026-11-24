import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { RANKED_LADDERS, RANKED_RP_ENABLED } from "../lib/ranked/ladders.ts";
import { serializeRankedHistory, RANKED_HISTORY_LIMIT } from "../lib/ranked/history.ts";

const userId = "89ab3d17-9a21-43de-8530-cbc436c44507";
const otherId = "a718bec2-cdf0-44df-b5ca-1dd344066184";
const winId = "3c5ae924-e74b-42fa-8618-c691d63ca58e";
const lossId = "33ae9512-dab0-4ea5-bacb-9a6628275de5";
const base = {
  user_id: userId,
  rows: 16,
  columns: 16,
  mine_count: 40,
  move_count: 12,
  duration_ms: 54321,
  finished_at: "2026-11-24T04:30:00Z",
};
const win = { ...base, id: winId, status: "won" };
const loss = { ...base, id: lossId, status: "lost" };
const verified = [{ user_id: userId, match_id: winId }];
const receipts = [
  { user_id: userId, match_id: winId, outcome: "won", amount: 125 },
  { user_id: userId, match_id: lossId, outcome: "lost", amount: 10 },
];

test("only Intermediate is playable; no arbitrary RP policy is enabled", () => {
  assert.deepEqual(
    RANKED_LADDERS.map((mode) => [mode.id, mode.playable]),
    [
      ["beginner", false],
      ["intermediate", true],
      ["expert", false],
    ],
  );
  assert.deepEqual(
    RANKED_LADDERS.map((mode) => [mode.rows, mode.columns, mode.mineCount]),
    [
      [9, 9, 10],
      [16, 16, 40],
      [16, 30, 99],
    ],
  );
  assert.equal(RANKED_RP_ENABLED, false);
});

test("verified win and owned loss show real XP receipts without leaking match IDs", () => {
  const rows = serializeRankedHistory([win, loss], verified, receipts, userId);
  assert.deepEqual(
    rows.map((entry) => [entry.outcome, entry.earnedXp]),
    [
      ["won", 125],
      ["lost", 10],
    ],
  );
  assert.equal(rows[0].durationMs, 54321);
  assert.equal(rows[0].moveCount, 12);
  assert.equal(JSON.stringify(rows).includes(winId), false);
  assert.equal(JSON.stringify(rows).includes(userId), false);
});

test("missing receipt is not a zero-XP award", () => {
  assert.equal(serializeRankedHistory([loss], [], [], userId)[0].earnedXp, null);
});

test("unverified wins are not displayed as authoritative wins", () => {
  assert.deepEqual(serializeRankedHistory([win], [], [], userId), []);
});

test("rejects foreign match rows and receipts", () => {
  assert.throws(() =>
    serializeRankedHistory([{ ...win, user_id: otherId }], verified, receipts, userId),
  );
  assert.throws(() =>
    serializeRankedHistory([loss], [], [{ ...receipts[1], user_id: otherId }], userId),
  );
});

test("rejects mismatched and fabricated rewards, malformed time, and wrong board", () => {
  assert.throws(() =>
    serializeRankedHistory([loss], [], [{ ...receipts[1], amount: 125 }], userId),
  );
  assert.throws(() =>
    serializeRankedHistory([loss], [], [{ ...receipts[0], match_id: lossId }], userId),
  );
  assert.throws(() => serializeRankedHistory([{ ...loss, rows: 9 }], [], [], userId));
  assert.throws(() =>
    serializeRankedHistory([{ ...loss, finished_at: "not a date" }], [], [], userId),
  );
});

test("rejects oversized history and incorrect user IDs", () => {
  assert.equal(RANKED_HISTORY_LIMIT, 10);
  assert.throws(() => serializeRankedHistory(Array(11).fill(loss), [], [], userId));
  assert.throws(() => serializeRankedHistory([loss], [], [], "not a uuid"));
});

test("Ranked API uses verified user ID and privacy-scoped read-only queries", () => {
  const route = readFileSync("app/api/ranked/history/route.ts", "utf8");
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /\.eq\("user_id", user\.id\)/);
  assert.equal((route.match(/\.eq\("user_id", user\.id\)/g) || []).length, 3);
  assert.match(route, /\.in\("status", \["won", "lost"\]\)/);
  assert.match(route, /\.limit\(RANKED_HISTORY_LIMIT\)/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.match(route, /serializeRankedHistory/);
  assert.doesNotMatch(route, /export async function POST|request\.json\(|getSession\(\)/);
});

test("Profile shows Ranked history and Ranked page shows honest ladder availability", () => {
  const profile = readFileSync("components/profile/practice-profile.tsx", "utf8");
  const ranked = readFileSync("app/ranked/page.tsx", "utf8");
  const styles = readFileSync("app/globals.css", "utf8");
  const history = readFileSync("components/profile/ranked-history.tsx", "utf8");
  // AI_COACH_PLAYER_DASHBOARD_TEST_V1: histories supply the dashboard's verified rows.
  assert.match(profile, /<RankedHistory onRecentMatches=\{setRankedMatches\} \/>/);
  assert.match(ranked, /<RankedLadderOverview \/>/);
  assert.match(styles, /ranked-progression\.css/);
  assert.match(history, /fetch\("\/api\/ranked\/history"/);
  assert.match(history, /latest ten completed Intermediate matches/);
});
