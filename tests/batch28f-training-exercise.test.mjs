import test from "node:test";
import assert from "node:assert/strict";
import {
  parseTrainingExercise,
  prepareTrainingExercise,
  assessTrainingAnswer,
  trainingVisibleBoard,
} from "../lib/coach/training-exercise.ts";

const example = (extra = {}) => ({
  version: 1,
  id: "direct-mine",
  title: "Find a guaranteed mine",
  difficulty: "beginner",
  rows: 3,
  columns: 3,
  mineCount: 1,
  cells: [1, "covered", "covered", 1, 1, 1, 0, 0, 0],
  objective: { kind: "flag-mine" },
  ...extra,
});
const prepare = (e) => {
  const result = prepareTrainingExercise(e);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.prepared;
};
const classify = (index) => ({ kind: "classify-square", index });
const assess = (p, a) => assessTrainingAnswer(p, a).status;
const square = (p, i) => p.squares.find((s) => s.index === i);

test("versioned exercise parses only the visible board and supported metadata", () => {
  const raw = example({ title: "  Find a mine  " });
  const p = parseTrainingExercise(raw);
  assert.equal(p.title, "Find a mine");
  assert.deepEqual(p.cells, raw.cells);
  assert.notEqual(p.cells, raw.cells);
  assert.notEqual(p.objective, raw.objective);
  assert.deepEqual(trainingVisibleBoard(p)[1], {
    revealed: false,
    flagged: false,
    adjacentMines: null,
    exploded: false,
  });
});
test("invalid dimensions, clue values, sparse arrays, missing clues and unsupported objectives fail closed", () => {
  for (const e of [
    null,
    [],
    {},
    example({ version: 2 }),
    example({ rows: 1 }),
    example({ rows: 31 }),
    example({ rows: 30, columns: 30, cells: Array(900).fill(1) }),
    example({ columns: 3.5 }),
    example({ mineCount: 9 }),
    example({ mineCount: -1 }),
    example({ cells: Array(9) }),
    example({ cells: Array(9).fill("covered") }),
    example({ cells: Array(9).fill(0) }),
    example({ cells: [9, ...example().cells.slice(1)] }),
    example({ cells: [null, ...example().cells.slice(1)] }),
    example({ objective: classify(0) }),
    example({ objective: classify(99) }),
    example({ objective: { kind: "chord" } }),
    example({ id: "../test" }),
    example({ title: " " }),
    example({ difficulty: "Expert" }),
  ])
    assert.deepEqual(prepareTrainingExercise(e), { ok: false, reason: "invalid" });
});
test("hidden layouts and supplied answer keys are rejected at the definition boundary", () => {
  for (const e of [
    example({ mines: [1] }),
    example({ solution: 1 }),
    example({ answer: 1 }),
    example({ userId: "x" }),
    example({ objective: { kind: "flag-mine", index: 1 } }),
    example({ objective: { kind: "classify-square", index: 1, answer: "mine" } }),
  ])
    assert.equal(parseTrainingExercise(e), null);
});
test("exact layout counting rejects impossible clues rather than trusting rule proofs", () => {
  for (const e of [
    example({ rows: 2, columns: 2, mineCount: 1, cells: [1, 2, "covered", "covered"] }),
    example({
      rows: 2,
      columns: 2,
      mineCount: 1,
      cells: [0, "covered", "covered", "covered"],
    }),
  ])
    assert.deepEqual(prepareTrainingExercise(e), { ok: false, reason: "inconsistent" });
});
test("bounded incomplete enumeration cannot authorize any exercise", () => {
  const cells = Array.from({ length: 64 }, (_, i) =>
    (Math.floor(i / 8) + (i % 8)) % 2 === 0 ? 1 : "covered",
  );
  assert.deepEqual(
    prepareTrainingExercise(
      example({ rows: 8, columns: 8, mineCount: 8, cells, objective: classify(1) }),
    ),
    { ok: false, reason: "limited" },
  );
});
test("guaranteed-mine and guaranteed-safe objectives derive the actual answers", () => {
  const mine = prepare(example());
  assert.deepEqual(mine.solution, { kind: "select-square", indices: [1] });
  assert.equal(mine.totalLayouts, "1");
  assert.equal(square(mine, 1).classification, "mine");
  assert.equal(square(mine, 2).classification, "safe");
  assert.ok(square(mine, 1).proof);
  const safe = prepare(example({ objective: { kind: "reveal-safe" } }));
  assert.deepEqual(safe.solution, { kind: "select-square", indices: [2] });
  assert.equal(assess(mine, { index: 1 }), "correct");
  assert.equal(assess(mine, { index: 2 }), "incorrect");
  assert.equal(assess(safe, { index: 2 }), "correct");
});
test("any eligible guaranteed square is accepted, not an arbitrary author selection", () => {
  const p = prepare(
    example({
      rows: 2,
      columns: 3,
      mineCount: 0,
      cells: [0, "covered", "covered", "covered", "covered", "covered"],
      objective: { kind: "reveal-safe" },
    }),
  );
  assert.deepEqual(p.solution.indices, [1, 2, 3, 4, 5]);
  for (const index of p.solution.indices) assert.equal(assess(p, { index }), "correct");
});
test("unresolved squares are explicitly uncertain, not inferred safe or mined", () => {
  const e = example({
    rows: 2,
    columns: 2,
    mineCount: 1,
    cells: [1, "covered", "covered", "covered"],
    objective: classify(1),
  });
  const p = prepare(e);
  assert.equal(p.totalLayouts, "3");
  assert.equal(square(p, 1).mineLayouts, "1");
  assert.equal(assess(p, { classification: "uncertain" }), "correct");
  assert.equal(assess(p, { classification: "safe" }), "incorrect");
  assert.equal(assess(p, { classification: "mine" }), "incorrect");
  for (const kind of ["flag-mine", "reveal-safe"])
    assert.deepEqual(prepareTrainingExercise({ ...e, objective: { kind } }), {
      ok: false,
      reason: "no-solution",
    });
});
test("flags do not establish certainty, and already flagged squares are not new moves", () => {
  const p = prepare(
    example({
      rows: 2,
      columns: 2,
      mineCount: 1,
      cells: [1, "flagged", "covered", "covered"],
      objective: classify(1),
    }),
  );
  assert.equal(assess(p, { classification: "uncertain" }), "correct");
  assert.equal(p.totalLayouts, "3");
  assert.deepEqual(
    prepareTrainingExercise(
      example({ cells: [1, "flagged", "covered", 1, 1, 1, 0, 0, 0] }),
    ),
    { ok: false, reason: "no-solution" },
  );
  const safe = prepare(example({ cells: [1, "covered", "flagged", 1, 1, 1, 0, 0, 0] }));
  assert.equal(assess(safe, { index: 2 }), "invalid");
});
test("invalid answers are distinct from incorrect valid choices", () => {
  const p = prepare(example());
  for (const a of [
    null,
    [],
    {},
    { index: -1 },
    { index: 9 },
    { index: 1.5 },
    { index: "1" },
    { index: 0 },
    { index: 1, correct: true },
    { classification: "mine" },
  ])
    assert.equal(assess(p, a), "invalid");
  const c = prepare(example({ objective: classify(1) }));
  for (const a of [
    { classification: "guess" },
    { index: 1 },
    { classification: "mine", index: 1 },
  ])
    assert.equal(assess(c, a), "invalid");
  assert.equal(assess(c, { classification: "mine" }), "correct");
});
test("preparation is deterministic, JSON serializable and does not mutate inputs", () => {
  const e = example(),
    before = structuredClone(e);
  Object.freeze(e.cells);
  Object.freeze(e.objective);
  Object.freeze(e);
  const p = prepare(e),
    q = prepare(e);
  assert.deepEqual(p, q);
  assert.deepEqual(e, before);
  assert.deepEqual(JSON.parse(JSON.stringify(p)), p);
  assess(p, { index: 2 });
  assert.deepEqual(p, q);
  assert.ok(!("mines" in p.exercise));
});
test("all small 2x3 snapshots agree with an independent full-layout oracle", () => {
  const n = 6,
    full = (1 << n) - 1,
    pop = (x) => {
      let c = 0;
      for (; x; x &= x - 1) c++;
      return c;
    };
  const near = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => j)
      .filter(
        (j) =>
          j !== i &&
          Math.abs(Math.floor(i / 3) - Math.floor(j / 3)) <= 1 &&
          Math.abs((i % 3) - (j % 3)) <= 1,
      )
      .reduce((m, j) => m | (1 << j), 0),
  );
  const cases = new Map();
  for (let layout = 0; layout < full; layout++) {
    const safe = full ^ layout;
    for (let shown = safe; shown; shown = (shown - 1) & safe) {
      if (shown === full) continue;
      const cells = near.map((m, i) => (shown & (1 << i) ? pop(m & layout) : "covered"));
      const key = JSON.stringify([pop(layout), cells]);
      let c = cases.get(key);
      if (!c) {
        c = { mineCount: pop(layout), cells, total: 0, hits: Array(n).fill(0) };
        cases.set(key, c);
      }
      c.total++;
      for (let i = 0; i < n; i++) if (layout & (1 << i)) c.hits[i]++;
    }
  }
  let checked = 0;
  for (const c of cases.values()) {
    const index = c.cells.indexOf("covered");
    const p = prepare(
      example({
        rows: 2,
        columns: 3,
        mineCount: c.mineCount,
        cells: c.cells,
        objective: classify(index),
      }),
    );
    assert.equal(p.totalLayouts, String(c.total));
    for (const s of p.squares) {
      assert.equal(s.mineLayouts, String(c.hits[s.index]));
      assert.equal(
        s.classification,
        c.hits[s.index] === 0
          ? "safe"
          : c.hits[s.index] === c.total
            ? "mine"
            : "uncertain",
      );
      checked++;
    }
  }
  assert.ok(checked > 1000);
  console.log(`Oracle: ${cases.size} snapshots, ${checked} covered squares`);
});
