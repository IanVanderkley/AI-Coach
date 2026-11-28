import assert from "node:assert/strict";
import test from "node:test";
import { calculateVisibleProbabilities as original } from "../lib/coach/constraint-enumeration.ts";
import { calculateComponentProbabilities as probability } from "../lib/coach/component-probabilities.ts";
import {
  analyzeAdvancedSnapshot,
  inspectAdvanced,
} from "../lib/coach/advanced-square-analysis.ts";
import { readFileSync } from "node:fs";
import { replayRecordedGame } from "../lib/coach/verified-replay.ts";

const boardOf = (text, flagged = false) =>
  [...text].map((v) => ({
    revealed: v !== ".",
    flagged: v === "." && flagged,
    adjacentMines: v === "." ? null : Number(v),
    exploded: false,
  }));
const bit = (i) => 1 << i;
const pop = (n) => {
  let c = 0;
  for (; n; n &= n - 1) c++;
  return c;
};
// Independent full-layout oracle; no frontier or binomial weighting.
function corpus(rows, cols) {
  const n = rows * cols,
    full = bit(n) - 1,
    cases = new Map();
  const neighbors = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => j)
      .filter(
        (j) =>
          j !== i &&
          Math.abs(Math.floor(i / cols) - Math.floor(j / cols)) <= 1 &&
          Math.abs((i % cols) - (j % cols)) <= 1,
      )
      .reduce((m, j) => m | bit(j), 0),
  );
  for (let layout = 0; layout < full; layout++) {
    const safe = full ^ layout,
      mineCount = pop(layout);
    for (let shown = safe; ; shown = (shown - 1) & safe) {
      const clues = neighbors
        .map((m, i) => (shown & bit(i) ? String(pop(m & layout)) : "."))
        .join("");
      const key = `${mineCount}:${clues}`;
      let item = cases.get(key);
      if (!item) {
        item = { mineCount, clues, shown, models: 0, hits: Array(n).fill(0) };
        cases.set(key, item);
      }
      item.models++;
      for (let i = 0; i < n; i++) if (layout & bit(i)) item.hits[i]++;
      if (!shown) break;
    }
  }
  return cases;
}
for (const [r, c] of [
  [2, 2],
  [2, 3],
  [3, 3],
])
  test(`component probabilities match independent ${r}x${c} oracle`, (t) => {
    let snapshots = 0,
      squares = 0;
    for (const [key, x] of corpus(r, c)) {
      const board = boardOf(x.clues),
        before = JSON.stringify(board),
        result = probability(r, c, x.mineCount, board);
      assert.equal(result.status, "complete", key);
      assert.equal(result.totalLayouts, String(x.models), key);
      const expected = x.hits.flatMap((n, index) =>
        x.shown & bit(index) ? [] : [{ index, mineLayouts: String(n) }],
      );
      assert.deepEqual(result.squares, expected, key);
      assert.equal(JSON.stringify(board), before);
      snapshots++;
      squares += expected.length;
    }
    t.diagnostic(JSON.stringify({ snapshots, squares }));
  });
const choose = (n, k) => {
  if (k < 0 || k > n) return 0n;
  let v = 1n;
  for (let j = 1; j <= k; j++) v = (v * BigInt(n - j + 1)) / BigInt(j);
  return v;
};
// Disjoint 3x3 neighborhoods, each with exactly one mine among eight cells.
function splitBoard(r, c, maxGroups = Infinity) {
  const clues = [];
  for (let y = 1; y < r - 1; y += 3)
    for (let x = 1; x < c - 1; x += 3) clues.push(y * c + x);
  clues.splice(Math.min(clues.length, maxGroups));
  const board = boardOf(".".repeat(r * c));
  for (const i of clues) board[i] = { ...board[i], revealed: true, adjacentMines: 1 };
  return { board, clues };
}
for (const [name, r, c, m, maxGroups] of [
  ["Beginner", 9, 9, 10, 8],
  ["Intermediate", 16, 16, 40, 25],
  ["Expert", 16, 30, 99, 40],
])
  test(`${name}: split frontier exceeds old limit and gives exact analytic counts`, (t) => {
    const { board, clues } = splitBoard(r, c, maxGroups),
      groups = clues.length,
      outside = r * c - 9 * groups,
      extra = m - groups;
    assert.equal(original(r, c, m, board).status, "limited");
    const start = performance.now(),
      result = probability(r, c, m, board),
      ms = performance.now() - start;
    assert.equal(result.status, "complete");
    const total = 8n ** BigInt(groups) * choose(outside, extra);
    assert.equal(result.totalLayouts, total.toString());
    for (const s of result.squares) {
      const y = Math.floor(s.index / c),
        x = s.index % c;
      const frontier = clues.some(
        (i) => Math.abs(Math.floor(i / c) - y) <= 1 && Math.abs((i % c) - x) <= 1,
      );
      assert.equal(
        BigInt(s.mineLayouts),
        frontier ? total / 8n : 8n ** BigInt(groups) * choose(outside - 1, extra - 1),
      );
    }
    assert.equal(
      result.squares.reduce((v, s) => v + BigInt(s.mineLayouts), 0n),
      BigInt(m) * total,
    );
    const begin = performance.now(),
      advanced = analyzeAdvancedSnapshot(r, c, m, board),
      advancedMs = performance.now() - begin;
    assert.equal(advanced.probability.status, "complete");
    assert.equal(advanced.conflict, false);
    assert.deepEqual(advanced.probability, result);
    t.diagnostic(
      JSON.stringify({
        groups,
        frontier: 8 * groups,
        outside,
        nodes: result.nodes,
        probabilityMs: ms.toFixed(2),
        advancedMs: advancedMs.toFixed(2),
      }),
    );
  });
test("separate components with varying mine totals are coupled by the global count", () => {
  // Two separate copies of the nonuniform frontier pattern, with off-frontier cells.
  const r = 3,
    c = 10,
    clues = boardOf("1.1...1.1." + ".".repeat(20));
  for (let m = 2; m <= 5; m++) {
    const expected = Array(r * c).fill(0n);
    let layouts = 0n;
    const covered = clues.flatMap((v, i) => (v.revealed ? [] : [i]));
    const known = clues.flatMap((v, i) => (v.revealed ? [i] : []));
    const adjacent = (a, b) =>
      Math.abs(Math.floor(a / c) - Math.floor(b / c)) <= 1 &&
      Math.abs((a % c) - (b % c)) <= 1;
    function visit(pos, selected) {
      if (selected.length === m) {
        if (
          known.every(
            (i) =>
              selected.filter((j) => adjacent(i, j)).length === clues[i].adjacentMines,
          )
        ) {
          layouts++;
          for (const j of selected) expected[j]++;
        }
        return;
      }
      for (let k = pos; k <= covered.length - (m - selected.length); k++)
        visit(k + 1, [...selected, covered[k]]);
    }
    visit(0, []);
    const actual = probability(r, c, m, clues);
    assert.equal(actual.status, "complete");
    assert.equal(actual.totalLayouts, String(layouts));
    assert.deepEqual(
      actual.squares,
      covered.map((index) => ({ index, mineLayouts: String(expected[index]) })),
    );
  }
});
test("node and combination budgets fail closed after partial work", () => {
  const board = boardOf("1.1........."),
    result = probability(3, 4, 2, board);
  for (let n = 1; n < result.nodes; n++)
    assert.deepEqual(probability(3, 4, 2, board, { maxNodes: n }), {
      status: "limited",
      squares: [],
      nodes: n,
    });
  assert.deepEqual(probability(3, 4, 2, board, { maxNodes: result.nodes }), result);
  assert.deepEqual(probability(3, 4, 2, board, { maxCombineWork: 1 }), {
    status: "limited",
    squares: [],
    nodes: result.nodes,
  });
  assert.equal(probability(3, 4, 2, board, { maxComponent: 2 }).status, "limited");
  assert.equal(probability(3, 4, 2, board, { maxCombineWork: 250001 }).status, "invalid");
});
test("global inconsistency, terminal boards and malformed input cannot produce counts", () => {
  const { board } = splitBoard(9, 9);
  assert.equal(probability(9, 9, 8, board).status, "inconsistent");
  assert.equal(probability(2, 2, 1, boardOf("9...")).status, "invalid");
  assert.equal(probability(2, 2, 1, boardOf("2...")).status, "inconsistent");
  const terminal = boardOf("1...");
  terminal[1] = { ...terminal[1], revealed: true, exploded: true };
  assert.equal(probability(2, 2, 1, terminal).status, "terminal");
  assert.equal(probability(2, 2, 1, []).status, "invalid");
});
test("flags and hidden adjacency values are ignored; exact safe alternatives are labelled", () => {
  const board = boardOf("...121..."),
    changed = board.map((v, i) =>
      v.revealed ? v : { ...v, flagged: true, adjacentMines: i },
    );
  assert.deepEqual(probability(3, 3, 2, changed), probability(3, 3, 2, board));
  const s = analyzeAdvancedSnapshot(3, 3, 2, board);
  const result = inspectAdvanced(s, 0);
  assert.equal(result.risk.bestMine, "0%");
  assert.deepEqual(result.risk.best, [1, 7]);
  const ui = readFileSync(
    new URL("../components/coach/advanced-square-panel.tsx", import.meta.url),
    "utf8",
  );
  assert.match(ui, /bestMine === "0%"\s*\?\s*"Guaranteed safe alternatives:"/);
});
test("empty frontiers and large counts remain exact and JSON-safe", () => {
  const r = 50,
    c = 50,
    m = 1250,
    n = r * c,
    result = probability(r, c, m, boardOf(".".repeat(n)));
  assert.equal(result.status, "complete");
  assert.equal(result.totalLayouts, choose(n, m).toString());
  assert.ok(
    result.squares.every(
      (s) =>
        BigInt(s.mineLayouts) * BigInt(n) === BigInt(result.totalLayouts) * BigInt(m),
    ),
  );
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  const open = probability(2, 2, 0, boardOf("0000"));
  assert.equal(open.totalLayouts, "1");
  assert.deepEqual(open.squares, []);
});
test("real replay snapshots on all three board sizes preserve certainty and public mine totals", (t) => {
  for (const [name, r, c, m] of [
    ["Beginner", 9, 9, 10],
    ["Intermediate", 16, 16, 40],
    ["Expert", 16, 30, 99],
  ]) {
    const cells = Array.from({ length: r * c }, (_, i) => i);
    let seed = 137;
    for (let i = cells.length - 1; i > 0; i--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    const hidden = new Set(cells.slice(0, m));
    const numbered = cells
      .slice(m)
      .filter((i) =>
        [...hidden].some(
          (j) =>
            Math.abs(Math.floor(i / c) - Math.floor(j / c)) <= 1 &&
            Math.abs((i % c) - (j % c)) <= 1,
        ),
      );
    const moves = numbered
      .slice(0, 12)
      .map((i) => ({ action: "reveal", row: Math.floor(i / c), col: i % c }));
    const replay = replayRecordedGame({
      rows: r,
      columns: c,
      mineCount: m,
      mines: [...hidden],
      moves,
    });
    let complete = 0,
      limited = 0,
      maxMs = 0;
    for (const frame of replay.frames) {
      const start = performance.now(),
        result = analyzeAdvancedSnapshot(r, c, m, frame.before);
      maxMs = Math.max(maxMs, performance.now() - start);
      const p = result.probability;
      assert.equal(result.conflict, false);
      assert.ok(["complete", "limited"].includes(p.status));
      if (p.status === "limited") {
        limited++;
        assert.deepEqual(p.squares, []);
        continue;
      }
      complete++;
      const d = BigInt(p.totalLayouts);
      assert.ok(d > 0n);
      assert.equal(
        p.squares.reduce((n, s) => n + BigInt(s.mineLayouts), 0n),
        BigInt(m) * d,
      );
      for (const s of p.squares) {
        const n = BigInt(s.mineLayouts);
        assert.ok(n >= 0n && n <= d);
        if (n === 0n) assert.ok(!hidden.has(s.index));
        if (n === d) assert.ok(hidden.has(s.index));
      }
    }
    assert.ok(complete > 0);
    t.diagnostic(
      JSON.stringify({
        difficulty: name,
        complete,
        limited,
        maxAdvancedMs: maxMs.toFixed(2),
      }),
    );
  }
});
