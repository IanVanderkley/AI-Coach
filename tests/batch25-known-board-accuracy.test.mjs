import assert from "node:assert/strict";
import test from "node:test";
import { prepareVerifiedAnalysis } from "../lib/coach/verified-analysis.ts";
import { replayRecordedGame } from "../lib/coach/verified-replay.ts";
import {
  action,
  exhaustiveOracle,
  neighbors,
  referenceGame,
} from "./helpers/reference-practice.mjs";

// All 56 distinct three-mine layouts outside the first-click safety zone on
// a 3x4 board. The reference simulator creates expected visible states and
// independent hashes; the exhaustive oracle proves soundness of deductions.
const rows = 3;
const columns = 4;
const candidates = [2, 3, 6, 7, 8, 9, 10, 11];
const layouts = [];
for (let a = 0; a < candidates.length; a++) {
  for (let b = a + 1; b < candidates.length; b++) {
    for (let c = b + 1; c < candidates.length; c++) {
      layouts.push([candidates[a], candidates[b], candidates[c]]);
    }
  }
}
assert.equal(layouts.length, 56);

function fixtureFor(mines) {
  const actions = [action(0, 0, "reveal")];
  let fixture = referenceGame({ rows, columns, mines, actions });
  if (fixture.recording.outcome === "playing") {
    const mine = mines[0];
    actions.push(action(Math.floor(mine / columns), mine % columns, "flag"));
    actions.push(action(Math.floor(mine / columns), mine % columns, "unflag"));
    fixture = referenceGame({ rows, columns, mines, actions });
  }
  // Alternate reveal order to exercise different visible constraints.
  const indices = Array.from({ length: rows * columns }, (_, i) => i);
  if (mines[0] % 2 === 0) indices.reverse();
  for (const index of indices) {
    if (fixture.recording.outcome !== "playing") break;
    if (mines.includes(index) || fixture.frames.at(-1).after[index].revealed) continue;
    actions.push(action(Math.floor(index / columns), index % columns, "reveal"));
    fixture = referenceGame({ rows, columns, mines, actions });
  }
  assert.equal(fixture.recording.outcome, "win");
  return fixture;
}

for (const mines of layouts) {
  test(`independent known-board accuracy: mines ${mines.join("-")}`, () => {
    const fixture = fixtureFor(mines);
    const verified = prepareVerifiedAnalysis(fixture.recording);
    assert.equal(verified.ok, true);
    const replay = replayRecordedGame(verified.game);
    assert.equal(replay.status, "won");
    assert.equal(replay.frames.length, fixture.frames.length);
    for (const [i, frame] of replay.frames.entries()) {
      const expected = fixture.frames[i];
      assert.equal(frame.move.afterHash, expected.hash);
      for (const [index, actual] of frame.after.entries()) {
        const cell = expected.after[index];
        assert.equal(actual.revealed, cell.revealed);
        assert.equal(actual.flagged, cell.flagged);
        if (cell.revealed && !cell.mine)
          assert.equal(actual.adjacentMines, cell.adjacentMines);
      }
      const oracle = exhaustiveOracle(rows, columns, mines.length, frame.before);
      for (const proof of frame.deductions.safe) assert.ok(oracle.safe.has(proof.index));
      for (const proof of frame.deductions.mines)
        assert.ok(oracle.mines.has(proof.index));
      const chosen = frame.move.row * columns + frame.move.col;
      if (frame.decision === "good") {
        if (frame.move.action === "reveal") assert.ok(oracle.safe.has(chosen));
        if (frame.move.action === "flag") assert.ok(oracle.mines.has(chosen));
        if (frame.move.action === "chord") {
          const targets = neighbors(chosen, rows, columns).filter(
            (n) => !frame.before[n].revealed && !frame.before[n].flagged,
          );
          assert.ok(targets.every((n) => oracle.safe.has(n)));
        }
      }
      if (frame.mistakeType === "unnecessary-guess")
        assert.ok(frame.deductions.safe.length > 0);
      if (frame.mistakeType === "flagged-known-safe") assert.ok(oracle.safe.has(chosen));
      if (frame.mistakeType === "revealed-known-mine" && frame.move.action === "reveal")
        assert.ok(oracle.mines.has(chosen));
    }
    const report = verified.report;
    assert.equal(report.recordedActions, replay.frames.length);
    assert.equal(
      report.verifiedMistakes + report.provenGood + report.uncertainActions,
      replay.frames.length,
    );
    assert.equal(new Set(report.moments.map((m) => m.id)).size, report.moments.length);
    for (const moment of report.moments) {
      const frame = replay.frames[moment.moveNumber - 1];
      assert.equal(frame.decision, moment.kind === "good" ? "good" : "mistake");
    }
  });
}
