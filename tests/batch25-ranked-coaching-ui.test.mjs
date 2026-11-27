import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { serializeRankedCoachingHistory } from "../lib/ranked/coaching-history.ts";
import { prepareRankedReviewResponse } from "../lib/ranked/coaching-client.ts";
import { preparePracticeAnalysis } from "../lib/coach/practice-analysis.ts";
import { scorePreparedReview } from "../lib/coach/review-score.ts";
const id = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const foreign = "33333333-3333-4333-8333-333333333333";
const completedAt = "2026-11-26T12:00:00Z";
const loss = {
  id,
  user_id: owner,
  status: "lost",
  rows: 16,
  columns: 16,
  mine_count: 40,
  move_count: 2,
  duration_ms: 10000,
  finished_at: completedAt,
};
const read = (path) => readFileSync(path, "utf8");
function response() {
  const recording = {
    game: "minesweeper",
    difficulty: "Intermediate",
    rows: 16,
    columns: 16,
    mineCount: 40,
    outcome: "loss",
    durationSeconds: 10,
    mines: [
      ...Array.from({ length: 16 }, (_, i) => 48 + i),
      ...Array.from({ length: 16 }, (_, i) => 96 + i),
      ...Array.from({ length: 8 }, (_, i) => 144 + i),
    ],
    moves: [
      { row: 0, col: 0, action: "reveal" },
      { row: 3, col: 0, action: "reveal" },
    ],
  };
  const analysis = preparePracticeAnalysis(recording);
  return {
    source: "server-recorded-ranked",
    matchId: id,
    completedAt,
    durationMs: 10000,
    recording,
    review: {
      version: analysis.version,
      score: scorePreparedReview(analysis),
      report: analysis.report,
    },
  };
}
test("coaching history contains only owner-authorized completed match metadata", () => {
  const [item] = serializeRankedCoachingHistory([loss], [], owner);
  assert.equal(item.matchId, id);
  assert.equal(item.reviewAvailable, true);
  assert.equal(item.outcome, "lost");
  for (const key of ["user_id", "mine_positions", "moves", "earnedXp", "elo"])
    assert.ok(!(key in item));
  assert.throws(() =>
    serializeRankedCoachingHistory([{ ...loss, user_id: foreign }], [], owner),
  );
  assert.throws(() =>
    serializeRankedCoachingHistory([{ ...loss, status: "active" }], [], owner),
  );
});
test("history excludes unverified wins and marks long recordings unavailable", () => {
  const win = { ...loss, status: "won" };
  assert.deepEqual(serializeRankedCoachingHistory([win], [], owner), []);
  assert.equal(
    serializeRankedCoachingHistory([win], [{ match_id: id, user_id: owner }], owner)[0]
      .outcome,
    "won",
  );
  assert.equal(
    serializeRankedCoachingHistory([{ ...loss, move_count: 1001 }], [], owner)[0]
      .reviewAvailable,
    false,
  );
  assert.throws(() => serializeRankedCoachingHistory([loss, loss], [], owner));
});
test("Ranked review reproduces the server score and evidence for interactive replay", () => {
  const raw = response();
  const prepared = prepareRankedReviewResponse(raw, id);
  assert.deepEqual(prepared.review, raw.review.score);
  assert.deepEqual(prepared.analysis.report, raw.review.report);
  assert.doesNotMatch(prepared.analysis.report.caveat, /Practice game/);
  assert.equal(prepared.analysis.replay.status, "lost");
});
test("invalid review provenance, wrong match and inconsistent server grades fail closed", () => {
  for (const modify of [
    (r) => (r.source = "practice"),
    (r) => (r.matchId = foreign),
    (r) => (r.review.version = 999),
    (r) => (r.review.score.score = 100),
    (r) => (r.review.report.caveat = "wrong"),
    (r) => (r.recording.outcome = "win"),
  ]) {
    const raw = response();
    modify(raw);
    assert.throws(() => prepareRankedReviewResponse(raw, id));
  }
});
test("Ranked history route checks signed identity, live session, rate limit and terminal ownership before metadata", () => {
  const route = read("app/api/ranked/coaching/history/route.ts");
  assert.match(route, /getClaims\(\)/);
  assert.match(route, /ranked_session_is_active/);
  assert.match(route, /guardRankedRateLimit/);
  assert.match(route, /\.eq\("user_id", userId\)\s*\.in\("status", \["won", "lost"\]\)/);
  assert.match(route, /private, no-store/);
  assert.doesNotMatch(
    route,
    /ranked_match_state|ranked_match_moves|mine_positions|replayRecordedGame|export async function POST/,
  );
});
test("both entry points reuse the shared review and do not send Ranked data to AI", () => {
  const ui = read("components/coach/coach-console.tsx");
  const panel = read("components/coach/evidence-coach-panel.tsx");
  const result = read("components/ranked/ranked-result-dialog.tsx");
  assert.match(ui, /onReviewMatch=\{openRankedGame\}/);
  assert.match(ui, /prepareRankedReviewResponse\(raw, matchId\)/);
  assert.match(
    ui,
    /aiAvailable=\{\s*selection\.mode === "practice"\s*&&\s*status\?\.configured === true\s*&&\s*status\.provider !== null\s*\}/,
  );
  assert.match(panel, /mode === "ranked"\s*\|\|\s*!report/);
  assert.match(panel, /persist=\{mode === "practice"\}/);
  assert.match(result, /source=ranked&matchId=/);
  assert.match(result, /<Award size=\{17\} aria-hidden="true" \/> Analyze Game/);
  assert.ok(result.indexOf("Analyze Game") < result.indexOf("Return to lobby"));
  const history = read("components/profile/ranked-history.tsx");
  assert.match(history, /<Play size=\{14\} aria-hidden="true" \/> Review game/);
});
