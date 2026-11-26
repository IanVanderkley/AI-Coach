import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  describeTechnicalProof,
  proofStepIndices,
} from "../lib/coach/proof-presentation.ts";
const group = {
  clue: 7,
  originalCount: 1,
  remainingMines: 1,
  knownMines: [],
  knownSafe: [],
  cells: [6],
};
test("singular technical explanation preserves exact clue and result coordinates", () => {
  const lines = describeTechnicalProof({ groups: [group], result: [6], mineCount: 1 }, 9);
  assert.match(lines[0], /Clue R1C8: 1 mine\./);
  assert.match(lines[0], /1 - 0 = 1 mine in 1 unresolved square \(R1C7\)/);
  assert.match(lines[1], /R1C7\. This square is a mine/);
  assert.doesNotMatch(lines.join(" "), /1 mines|1 unresolved squares/);
});
test("known mine subtraction preserves a proven safe square", () => {
  const v = {
    groups: [{ ...group, clue: 5, knownMines: [6], cells: [4], remainingMines: 0 }],
    result: [4],
    mineCount: 0,
  };
  const before = structuredClone(v);
  const lines = describeTechnicalProof(v, 9);
  assert.match(lines[0], /1 - 1 = 0 mines in 1 unresolved square \(R1C5\)/);
  assert.match(lines[1], /R1C5\. This square is safe/);
  assert.deepEqual(v, before);
});
test("subset proof displays both groups and exact difference arithmetic", () => {
  const lines = describeTechnicalProof(
    { groups: [group, { ...group, clue: 15, cells: [6, 4] }], result: [4], mineCount: 0 },
    9,
  );
  assert.match(lines[0], /Group A/);
  assert.match(lines[1], /Group B: Clue R2C7/);
  assert.match(lines[2], /1 - 1 = 0 mines in 1 extra square/);
  assert.match(lines[3], /R1C5/);
});
test("global proof uses rectangular coordinates and plural results", () => {
  const lines = describeTechnicalProof(
    {
      groups: [
        {
          ...group,
          clue: null,
          originalCount: 2,
          remainingMines: 0,
          knownMines: [0, 1],
          cells: [29, 30],
        },
      ],
      result: [29, 30],
      mineCount: 0,
    },
    30,
  );
  assert.match(lines[0], /Board mine count: 2 mines/);
  assert.match(lines[1], /R1C30, R2C1\. These squares are safe/);
});
test("step navigation preserves order, clamps indices and retains full chain", () => {
  assert.deepEqual(proofStepIndices(3, -1, false), [0]);
  assert.deepEqual(proofStepIndices(3, 1, false), [1]);
  assert.deepEqual(proofStepIndices(3, 10, false), [2]);
  assert.deepEqual(proofStepIndices(3, NaN, false), [0]);
  assert.deepEqual(proofStepIndices(3, 1, true), [0, 1, 2]);
  assert.deepEqual(proofStepIndices(0, 1, true), []);
});
test("teaching component preserves visual proofs and full-chain controls", () => {
  const source = readFileSync(
    new URL("../components/coach/teaching-proof.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Show all steps/);
  assert.match(source, /<ProofBoard/);
  assert.match(source, /visibleSteps\.map/);
  assert.match(source, /describeTechnicalProof\(visual, explanation\.columns\)/);
  assert.match(source, /open=\{technical\}/);
});
