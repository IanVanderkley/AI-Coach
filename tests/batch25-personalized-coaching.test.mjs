import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  buildSavedReview,
  summarizeLearning,
  MISTAKE_TYPES,
  LESSONS,
  REVIEW_WINDOWS,
} from "../lib/coach/personalized-review.ts";
import { preparePracticeAnalysis } from "../lib/coach/practice-analysis.ts";
import { parseReviewSave } from "../lib/coach/review-request.ts";

const id = "11111111-1111-4111-8111-111111111111";
function fixture(
  n,
  {
    mode = "practice",
    difficulty = "Intermediate",
    version = 1,
    good = 2,
    mistakes = 1,
    uncertain = 3,
    score = 50,
    kind = "unnecessary-guess",
  } = {},
) {
  const mistakeMoves = Object.fromEntries(
    MISTAKE_TYPES.map((key) => [
      key,
      key === kind ? Array.from({ length: mistakes }, (_, i) => i + 2) : [],
    ]),
  );
  return {
    mode,
    difficulty,
    version,
    gameRef: String(n),
    completedAt: new Date(Date.UTC(2026, 0, 1) + n * 86400000).toISOString(),
    outcome: "loss",
    review: { score: { good, mistakes, uncertain, score }, mistakeMoves },
  };
}

test("save accepts identifiers only and rejects untrusted reports, owners, invalid IDs", () => {
  assert.deepEqual(parseReviewSave({ mode: "ranked", gameRef: id }), {
    mode: "ranked",
    gameRef: id,
  });
  assert.deepEqual(parseReviewSave({ mode: "practice", gameRef: "old-record_123" }), {
    mode: "practice",
    gameRef: "old-record_123",
  });
  for (const value of [
    null,
    [],
    {},
    { mode: "ranked", gameRef: "bad" },
    { mode: "practice", gameRef: "a".repeat(129) },
    { mode: "practice", gameRef: "a/b" },
    { mode: "practice", gameRef: id, userId: id },
    { mode: "ranked", gameRef: id, review: { score: 100 } },
    { mode: "unknown", gameRef: id },
  ])
    assert.equal(parseReviewSave(value), null);
});

test("saved report preserves actual evidence and move references from shared replay", () => {
  const game = {
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
  const analysis = preparePracticeAnalysis(game);
  const saved = buildSavedReview(analysis);
  assert.deepEqual(saved.report, analysis.report);
  assert.equal(Object.values(saved.mistakeMoves).flat().length, saved.score.mistakes);
  for (const [key, moves] of Object.entries(saved.mistakeMoves))
    for (const move of moves) {
      assert.equal(analysis.replay.frames[move - 1].mistakeType, key);
      assert.ok(move > 1);
    }
  assert.ok(!("mines" in saved) && !("replay" in saved));
});

test("windows use latest unique same-mode, same-difficulty current-version reviews", () => {
  const records = Array.from({ length: 110 }, (_, i) => fixture(i + 1));
  records.push(
    records[109],
    fixture(111, { mode: "ranked" }),
    fixture(112, { difficulty: "Expert" }),
    fixture(113, { version: 2 }),
  );
  for (const size of REVIEW_WINDOWS) {
    const result = summarizeLearning(records, "practice", "Intermediate", size);
    assert.equal(result.selected.length, size);
    assert.equal(result.selected[0].gameRef, "110");
    assert.equal(result.selected.at(-1).gameRef, String(111 - size));
  }
});

test("recurrence counts distinct games separately from repeated moves", () => {
  const result = summarizeLearning(
    [
      fixture(1, { mistakes: 5 }),
      fixture(2, { mistakes: 2, kind: "flagged-known-safe" }),
      fixture(3, { mistakes: 1, kind: "flagged-known-safe" }),
    ],
    "practice",
    "Intermediate",
    10,
  );
  assert.equal(result.patterns[0].key, "flagged-known-safe");
  assert.equal(result.patterns[0].games, 2);
  assert.equal(result.patterns[0].occurrences, 3);
  assert.deepEqual(result.patterns[0].example, { gameRef: "3", move: 2 });
});

test("accuracy excludes uncertain moves; improvement compares equal halves", () => {
  const records = Array.from({ length: 10 }, (_, i) =>
    fixture(i, { good: i < 5 ? 1 : 3, mistakes: 1, uncertain: 99, score: 50 }),
  );
  const result = summarizeLearning(records, "practice", "Intermediate", 10);
  assert.equal(result.metrics.accuracy, 67);
  assert.equal(result.accuracyChange, 25);
  assert.equal(result.half, 5);
  assert.equal(
    summarizeLearning(records.slice(0, 9), "practice", "Intermediate", 10).accuracyChange,
    null,
  );
});

test("no evidence and missing scores are not treated as zero", () => {
  const result = summarizeLearning(
    [fixture(1, { good: 0, mistakes: 0, score: null })],
    "practice",
    "Intermediate",
    10,
  );
  assert.equal(result.metrics.accuracy, null);
  assert.equal(result.metrics.score, null);
  assert.equal(result.metrics.graded, 0);
  assert.ok(result.patterns.every((p) => p.games === 0));
  for (const key of MISTAKE_TYPES) assert.ok(LESSONS[key].options[LESSONS[key].answer]);
});

test("report endpoint uses verified live identity and separate save quota; no direct competitive writes", () => {
  const route = readFileSync("app/api/coach/reports/route.ts", "utf8");
  assert.match(route, /getClaims\(\)/);
  assert.match(route, /ranked_session_is_active/);
  assert.match(route, /readBoundedJson\(request, 1024, true\)/);
  assert.match(route, /reserve_coaching_review_save/);
  assert.match(route, /\.eq\("user_id", userId\)/);
  assert.match(route, /readCompletedRankedRecording/);
  assert.match(route, /readPracticeReview/);
  assert.match(route, /private, no-store/);
  assert.doesNotMatch(
    route,
    /\.from\("(?:ranked_elo_events|ranked_leaderboard_profiles|player_xp_profiles|ranked_verified_results)"\)|providers|\/api\/coach\/verified-brief/,
  );
  assert.match(route, /onConflict: "user_id,mode,game_ref,analysis_version"/);
  const store = readFileSync("lib/coach/practice-review-store.ts", "utf8");
  assert.match(store, /\.eq\("user_id", userId\)/);
  assert.match(store, /count !== row.move_count/);
  assert.match(store, /preparePracticeAnalysis/);
});
