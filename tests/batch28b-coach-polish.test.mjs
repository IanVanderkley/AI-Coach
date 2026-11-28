import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { prepareSquareAnalysis, explainSquare } from "../lib/coach/square-analysis.ts";
import {
  relativeSquare,
  localSquareBounds,
  replayCellGlyph,
  describeSquareCoach,
} from "../lib/coach/square-coach-presentation.ts";
const hidden = (flagged = false) => ({
  revealed: false,
  flagged,
  adjacentMines: null,
  exploded: false,
});
const clue = (n) => ({ ...hidden(), revealed: true, adjacentMines: n });
const inspect = (board, rows, columns, count, index) =>
  explainSquare(prepareSquareAnalysis(board, rows, columns, count), index);

test("relative directions include all eight neighbors and never wrap rows", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 5, 6, 7, 8].map((i) => relativeSquare(4, i, 3)),
    [
      "up-left",
      "directly above",
      "up-right",
      "directly to the left",
      "directly to the right",
      "down-left",
      "directly below",
      "down-right",
    ],
  );
  assert.equal(relativeSquare(2, 3, 3), "1 row down and 2 columns left");
  assert.equal(relativeSquare(0, 14, 5), "2 rows down and 4 columns right");
});
for (const [rows, columns] of [
  [9, 9],
  [16, 16],
  [16, 30],
]) {
  test(`local board crop stays within ${rows}x${columns} and includes selection`, () => {
    assert.deepEqual(localSquareBounds(0, rows, columns), {
      top: 0,
      bottom: 2,
      left: 0,
      right: 2,
    });
    assert.deepEqual(localSquareBounds(rows * columns - 1, rows, columns), {
      top: rows - 3,
      bottom: rows - 1,
      left: columns - 3,
      right: columns - 1,
    });
    assert.deepEqual(localSquareBounds(4 * columns + 4, rows, columns), {
      top: 2,
      bottom: 6,
      left: 2,
      right: 6,
    });
  });
}
test("local glyphs reflect only the original snapshot, including flags and exposed mines", () => {
  assert.equal(replayCellGlyph(hidden()), "");
  assert.equal(replayCellGlyph({ ...hidden(), adjacentMines: 7 }), "");
  assert.equal(replayCellGlyph(hidden(true)), "⚑");
  assert.equal(replayCellGlyph(clue(0)), "");
  assert.equal(replayCellGlyph(clue(2)), "2");
  assert.equal(replayCellGlyph({ ...hidden(), revealed: true, exploded: true }), "✹");
});
test("direct safe deduction names the real relative clue and exact remaining mine count", () => {
  const result = inspect(
    [clue(0), hidden(true), hidden(), hidden(), hidden(), hidden()],
    2,
    3,
    1,
    1,
  );
  const coach = describeSquareCoach(result, 1);
  assert.match(coach.text, /empty \(0\) clue directly to the left/);
  assert.match(coach.text, /No mines remain/);
  assert.match(coach.text, /cannot contain a mine/);
  assert.deepEqual(coach.clues, [0]);
});
test("mine conclusion describes the real single-clue constraint", () => {
  const result = inspect([clue(1), hidden(), clue(1), clue(1)], 2, 2, 1, 1);
  const coach = describeSquareCoach(result, 1);
  assert.match(coach.text, /1 directly to the left/);
  assert.match(coach.text, /Exactly 1 mine remains/);
  assert.match(coach.text, /must contain a mine/);
});
test("long chains explain their final step and disclose prerequisites", () => {
  const result = inspect(
    [clue(1), hidden(), hidden(), clue(1), clue(1), clue(1)],
    2,
    3,
    1,
    2,
  );
  const coach = describeSquareCoach(result, 2);
  assert.ok(result.explanation.steps.length > 1);
  assert.match(coach.prerequisite, /earlier deductions/);
  assert.match(coach.text, /already proven 1 mine/);
  assert.deepEqual(coach.clues, result.explanation.steps.at(-1).clues);
});
test("subset explanation uses the recorded group counts, not a fabricated pattern", () => {
  const board = [clue(1), clue(2), clue(1), hidden(), hidden(), hidden()];
  const result = inspect(board, 2, 3, 2, 3);
  const visual = result.explanation.steps.at(-1).visual;
  assert.equal(visual.groups.length, 2);
  const coach = describeSquareCoach(result, 3);
  assert.match(
    coach.text,
    /Every unresolved square in the first group is also in the second/,
  );
  assert.ok(
    coach.text.includes(
      `Subtract ${visual.groups[0].remainingMines} from ${visual.groups[1].remainingMines}`,
    ),
  );
  assert.match(coach.text, /must contain a mine/);
});
test("global deductions explicitly mention the total count", () => {
  const board = Array.from({ length: 15 }, () => hidden());
  board[0] = clue(1);
  board[5] = clue(1);
  board[6] = clue(1);
  const coach = describeSquareCoach(inspect(board, 3, 5, 1, 14), 14);
  assert.match(coach.text, /board's total mine count/);
  assert.match(coach.text, /cannot contain a mine/);
  assert.deepEqual(coach.clues, []);
});
test("unresolved and terminal outcomes never acquire invented proofs", () => {
  const unresolved = inspect([clue(1), hidden(true), hidden(), hidden()], 2, 2, 1, 1);
  const terminal = inspect(
    [clue(1), { ...hidden(), revealed: true, exploded: true }, hidden(), hidden()],
    2,
    2,
    1,
    2,
  );
  for (const result of [unresolved, terminal]) {
    const coach = describeSquareCoach(result, 1);
    assert.equal(coach.text, result.summary);
    assert.deepEqual(coach.clues, []);
  }
});
test("local crop uses the explanation snapshot and keeps the original full proof available", () => {
  const ui = readFileSync(
    new URL("../components/coach/square-analysis-panel.tsx", import.meta.url),
    "utf8",
  );
  assert.match(ui, /const \{ board, columns \} = analysis\.explanation/);
  assert.match(ui, /replayCellGlyph\(cell\)/);
  assert.match(ui, /Outside this crop/);
  assert.match(ui, /expanded=\{false\} technical=\{technical\}/);
  assert.doesNotMatch(ui, /current\.after|game\.mines|hiddenMines/);
});
