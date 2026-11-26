import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { describeReplayRows } from "../lib/coach/replay-accessibility.ts";
const covered = { revealed: false, flagged: false, adjacentMines: null, exploded: false };
const board = [
  { ...covered, revealed: true, adjacentMines: 1 },
  covered,
  { ...covered, flagged: true },
  { ...covered, revealed: true, adjacentMines: 0 },
];
const empty = new Set();
test("text alternative uses visible board facts, rectangular coordinates and selected cell", () => {
  assert.deepEqual(describeReplayRows(board, 2, 1, empty, empty, empty), [
    "Row 1: C1: revealed 1; C2: covered, selected square.",
    "Row 2: C1: player flag; C2: revealed 0.",
  ]);
});
test("deductions are exposed only when provided; a player flag is not proof", () => {
  const rows = describeReplayRows(
    board,
    2,
    1,
    new Set([1]),
    new Set([2]),
    new Set([0]),
    1,
  );
  assert.match(rows[0], /supporting clue/);
  assert.match(rows[0], /covered, proven safe, selected square, suggested reveal/);
  assert.match(rows[1], /player flag, proven mine/);
  assert.doesNotMatch(
    describeReplayRows(board, 2, 1, empty, empty, empty, 1).join(" "),
    /proven|suggested reveal/,
  );
});
test("invalid dimensions do not create misleading text rows", () => {
  for (const columns of [0, -1, 1.5, 3, Infinity])
    assert.deepEqual(describeReplayRows(board, columns, 0, empty, empty, empty), []);
});
test("read-only text disclosure is wired to the same board and overlay inputs", () => {
  const source = readFileSync(
    new URL("../components/coach/verified-replay-panel.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /className="coach-board-text"/);
  assert.match(
    source,
    /describeReplayRows\(\s*cells,\s*columns,\s*selectedIndex,\s*safe,\s*mines,\s*sources,\s*recommendation,?\s*\)/,
  );
  assert.match(source, /textOpen &&/);
  assert.match(source, /tabIndex=\{0\}/);
});
test("responsive CSS preserves scrolling and keyboard focus", () => {
  const css = readFileSync(
    new URL("../styles/batch25-review-workspace.css", import.meta.url),
    "utf8",
  );
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /coach-proof-board-scroll:focus-visible/);
  assert.match(css, /overscroll-behavior-inline: contain/);
  assert.match(css, /coach-board-text:not\(\[open\]\)/);
});
