import assert from "node:assert/strict";
import test from "node:test";
import {
  action,
  referenceGame,
  exhaustiveOracle,
} from "./helpers/reference-practice.mjs";
import { buildEvidenceReport } from "../lib/coach/evidence-report.ts";
import { replayRecordedGame } from "../lib/coach/verified-replay.ts";
import { recommendedReveal } from "../lib/coach/visual-coaching.ts";
import { explainMove } from "../lib/coach/teaching-review.ts";

function game(actions) {
  return referenceGame({ rows: 3, columns: 3, mines: [0], actions }).recording;
}
const opening = action(1, 1, "reveal");
const overlap = action(0, 1, "reveal");
const mine = action(0, 0, "reveal");

test("unproven correct and incorrect flags both remain unresolved", () => {
  for (const col of [0, 1]) {
    const recording = game([opening, action(0, col, "flag")]);
    const replay = replayRecordedGame(recording);
    const frame = replay.frames.at(-1);
    assert.equal(frame.decision, "not-enough-evidence");
    assert.equal(frame.mistakeType, null);
    assert.match(frame.explanation, /not supported or contradicted/);
  }
});

test("opening and unresolved loss do not imply equal odds or unavoidable risk", () => {
  const recording = game([opening, mine]);
  const replay = replayRecordedGame(recording);
  assert.match(replay.frames[0].explanation, /opening reveal/);
  assert.match(replay.frames[1].explanation, /does not prove guessing was unavoidable/);
  assert.equal(buildEvidenceReport(recording).verifiedMistakes, 0);
});

test("report and visual lesson recommend the same unflagged safe alternative", () => {
  const recording = game([opening, overlap, action(2, 0, "flag"), mine]);
  const frame = replayRecordedGame(recording).frames.at(-1);
  const proof = recommendedReveal(frame);
  assert.notEqual(proof, null);
  assert.equal(frame.before[proof].flagged, false);
  assert.ok(exhaustiveOracle(3, 3, 1, frame.before).safe.has(proof));
  const location = `row ${Math.floor(proof / 3) + 1}, column ${(proof % 3) + 1}`;
  const report = buildEvidenceReport(recording);
  const moment = report.moments.find((m) => m.category === "Unnecessary guess");
  assert.ok(moment);
  assert.ok(moment.evidence.includes(location));
  assert.ok(moment.nextTime.includes(location));
  assert.equal(explainMove(frame, 3, 3, 1).recommendation, proof);
});

test("risky chord describes an uncertain neighbor rather than the revealed clue", () => {
  const recording = game([opening, overlap, action(0, 2, "flag"), action(0, 1, "chord")]);
  assert.equal(recording.outcome, "loss");
  const frame = replayRecordedGame(recording).frames.at(-1);
  assert.equal(frame.mistakeType, "unnecessary-guess");
  const moment = buildEvidenceReport(recording).moments.find(
    (m) => m.category === "Unnecessary guess",
  );
  assert.ok(moment);
  assert.match(moment.finding, /chord.*included an uncertain square/i);
  assert.doesNotMatch(moment.finding, /chosen square/);
});

test("removing an unsupported flag is not double-counted as a mistake", () => {
  const recording = game([opening, action(0, 1, "flag"), action(0, 1, "unflag"), mine]);
  const replay = replayRecordedGame(recording);
  assert.match(replay.frames[2].explanation, /flag was removed/i);
  const report = buildEvidenceReport(recording);
  assert.equal(report.verifiedMistakes, 0);
  assert.equal(report.uncertainActions, 4);
  assert.equal(report.moments.length, 0);
});
