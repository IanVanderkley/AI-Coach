import assert from "node:assert/strict";
import { test } from "node:test";
import { proveFinalFiftyFifty } from "../lib/ranked/final-guess-proof.ts";

const N = 256;
const touching = (a, b) =>
  a !== b &&
  Math.abs((a % 16) - (b % 16)) <= 1 &&
  Math.abs(Math.floor(a / 16) - Math.floor(b / 16)) <= 1;
function cluesFor(mines, lastSafe) {
  return Array.from({ length: N }, (_, i) =>
    mines.has(i) || i === lastSafe
      ? null
      : [...mines].filter((m) => touching(i, m)).length,
  );
}
// Independent exhaustive oracle: build each complete hypothetical mine layout
// and count its actual neighbors, rather than subtracting from covered counts.
function oracle(clues) {
  const hidden = clues.flatMap((clue, i) => (clue === null ? [i] : []));
  if (hidden.length !== 41) return [];
  return hidden.filter((safe) => {
    const mines = hidden.filter((m) => m !== safe);
    return clues.every(
      (clue, i) => clue === null || mines.filter((m) => touching(i, m)).length === clue,
    );
  });
}
function layout(seed, forced, excluded) {
  const mines = new Set(forced);
  let x = seed >>> 0;
  while (mines.size < 40) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    const i = (x >>> 16) % N;
    if (!excluded.includes(i)) mines.add(i);
  }
  return mines;
}
// Corner pair 0,1: the differentiating neighbors (2,18) are mines;
// every revealed clue sees both or neither. Exclude distant opening region.
const opening = [119, 120, 121, 135, 136, 137, 151, 152, 153];
const pairBoard = cluesFor(layout(21, [1, 2, 18], [0, ...opening]), 0);

test("a genuine final corner 50/50 has exactly two consistent safe locations", () => {
  assert.deepEqual(oracle(pairBoard), [0, 1]);
  assert.deepEqual(proveFinalFiftyFifty(pairBoard), [0, 1]);
});
test("the same visible clues arise when the two candidate roles swap", () => {
  const mines = layout(21, [1, 2, 18], [0, ...opening]);
  mines.delete(1);
  mines.add(0);
  assert.deepEqual(cluesFor(mines, 1), pairBoard);
});
test("a unique final safe square is not a guess", () => {
  const board = cluesFor(layout(11, [], [136, ...opening]), 136);
  assert.deepEqual(oracle(board), [136]);
  assert.equal(proveFinalFiftyFifty(board), null);
});
test("three or more plausible final cells are not a straight 50/50", () => {
  // 3x3 corner block of covered squares; deep corner cells are not adjacent
  // to any visible clue, giving multiple equally consistent worlds.
  const board = cluesFor(layout(31, [1, 2, 16, 17, 18, 32, 33, 34], [0, ...opening]), 0);
  assert.ok(oracle(board).length >= 3);
  assert.equal(proveFinalFiftyFifty(board), null);
});
test("not at the final safe square, malformed clues and inconsistent boards fail closed", () => {
  const early = [...pairBoard];
  early[136] = null;
  assert.equal(proveFinalFiftyFifty(early), null);
  const bad = [...pairBoard];
  bad[136] = 9;
  assert.equal(proveFinalFiftyFifty(bad), null);
  const sparse = [...pairBoard];
  delete sparse[136];
  assert.equal(proveFinalFiftyFifty(sparse), null);
  const impossible = [...pairBoard];
  impossible[136] = 8;
  assert.equal(proveFinalFiftyFifty(impossible), null);
  assert.equal(proveFinalFiftyFifty([]), null);
  assert.equal(proveFinalFiftyFifty(null), null);
});
test("reference agrees with independent oracle on 96 deterministic layouts", () => {
  for (let seed = 1; seed <= 96; seed++) {
    const lastSafe = seed % 2 === 0 ? 0 : 136;
    const forced = lastSafe === 0 ? [1, 2, 18] : [];
    const board = cluesFor(layout(seed, forced, [lastSafe, ...opening]), lastSafe);
    const candidates = oracle(board);
    assert.deepEqual(
      proveFinalFiftyFifty(board),
      candidates.length === 2 ? candidates : null,
    );
  }
});
