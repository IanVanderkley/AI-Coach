import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deduceVisibleBoard, replayRecordedGame } from "../lib/coach/verified-replay.ts";
import {
  buildTeachingReview,
  displayMoveNumber,
  explainMove,
  openingIndex,
  timelineMove,
} from "../lib/coach/teaching-review.ts";

const covered = () => ({
  revealed: false,
  flagged: false,
  adjacentMines: null,
  exploded: false,
});
const clue = (number) => ({ ...covered(), revealed: true, adjacentMines: number });

test("scrubber is continuous and changes moves at the halfway boundary", () => {
  for (const [position, expected] of [
    [0, 0],
    [0.49, 0],
    [0.5, 1],
    [1.49, 1],
    [1.5, 2],
    [2.99, 3],
    [100, 3],
    [-2, 0],
    [NaN, 0],
  ])
    assert.equal(timelineMove(position, 3), expected);
});
test("opening reveal is move zero even with earlier setup flags; raw links remain reversible", () => {
  const moves = [
    { action: "flag" },
    { action: "unflag" },
    { action: "reveal" },
    { action: "reveal" },
  ];
  assert.equal(openingIndex(moves), 2);
  assert.equal(displayMoveNumber(moves, 3), 0);
  assert.equal(displayMoveNumber(moves, 4), 1);
});
test("a single visible clue explains exact mine count and coordinates", () => {
  const board = [clue(1), covered(), clue(1), clue(1)];
  const traced = deduceVisibleBoard(2, 2, 1, board, true);
  const mine = traced.mines.find((proof) => proof.index === 1);
  assert.ok(mine?.derivation);
  assert.match(mine.derivation.text, /1 - 0 = 1/);
  assert.match(mine.derivation.text, /R1C2/);
  assert.match(mine.derivation.text, /every one is a mine/);
});
test("subset subtraction explains the difference of two actual visible clue groups", () => {
  // A = {top middle, bottom left, bottom middle}; B includes those plus top/bottom right.
  // On this 2x3 board the left clue's unknowns are top middle and bottom left/middle.
  // Put the second clue at bottom middle instead for a larger overlapping neighborhood.
  const board = [clue(1), covered(), covered(), covered(), clue(1), covered()];
  const traced = deduceVisibleBoard(2, 3, 1, board, true);
  // The left clue restricts two unknown cells; the bottom-middle clue sees those plus the right column.
  for (const index of [2, 5]) {
    const safe = traced.safe.find((proof) => proof.index === index);
    assert.ok(safe?.derivation);
    assert.match(safe.derivation.title, /subset subtraction/);
    assert.match(safe.derivation.text, /1 - 1 = 0/);
    assert.match(safe.derivation.text, /R1C3/);
    assert.match(safe.derivation.text, /R2C3/);
    assert.match(safe.derivation.text, /all are safe/);
  }
});

test("traced deductions have the same results as the original solver and never assume a flag is a mine", () => {
  const board = [
    clue(1),
    { ...covered(), flagged: true },
    covered(),
    covered(),
    clue(1),
    covered(),
  ];
  const normal = deduceVisibleBoard(2, 3, 1, board);
  const traced = deduceVisibleBoard(2, 3, 1, board, true);
  for (const category of ["safe", "mines"])
    assert.deepEqual(
      traced[category].map(({ derivation, ...proof }) => proof),
      normal[category],
    );
  assert.equal(
    traced.mines.some((proof) => proof.index === 1),
    false,
  );
});
for (const [difficulty, rows, columns, mineCount] of [
  ["Beginner", 9, 9, 10],
  ["Intermediate", 16, 16, 40],
  ["Expert", 16, 30, 99],
]) {
  test(`${difficulty}: opening is excluded and teaching conclusions match independent mine membership`, () => {
    const pocketRow = rows - 2,
      pocketCol = columns - 2,
      pocket = pocketRow * columns + pocketCol;
    const mines = new Set();
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++)
        if (dr || dc) mines.add((pocketRow + dr) * columns + pocketCol + dc);
    for (let i = rows * columns - 1; mines.size < mineCount; i--)
      if (i !== pocket && !(Math.floor(i / columns) <= 1 && i % columns <= 1))
        mines.add(i);
    const firstMine = [...mines][0];
    const game = {
      game: "minesweeper",
      difficulty,
      rows,
      columns,
      mineCount,
      mines: [...mines],
      outcome: "loss",
      durationSeconds: 2,
      moves: [
        { action: "reveal", row: 0, col: 0, atMs: 0 },
        {
          action: "reveal",
          row: Math.floor(firstMine / columns),
          col: firstMine % columns,
          atMs: 2000,
        },
      ],
    };
    const replay = replayRecordedGame(game);
    const review = buildTeachingReview(game);
    assert.equal(review.report.recordedActions, 1);
    assert.equal(
      review.report.verifiedMistakes +
        review.report.provenGood +
        review.report.uncertainActions,
      1,
    );
    assert.ok(review.report.moments.every((moment) => moment.moveNumber > 1));
    assert.ok(review.followUpReport.moments.every((moment) => moment.moveNumber === 1));
    const frame = replay.frames[1];
    const traced = deduceVisibleBoard(rows, columns, mineCount, frame.before, true);
    for (const proof of traced.safe) assert.equal(mines.has(proof.index), false);
    for (const proof of traced.mines) assert.equal(mines.has(proof.index), true);
    const explanation = explainMove(frame, rows, columns, mineCount);
    if (explanation.recommendation !== null)
      assert.equal(mines.has(explanation.recommendation), false);
    if (frame.decision === "mistake") assert.ok(explanation.steps.length > 0);
    assert.ok(
      explanation.clues.every(
        (index) =>
          frame.before[index].revealed && frame.before[index].adjacentMines !== null,
      ),
    );
  });
}
test("replay controls use fixed square geometry, continuous range, icon controls, and opt-out tooltips", () => {
  const panel = readFileSync(
    new URL("../components/coach/verified-replay-panel.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(
    new URL("../styles/coaching-teaching.css", import.meta.url),
    "utf8",
  );
  const settings = readFileSync(
    new URL("../components/settings/settings-workspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(panel, /step="any"/);
  assert.match(panel, /<Pause/);
  assert.match(panel, /<Play/);
  assert.match(panel, /useReplayTooltips/);
  assert.doesNotMatch(panel, /setZoom/);
  assert.match(css, /width: 36px/);
  assert.match(css, /height: 36px/);
  assert.match(css, /transition-delay: 1.2s/);
  assert.match(settings, /<ReplayTooltipSetting/);
});
