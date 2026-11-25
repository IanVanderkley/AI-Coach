import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deduceVisibleBoard } from "../lib/coach/verified-replay.ts";
import { describeGroup, describeVisual, proofBounds } from "../lib/coach/visual-proof.ts";
const covered = () => ({
  revealed: false,
  flagged: false,
  adjacentMines: null,
  exploded: false,
});
const clue = (n) => ({ ...covered(), revealed: true, adjacentMines: n });

test("visual direct clue shows actual mine count and unresolved cells", () => {
  const board = [clue(1), covered(), clue(1), clue(1)];
  const v = deduceVisibleBoard(2, 2, 1, board, true).mines.find((p) => p.index === 1)
    .derivation.visual;
  assert.deepEqual(v.result, [1]);
  assert.equal(v.mineCount, 1);
  assert.equal(v.groups[0].remainingMines, 1);
  assert.deepEqual(v.groups[0].cells, [1]);
  assert.match(describeVisual(v).conclusion, /must be a mine/);
});
test("subset lesson colors the actual shared group and safe difference", () => {
  const board = [
    clue(1),
    { ...covered(), flagged: true },
    covered(),
    covered(),
    clue(1),
    covered(),
  ];
  const v = deduceVisibleBoard(2, 3, 1, board, true).safe.find((p) => p.index === 2)
    .derivation.visual;
  const [a, b] = v.groups;
  assert.ok(a.cells.every((i) => b.cells.includes(i)));
  assert.deepEqual(
    v.result,
    b.cells.filter((i) => !a.cells.includes(i)),
  );
  assert.equal(v.mineCount, b.remainingMines - a.remainingMines);
  assert.equal(v.mineCount, 0);
  assert.ok(a.cells.includes(1));
  assert.ok(!a.knownMines.includes(1));
  assert.match(describeVisual(v).reasoning, /1 − 1 = 0/);
  assert.match(describeVisual(v).conclusion, /safe to open/);
  assert.deepEqual(proofBounds(v, 2, 3), { top: 0, bottom: 1, left: 0, right: 2 });
});
test("proof crop uses rectangular board coordinates", () => {
  const v = {
    groups: [
      {
        clue: 59,
        originalCount: 1,
        remainingMines: 1,
        cells: [89],
        knownMines: [],
        knownSafe: [],
      },
    ],
    result: [89],
    mineCount: 1,
  };
  assert.deepEqual(proofBounds(v, 16, 30), { top: 0, bottom: 2, left: 28, right: 29 });
  assert.match(describeGroup(v.groups[0]), /1 unresolved square\b/);
});
test("visual derivations are opt-in, not an extra source of gameplay decisions", () => {
  const board = [clue(1), covered(), covered(), covered(), clue(1), covered()];
  const plain = deduceVisibleBoard(2, 3, 1, board);
  const traced = deduceVisibleBoard(2, 3, 1, board, true);
  for (const kind of ["safe", "mines"])
    assert.deepEqual(
      traced[kind].map(({ derivation, ...rest }) => rest),
      plain[kind],
    );
});
test("comparison defaults to compare, can be changed, and compact summary replaces old tiles", () => {
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  assert.match(read("lib/settings/replay-view.ts"), /useState<ReplayView>\("compare"\)/);
  assert.match(
    read("components/settings/replay-tooltip-setting.tsx"),
    /Default replay view/,
  );
  assert.match(
    read("components/coach/verified-replay-panel.tsx"),
    /viewOverride \?\? preferredView/,
  );
  assert.match(read("components/coach/coach-console.tsx"), /coach-history-screen/);
  assert.doesNotMatch(
    read("components/coach/coach-console.tsx"),
    /coach-selected-game-stats/,
  );
  assert.match(read("components/coach/teaching-proof.tsx"), /<ProofBoard/);
  assert.match(
    read("components/coach/teaching-proof.tsx"),
    /Exact numbers and coordinates/,
  );
});
