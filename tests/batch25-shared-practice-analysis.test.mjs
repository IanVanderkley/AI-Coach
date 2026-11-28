import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { action, referenceGame } from "./helpers/reference-practice.mjs";
import { preparePracticeAnalysis } from "../lib/coach/practice-analysis.ts";
import {
  scorePracticeReview,
  scorePreparedPracticeReview,
} from "../lib/coach/review-score.ts";
import {
  buildTeachingReview,
  buildPreparedTeachingReview,
} from "../lib/coach/teaching-review.ts";
import {
  buildEvidenceReport,
  summarizeEvidenceFrames,
} from "../lib/coach/evidence-report.ts";

function fixture() {
  return referenceGame({
    rows: 3,
    columns: 3,
    mines: [0],
    actions: [
      action(0, 1, "flag"),
      action(0, 1, "unflag"),
      action(1, 1, "reveal"),
      action(0, 1, "reveal"),
      action(2, 0, "flag"),
      action(2, 0, "unflag"),
      action(0, 0, "reveal"),
    ],
  }).recording;
}

test("the score, replay and lesson report share one post-opening analysis", () => {
  const game = fixture();
  const analysis = preparePracticeAnalysis(game);
  const score = scorePreparedPracticeReview(analysis);
  const teaching = buildPreparedTeachingReview(analysis);
  assert.equal(analysis.opening, 2);
  assert.equal(analysis.replay.frames.length, 7);
  assert.equal(analysis.reviewed.length, 4);
  assert.equal(teaching.report, analysis.report);
  assert.equal(score.good, teaching.report.provenGood);
  assert.equal(score.mistakes, teaching.report.verifiedMistakes);
  assert.equal(score.uncertain, teaching.report.uncertainActions);
  assert.equal(score.good + score.mistakes + score.uncertain, 4);
  assert.deepEqual(score, scorePracticeReview(game));
  assert.deepEqual(teaching, buildTeachingReview(game));
});

test("grouping before the opening cannot suppress later scoped lessons", () => {
  const analysis = preparePracticeAnalysis(fixture());
  const sample = analysis.reviewed.find(
    (frame) => frame.mistakeType === "flagged-known-safe",
  );
  assert.ok(sample);
  // A synthetic duplicate earlier than the opening exercises the projection itself.
  const earlier = { ...sample, actionNumber: 1 };
  const all = summarizeEvidenceFrames([earlier, sample], 3);
  const scoped = summarizeEvidenceFrames([sample], 3);
  assert.equal(all.moments[0].moveNumber, 1);
  assert.equal(all.moments[0].occurrences, 2);
  assert.equal(scoped.moments[0].moveNumber, sample.actionNumber);
  assert.equal(scoped.moments[0].occurrences, 1);
});

test("API evidence keeps its whole recording action count and stable raw IDs", () => {
  const game = fixture();
  const whole = buildEvidenceReport(game);
  const scoped = preparePracticeAnalysis(game).report;
  assert.equal(whole.recordedActions, game.moves.length);
  assert.equal(scoped.recordedActions, 4);
  for (const moment of scoped.moments) {
    assert.equal(moment.id, `move-${moment.moveNumber}`);
    assert.ok(moment.moveNumber > 3);
  }
});

test("follow-up links retain raw IDs and display the post-opening move number", () => {
  const analysis = preparePracticeAnalysis(fixture());
  const { report, followUpReport, explanations } = buildPreparedTeachingReview(analysis);
  for (const moment of report.moments) {
    const follow = followUpReport.moments.find((item) => item.id === moment.id);
    assert.ok(follow);
    assert.equal(follow.moveNumber, moment.moveNumber - analysis.opening - 1);
    assert.ok(explanations.has(moment.id));
  }
});

test("legacy no-op moves remain readable but are not graded as changed decisions", () => {
  const game = fixture();
  game.moves = game.moves.map(({ afterHash, ...move }) => move);
  game.moves.splice(3, 0, { ...game.moves[2] });
  const analysis = preparePracticeAnalysis(game);
  assert.equal(analysis.replay.frames.length, 8);
  assert.equal(analysis.report.recordedActions, 4);
  assert.equal(analysis.reviewed.length, 4);
  assert.equal(analysis.replay.frames[3].changed, false);
});

test("an ignored pre-opening reveal cannot shift the actual opening or lesson links", () => {
  const game = fixture();
  game.moves = game.moves.map(({ afterHash, ...move }) => move);
  game.moves.splice(1, 0, { row: 0, col: 1, action: "reveal", atMs: 0 });
  const analysis = preparePracticeAnalysis(game);
  assert.equal(analysis.opening, 3);
  assert.equal(analysis.replay.frames[1].changed, false);
  const teaching = buildPreparedTeachingReview(analysis);
  for (const moment of teaching.report.moments) {
    const follow = teaching.followUpReport.moments.find((item) => item.id === moment.id);
    assert.equal(follow.moveNumber, moment.moveNumber - analysis.opening - 1);
  }
});

test("shared review fails closed for mixed hashes, corrupt hashes and wrong outcomes", () => {
  const mixed = fixture();
  delete mixed.moves[1].afterHash;
  assert.throws(() => preparePracticeAnalysis(mixed), /checkpoints/);
  const corrupt = fixture();
  corrupt.moves[1].afterHash = "deadbeef";
  assert.throws(() => preparePracticeAnalysis(corrupt), /mismatch/i);
  assert.throws(
    () => preparePracticeAnalysis({ ...fixture(), outcome: "win" }),
    /outcome/i,
  );
});

test("unresolved post-opening decisions do not create a fabricated grade", () => {
  const game = referenceGame({
    rows: 3,
    columns: 3,
    mines: [0],
    actions: [action(1, 1, "reveal"), action(0, 0, "reveal")],
  }).recording;
  const analysis = preparePracticeAnalysis(game);
  assert.equal(scorePreparedPracticeReview(analysis).grade, null);
  assert.equal(analysis.report.uncertainActions, 1);
  assert.equal(analysis.report.moments.length, 0);
});

test("the selected review passes one shared analysis to replay, lessons, conversation and training", () => {
  const source = readFileSync(
    new URL("../components/coach/coach-console.tsx", import.meta.url),
    "utf8",
  );
  const panel = readFileSync(
    new URL("../components/coach/evidence-coach-panel.tsx", import.meta.url),
    "utf8",
  );
  const replay = readFileSync(
    new URL("../components/coach/verified-replay-panel.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /scorePreparedPracticeReview\(analysis\)/);
  for (const component of [
    "VerifiedReplayPanel",
    "EvidenceCoachPanel",
    "ReviewConversation",
    "ReviewTrainingPanel",
  ]) {
    assert.match(
      source,
      new RegExp("<" + component + "\\b[^>]*analysis=\\{selection\\.analysis\\}"),
    );
  }
  assert.equal((source.match(/analysis=\{selection\.analysis\}/g) ?? []).length, 4);
  const training = readFileSync(
    new URL("../components/coach/training-panel.tsx", import.meta.url),
    "utf8",
  );
  const trainingSource = readFileSync(
    new URL("../lib/coach/training-from-review.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    training,
    /prepareReviewTraining\(\s*\{[^}]*\},\s*analysis\.reviewed,?\s*\)/,
  );
  assert.doesNotMatch(
    training + trainingSource,
    /replayRecordedGame\(|preparePracticeAnalysis\(/,
  );
  assert.match(panel, /buildPreparedTeachingReview\(analysis\)/);
  assert.doesNotMatch(replay, /replayRecordedGame\(/);
  assert.match(replay, /prioritizeMoments\(analysis\.report, preferences\)/);
});
