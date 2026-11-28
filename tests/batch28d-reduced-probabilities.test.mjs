import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateComponentProbabilities as original,
  calculateReducedComponentProbabilities as reduced,
} from "../lib/coach/component-probabilities.ts";
import { analyzeAdvancedSnapshot } from "../lib/coach/advanced-square-analysis.ts";
import { replayRecordedGame, deduceVisibleBoard } from "../lib/coach/verified-replay.ts";

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
  test(`reduced counts match independent ${r}x${c} full-layout oracle`, (t) => {
    let snapshots = 0,
      squares = 0;
    for (const [key, x] of corpus(r, c)) {
      const board = boardOf(x.clues),
        before = JSON.stringify(board),
        result = reduced(r, c, x.mineCount, board);
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
  let v = 1n;
  for (let j = 1; j <= k; j++) v = (v * BigInt(n - j + 1)) / BigInt(j);
  return v;
};
test("large connected frontier: proven values removed without losing off-frontier layout weights", () => {
  const r = 3,
    c = 28,
    fixed = Array.from({ length: c }, (_, i) => i).filter((i) => i % 4 === 1),
    extra = 6;
  const clues = Array.from({ length: c }, (_, i) =>
    String(fixed.filter((j) => Math.abs(i - j) <= 1).length),
  ).join("");
  const board = boardOf(clues + ".".repeat(2 * c));
  const m = fixed.length + extra;
  assert.equal(original(r, c, m, board).status, "limited");
  const result = reduced(r, c, m, board);
  assert.equal(result.status, "complete");
  const layouts = choose(c, extra);
  assert.equal(result.totalLayouts, String(layouts));
  for (const s of result.squares)
    assert.equal(
      BigInt(s.mineLayouts),
      s.index < 2 * c
        ? fixed.includes(s.index - c)
          ? layouts
          : 0n
        : choose(c - 1, extra - 1),
    );
  const changed = board.map((v, i) =>
    v.revealed ? v : { ...v, flagged: i % 2 === 0, adjacentMines: 8 },
  );
  assert.deepEqual(reduced(r, c, m, changed), result);
  const snapshot = analyzeAdvancedSnapshot(r, c, m, board);
  assert.deepEqual(snapshot.probability, result);
  assert.equal(snapshot.conflict, false);
});
test("reduced engine rejects invalid, terminal and contradictory evidence", () => {
  assert.equal(reduced(2, 2, 1, boardOf("9...")).status, "invalid");
  assert.equal(reduced(2, 2, 1, boardOf("2...")).status, "inconsistent");
  assert.equal(reduced(2, 2, 1, boardOf("01..")).status, "inconsistent");
  const b = boardOf("1...");
  b[1] = { ...b[1], revealed: true, exploded: true };
  assert.equal(reduced(2, 2, 1, b).status, "terminal");
});
// Replay-derived test corpus: zero opening, then prefer proven-safe reveals.
// Only fixture generation knows the actual mines, never the probability solver.
for (const [name, r, c, m] of [
  ["Beginner", 9, 9, 10],
  ["Intermediate", 16, 16, 40],
  ["Expert", 16, 30, 99],
])
  test(`${name}: large connected replay frontiers recover exact results`, (t) => {
    let count = 0,
      oldComplete = 0,
      newComplete = 0,
      maxMs = 0,
      maxNodes = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const a = Array.from({ length: r * c }, (_, i) => i);
      let state = seed;
      for (let i = a.length - 1; i > 0; i--) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        const j = state % (i + 1);
        [a[i], a[j]] = [a[j], a[i]];
      }
      const near = (i, j) =>
        Math.abs(Math.floor(i / c) - Math.floor(j / c)) <= 1 &&
        Math.abs((i % c) - (j % c)) <= 1;
      const start = a[0],
        hidden = a.filter((i) => !near(i, start)).slice(0, m),
        moves = [{ action: "reveal", row: Math.floor(start / c), col: start % c }];
      let replay = replayRecordedGame({
        rows: r,
        columns: c,
        mineCount: m,
        mines: hidden,
        moves,
      });
      for (let k = 0; k < 30 && replay.status === "playing"; k++) {
        const b = replay.finalBoard;
        if (k % 5 === 0) {
          count++;
          const old = original(r, c, m, b);
          if (old.status === "complete") oldComplete++;
          const t0 = performance.now(),
            snapshot = analyzeAdvancedSnapshot(r, c, m, b),
            p = snapshot.probability;
          maxMs = Math.max(maxMs, performance.now() - t0);
          maxNodes = Math.max(maxNodes, p.nodes);
          assert.equal(snapshot.conflict, false);
          if (p.status === "complete") {
            newComplete++;
            const d = BigInt(p.totalLayouts);
            assert.ok(d > 0n);
            assert.equal(p.squares.length, b.filter((v) => !v.revealed).length);
            assert.equal(
              p.squares.reduce((n, s) => n + BigInt(s.mineLayouts), 0n),
              BigInt(m) * d,
            );
            for (const s of p.squares) {
              const n = BigInt(s.mineLayouts);
              assert.ok(n >= 0n && n <= d);
              if (n === 0n) assert.ok(!hidden.includes(s.index));
              if (n === d) assert.ok(hidden.includes(s.index));
            }
            if (old.status === "complete") assert.deepEqual(p, old);
          } else assert.deepEqual(p.squares, []);
        }
        const d = deduceVisibleBoard(r, c, m, b, false, true);
        const next =
          d.safe[0]?.index ??
          a.find(
            (i) =>
              !b[i].revealed &&
              !hidden.includes(i) &&
              b.some((v, j) => v.revealed && near(i, j)),
          );
        if (next == null) break;
        moves.push({ action: "reveal", row: Math.floor(next / c), col: next % c });
        replay = replayRecordedGame({
          rows: r,
          columns: c,
          mineCount: m,
          mines: hidden,
          moves,
        });
      }
    }
    assert.ok(newComplete > oldComplete);
    assert.ok(newComplete >= count * 0.9);
    t.diagnostic(
      JSON.stringify({
        count,
        oldComplete,
        newComplete,
        maxMs: maxMs.toFixed(2),
        maxNodes,
      }),
    );
  });
test("a genuinely huge ambiguous search still discards all partial counts", () => {
  const r = 3,
    c = 50,
    board = boardOf(".".repeat(c) + "2" + "3".repeat(c - 2) + "2" + ".".repeat(c));
  const result = reduced(r, c, c, board);
  assert.equal(result.status, "limited");
  assert.deepEqual(result.squares, []);
  assert.equal(result.nodes, 100000);
});
