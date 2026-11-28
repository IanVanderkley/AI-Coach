import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
const ts = createRequire(import.meta.url)("typescript");
const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const source = ts.transpileModule(read("lib/coach/replay-accessibility.ts"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { replayKeyboardIndex, nearbyReplayClues, describeReplayRows } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);
const hidden = () => ({
  revealed: false,
  exploded: false,
  flagged: false,
  adjacentMines: null,
});
const clue = (n) => ({ ...hidden(), revealed: true, adjacentMines: n });
for (const [rows, cols] of [
  [9, 9],
  [16, 16],
  [16, 30],
]) {
  test(`keyboard navigation respects ${rows}x${cols} boundaries`, () => {
    const count = rows * cols;
    assert.equal(replayKeyboardIndex(0, cols, count, "ArrowLeft"), 0);
    assert.equal(replayKeyboardIndex(cols - 1, cols, count, "ArrowRight"), cols - 1);
    assert.equal(replayKeyboardIndex(0, cols, count, "ArrowUp"), 0);
    assert.equal(replayKeyboardIndex(count - 1, cols, count, "ArrowDown"), count - 1);
    assert.equal(replayKeyboardIndex(cols, cols, count, "ArrowUp"), 0);
    assert.equal(replayKeyboardIndex(0, cols, count, "ArrowDown"), cols);
    assert.equal(replayKeyboardIndex(cols + 1, cols, count, "Home"), cols);
    assert.equal(replayKeyboardIndex(cols + 1, cols, count, "End"), cols * 2 - 1);
    assert.equal(replayKeyboardIndex(0, cols, count, "Enter"), null);
  });
  test(`nearby clues use only visible neighbors on ${rows}x${cols}`, () => {
    const cells = Array.from({ length: rows * cols }, hidden);
    cells[1] = clue(1);
    cells[cols] = clue(2);
    cells[cols + 1] = { ...hidden(), flagged: true, adjacentMines: 3 };
    cells[cols - 1] = clue(1);
    assert.deepEqual(nearbyReplayClues(cells, cols, 0), [1, cols]);
    cells[cols] = { ...clue(2), exploded: true };
    assert.deepEqual(nearbyReplayClues(cells, cols, 0), [1]);
    cells[1] = clue(0);
    assert.deepEqual(nearbyReplayClues(cells, cols, 0), []);
  });
}
test("invalid indices and dimensions are rejected", () => {
  assert.equal(replayKeyboardIndex(-1, 9, 81, "ArrowRight"), null);
  assert.equal(replayKeyboardIndex(0, 0, 81, "ArrowRight"), null);
  assert.deepEqual(nearbyReplayClues([hidden()], 2, 0), []);
});
test("text alternatives keep recorded move, inspection and nearby context distinct", () => {
  const rows = describeReplayRows(
    [hidden(), clue(1), hidden(), hidden()],
    2,
    0,
    new Set(),
    new Set(),
    new Set(),
    null,
    2,
    new Set([1]),
  );
  assert.match(rows[0], /C1: covered, selected square/);
  assert.match(rows[0], /C2: revealed 1, nearby clue/);
  assert.match(rows[1], /C1: covered, inspected square/);
  assert.doesNotMatch(rows.join(" "), /proven safe|proven mine|supporting clue/);
});
test("both boards share inspection while recorded move and before-only deductions remain separate", () => {
  const ui = read("components/coach/verified-replay-panel.tsx");
  assert.equal((ui.match(/inspectedIndex=\{inspected\}/g) || []).length, 2);
  assert.equal((ui.match(/onInspect=\{inspectSquare\}/g) || []).length, 2);
  assert.equal((ui.match(/selectedIndex=\{chosen\}/g) || []).length, 2);
  assert.match(ui, /data-decision=\{selected \? decision : undefined\}/);
  assert.match(ui, /safeProofs=\{showProofs \? current\.deductions\.safe : \[\]\}/);
  assert.match(ui, /cells=\{current\.after\}[\s\S]*?safeProofs=\{\[\]\}/);
  assert.match(ui, /tabIndex=\{inspected \? 0 : -1\}/);
  assert.match(ui, /setInspection\(null\)/);
  assert.match(ui, /onClick=\{\(\) => onInspect\(index\)\}/);
});
