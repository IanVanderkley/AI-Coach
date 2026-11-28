import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { prepareSquareAnalysis, explainSquare } from "../lib/coach/square-analysis.ts";
const hidden = (flagged = false) => ({ revealed: false, flagged, adjacentMines: null, exploded: false });
const clue = n => ({ ...hidden(), revealed: true, adjacentMines: n });
const inspect = (board, rows, columns, count, index) => explainSquare(prepareSquareAnalysis(board, rows, columns, count), index);

test("one clue proves the remaining mine, with a real proof chain", () => {
  const result = inspect([clue(1), hidden(), clue(1), clue(1)], 2, 2, 1, 1);
  assert.equal(result.classification, "proven-mine");
  assert.ok(result.explanation.steps.length);
  assert.ok(result.explanation.steps.at(-1).visual.result.includes(1));
  assert.ok(result.explanation.clues.length);
});
test("zero clue proves a covered flagged square safe", () => {
  const result = inspect([clue(0), hidden(true), hidden(), hidden(), hidden(), hidden()], 2, 3, 1, 1);
  assert.equal(result.classification, "proven-safe");
  assert.match(result.flagNote, /contradicted/);
  assert.equal(result.explanation.steps.at(-1).visual.mineCount, 0);
});
test("a lucky flag remains unresolved and cannot prove neighboring squares", () => {
  const context = prepareSquareAnalysis([clue(1), hidden(true), hidden(), hidden()], 2, 2, 1);
  assert.equal(explainSquare(context, 1).classification, "unresolved");
  assert.match(explainSquare(context, 1).flagNote, /not proof/);
  assert.equal(explainSquare(context, 2).classification, "unresolved");
  assert.match(explainSquare(context, 2).summary, /does not mean a guess is unavoidable/);
});
test("a proven flagged mine is independently confirmed", () => {
  const result = inspect([clue(1), hidden(true), clue(1), clue(1)], 2, 2, 1, 1);
  assert.equal(result.classification, "proven-mine");
  assert.match(result.flagNote, /independent logical proof/);
});
test("revealed number explains its constraint, not a new proof", () => {
  const result = inspect([clue(1), hidden(), hidden(), hidden()], 2, 2, 1, 0);
  assert.equal(result.classification, "revealed");
  assert.match(result.summary, /exactly 1 mine touches/);
  assert.deepEqual(result.explanation.steps, []);
});
test("terminal exposed mines never become evidence for new deductions", () => {
  const board = [clue(1), { ...hidden(), revealed: true, exploded: true }, hidden(), hidden()];
  const context = prepareSquareAnalysis(board, 2, 2, 1);
  assert.equal(explainSquare(context, 1).classification, "revealed");
  assert.equal(explainSquare(context, 2).classification, "unresolved");
  assert.equal(context.proofs.size, 0);
});
test("a later clue can prove a safe square with ordered dependencies", () => {
  // Square 1 is the only covered neighbor of the first 1.
  const board = [clue(1), hidden(), hidden(), clue(1), clue(1), clue(1)];
  // Other clues then establish square 2 as safe.
  const result = inspect(board, 2, 3, 1, 2);
  assert.equal(result.classification, "proven-safe");
  assert.ok(result.explanation.steps.length >= 2);
  assert.ok(result.explanation.steps[0].visual.result.includes(1));
  assert.ok(result.explanation.steps.at(-1).visual.result.includes(2));
});
test("subset deductions explain the middle safe square in a 1-2-1 pattern", () => {
  const result = inspect([clue(1), clue(2), clue(1), hidden(), hidden(), hidden()], 2, 3, 2, 4);
  assert.equal(result.classification, "proven-safe");
  assert.ok(result.explanation.steps.some(step => step.visual.groups.length === 2));
  assert.ok(result.explanation.steps.at(-1).visual.result.includes(4));
});
test("global mine counting proves a square outside the visible clues' neighborhoods", () => {
  const board = Array.from({length: 15}, () => hidden());
  board[0] = clue(1); board[5] = clue(1); board[6] = clue(1);
  const result = inspect(board, 3, 5, 1, 14);
  assert.equal(result.classification, "proven-safe");
  assert.equal(result.explanation.steps.at(-1).visual.groups[0].clue, null);
});
test("same prepared board supports multiple selections without mutating evidence", () => {
  const board = [clue(1), hidden(), hidden(), clue(1), clue(1), clue(1)];
  const snapshot = JSON.stringify(board);
  const context = prepareSquareAnalysis(board, 2, 3, 1);
  assert.equal(explainSquare(context, 1).classification, "proven-mine");
  assert.equal(explainSquare(context, 2).classification, "proven-safe");
  assert.equal(JSON.stringify(board), snapshot);
  assert.equal(explainSquare(context, -1), null);
  assert.equal(explainSquare(context, 6), null);
});
for (const [rows, columns] of [[9,9],[16,16],[16,30]]) {
  test(`square inspection works on ${rows}x${columns} without trusting flags`, () => {
    const board = Array.from({length: rows * columns}, () => hidden());
    board[0] = clue(0); board[1] = hidden(true);
    const context = prepareSquareAnalysis(board, rows, columns, 10);
    assert.equal(explainSquare(context, 1).classification, "proven-safe");
    assert.equal(explainSquare(context, board.length - 1).classification, "unresolved");
  });
}
test("UI uses pre-move evidence, except opening, and memoizes independently of square selection", () => {
  const ui = readFileSync(new URL("../components/coach/verified-replay-panel.tsx", import.meta.url), "utf8");
  assert.match(ui, /selectedIndex === 0 \? current\.after : current\.before/);
  assert.match(ui, /\[current, selectedIndex, showProofs, game\.rows, game\.columns, game\.mineCount\]/);
  assert.match(ui, /explainSquare\(squareContext, inspected\)/);
  assert.match(ui, /showProofs && squareAnalysis/);
  assert.match(ui, /key=\{`square-\$\{current\.actionNumber\}-\$\{inspected\}`\}/);
});
