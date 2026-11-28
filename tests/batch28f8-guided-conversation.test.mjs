import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareAdaptiveTraining } from "../lib/coach/training-catalog.ts";
import { trainingVisibleBoard } from "../lib/coach/training-exercise.ts";
import { prepareReviewTraining } from "../lib/coach/training-from-review.ts";
import { preparePracticeAnalysis } from "../lib/coach/practice-analysis.ts";
import {
  guidedFollowUpQuestions,
  answerVerifiedFollowUp,
  plainFollowUpCoordinates,
} from "../lib/coach/verified-follow-up.ts";
import {
  resolveThreadQuestion,
  restoreFollowUpThread,
  serializeFollowUpThread,
  appendThreadAnswer,
  FOLLOW_UP_THREAD_LIMIT,
} from "../lib/coach/follow-up-thread.ts";
const catalog = prepareAdaptiveTraining();
const moment = {
  id: "move-4",
  moveNumber: 3,
  kind: "mistake",
  occurrences: 1,
  category: "Flagged a proven-safe square",
  action: "flag",
  location: "row 1, column 2",
  finding: "R1C2 was proven safe.",
  evidence: "Clue R1C1 accounts for the mine at R2C1. R1C2 is safe.",
  nextTime: "Reveal R1C2.",
};
const good = {
  ...moment,
  id: "move-5",
  moveNumber: 4,
  kind: "good",
  action: "reveal",
  category: "Proven safe reveal",
};
const report = { moments: [moment, good] };
const answer = (q, id = moment.id) => resolveThreadQuestion(report, id, q);
const read = (p) => readFileSync(p, "utf8");
const frame = (p, index) => ({
  changed: true,
  decision: "mistake",
  mistakeType: "unnecessary-guess",
  actionNumber: 4,
  before: trainingVisibleBoard(p.exercise),
  move: {
    row: Math.floor(index / p.exercise.columns),
    col: index % p.exercise.columns,
    action: "chord",
  },
});
const prepare = (p, index) => prepareReviewTraining(p.exercise, [frame(p, index)]);
test("exactly safe or proven-mine chords cannot create uncertain-chord lessons", () => {
  const mine = structuredClone(catalog[0]);
  mine.exercise.cells[2] = "flagged";
  assert.deepEqual(prepare(mine, 5), []); // the flag is wrong; the remaining neighbour is a proven mine
  const safe = structuredClone(catalog[0]);
  safe.exercise.cells[1] = "flagged";
  assert.deepEqual(prepare(safe, 5), []); // correct flag; only an exactly safe neighbour remains
});
test("uncertain chord with a proven safe alternative still produces a verified training exercise", () => {
  const p = structuredClone(catalog[7]);
  p.exercise.cells[11] = "flagged"; // clue 1 has one flag and an uncertain covered neighbour
  const valid = prepare(p, 15);
  assert.equal(valid.length, 1);
  assert.equal(valid[0].solution.kind, "select-square");
  assert.ok(valid[0].solution.indices.includes(0));
});
test("personalized exercise titles use displayed replay move numbers without altering stable IDs", () => {
  const moves = [
    [1, 0, "reveal"],
    [1, 1, "reveal"],
    [1, 2, "reveal"],
    [0, 0, "flag"],
    [0, 0, "unflag"],
    [0, 0, "reveal"],
  ].map(([row, col, action]) => ({ row, col, action }));
  const analysis = preparePracticeAnalysis({
    game: "minesweeper",
    difficulty: "Beginner",
    rows: 2,
    columns: 3,
    mineCount: 2,
    mines: [0, 2],
    outcome: "loss",
    durationSeconds: 5,
    moves,
  });
  const [p] = prepareReviewTraining(
    { rows: 2, columns: 3, mineCount: 2, opening: analysis.opening },
    analysis.reviewed,
  );
  assert.equal(p.exercise.id, "review-move-6");
  assert.match(p.exercise.title, /^Revisit move 5:/);
});
test("assistance cannot reset merely by navigating away and back in one workspace", () => {
  const ui = read("components/coach/training-panel.tsx");
  assert.match(ui, /seenHints\.current\.set\(current\.position, hintRef\.current\)/);
  assert.match(ui, /seenHints\.current\.get\(next\.position\)/);
  assert.match(
    ui,
    /exposedAnswers\.current\.has\(current\.position\)\s*\?\s*3\s*:\s*hintRef\.current/,
  );
  assert.match(
    ui,
    /next\.attempt\.status === "correct"\s*\|\|\s*catalog\[current\.position\]\.exercise\.objective\.kind\s*===\s*"classify-square"/,
  );
  assert.match(ui, /exposedAnswers\.current\.add\(current\.position\)/);
});
test("guided questions adapt to flag and good move, and every suggestion has a supported answer", () => {
  const a = guidedFollowUpQuestions(moment),
    b = guidedFollowUpQuestions(good);
  assert.equal(a.length, 4);
  assert.equal(b.length, 4);
  assert.match(a[0], /mistake/);
  assert.match(a[1], /flag/);
  assert.match(b[0], /good move/);
  for (const [m, qs] of [
    [moment, a],
    [good, b],
  ])
    for (const q of qs) {
      const r = answer(q, m.id);
      assert.equal(r.supported, true, q);
      assert.equal(r.answer.momentId, m.id);
    }
});
test("short explanation uses only finding and next step, with plain coordinates", () => {
  const r = answer(guidedFollowUpQuestions(moment)[3]);
  assert.equal(r.supported, true);
  assert.equal(r.answer.title, "The short explanation");
  assert.deepEqual(r.answer.paragraphs, [
    "row 1, column 2 was proven safe.",
    "Next time: Reveal row 1, column 2.",
  ]);
});
test("all response intents format shorthand without changing references or source evidence", () => {
  const before = structuredClone(report);
  for (const q of guidedFollowUpQuestions(moment)) {
    const r = answer(q);
    assert.doesNotMatch(r.answer.paragraphs.join(" "), /\bR\d+C\d+\b/i);
    assert.equal(r.answer.moveNumber, 3);
  }
  assert.deepEqual(report, before);
  assert.equal(
    plainFollowUpCoordinates("R12C30 and r1c2"),
    "row 12, column 30 and row 1, column 2",
  );
});
test("coordinate questions are redirected, not silently answered about the selected moment", () => {
  for (const q of [
    "Why is R1C2 safe?",
    "Why is row 2, column 3 safe?",
    "Explain column #3",
    "What did r 1 c 2 prove?",
  ]) {
    const r = answer(q);
    assert.equal(r.supported, false, q);
    assert.match(r.message, /replay/);
  }
});
test("other move references and unverified probabilities or hypothetical outcomes remain unsupported", () => {
  for (const q of [
    "Why was move 4 wrong?",
    "What are the probabilities?",
    "What if I had flagged instead?",
    "Could I have won?",
    "x".repeat(241),
  ])
    assert.equal(answer(q).supported, false, q);
  assert.equal(answer("Why was move 3 a mistake?").supported, true);
  assert.equal(
    answerVerifiedFollowUp(report, "foreign", "Explain this move.").supported,
    false,
  );
});
test("thread stores bounded question references and regenerates only supported answers", () => {
  const r = answer(guidedFollowUpQuestions(moment)[3]);
  const thread = Array(FOLLOW_UP_THREAD_LIMIT).fill(r.answer);
  const next = appendThreadAnswer(
    thread,
    answer(guidedFollowUpQuestions(good)[0], good.id).answer,
  );
  assert.equal(next.length, FOLLOW_UP_THREAD_LIMIT);
  const stored = serializeFollowUpThread(next);
  assert.ok(!stored.includes("paragraphs"));
  assert.deepEqual(restoreFollowUpThread(report, stored), next);
  assert.deepEqual(
    restoreFollowUpThread(
      report,
      JSON.stringify([
        { momentId: moment.id, question: "Why is R1C2 safe?", paragraphs: ["forged"] },
      ]),
    ),
    [],
  );
});
test("UI adapts suggestions to selected moment, clears old draft, keeps existing local-only conversation", () => {
  const ui = read("components/coach/verified-follow-up.tsx");
  assert.match(ui, /guidedFollowUpQuestions\(selected\)\.map/);
  assert.match(ui, /setMomentId\(event.target.value\);\s*setQuestion\(""\)/);
  assert.match(ui, /onReviewMove\(answer.moveNumber\)/);
  assert.match(ui, /if \(persist\)\s*window.sessionStorage.setItem/);
  assert.doesNotMatch(ui, /fetch\(|\/api\/|supabase/);
});
