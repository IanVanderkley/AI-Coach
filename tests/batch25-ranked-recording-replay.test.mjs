import assert from "node:assert/strict";
import test from "node:test";
import { replayRecordedGame } from "../lib/coach/verified-replay.ts";
import { readCompletedRankedRecording } from "../lib/ranked/coaching-recording.ts";
import { summarizeVerifiedRankedReview } from "../lib/ranked/coaching-analysis.ts";
import {
  preparePracticeAnalysis,
  projectCompletedAnalysis,
} from "../lib/coach/practice-analysis.ts";
import { scorePreparedPracticeReview } from "../lib/coach/review-score.ts";
import { buildPreparedTeachingReview } from "../lib/coach/teaching-review.ts";
import { readFileSync } from "node:fs";

const id = "11111111-1111-4111-8111-111111111111";
const uid = "22222222-2222-4222-8222-222222222222";
const start = "2026-11-26T12:00:00.000Z";
const end = "2026-11-26T12:00:10.000Z";
const mines = [
  ...Array.from({ length: 16 }, (_, i) => 48 + i),
  ...Array.from({ length: 16 }, (_, i) => 96 + i),
  ...Array.from({ length: 8 }, (_, i) => 144 + i),
];
const mineSet = new Set(mines);

// Independent flood-fill fixture: construct the expected server safe-reveal
// set without asking the production coaching replay to generate its own oracle.
function neighbors(index) {
  const output = [];
  const row = Math.floor(index / 16);
  const col = index % 16;
  for (let r = Math.max(0, row - 1); r <= Math.min(15, row + 1); r++) {
    for (let c = Math.max(0, col - 1); c <= Math.min(15, col + 1); c++) {
      if (r !== row || c !== col) output.push(r * 16 + c);
    }
  }
  return output;
}

function fixture(status) {
  const revealed = new Set();
  const flags = new Set();
  const moves = [];
  function record(action, index) {
    moves.push({
      match_id: id,
      move_number: moves.length + 1,
      action,
      row_index: Math.floor(index / 16),
      column_index: index % 16,
      received_at: start,
    });
  }
  function flood(index) {
    const queue = [index];
    while (queue.length) {
      const next = queue.shift();
      if (revealed.has(next) || flags.has(next) || mineSet.has(next)) continue;
      revealed.add(next);
      const adjacent = neighbors(next);
      if (!adjacent.some((near) => mineSet.has(near))) queue.push(...adjacent);
    }
  }
  record("reveal", 0);
  flood(0);
  record("flag", 48);
  flags.add(48);
  record("unflag", 48);
  flags.delete(48);
  if (status === "won") {
    for (let index = 0; index < 256; index++) {
      if (mineSet.has(index) || revealed.has(index)) continue;
      record("reveal", index);
      flood(index);
    }
    assert.equal(revealed.size, 216);
  } else if (status === "chord-loss") {
    record("reveal", 64);
    flood(64);
    // R5C1 has two adjacent mines (48,49) and two covered safe neighbors
    // at 80,81. Flag the two safe neighbors, then chord the number.
    record("flag", 80);
    flags.add(80);
    record("flag", 81);
    flags.add(81);
    record("chord", 64);
    status = "lost";
  } else {
    // Preserve one flag on a mine after a loss. SQL never marks mines as safe reveals.
    record("flag", 48);
    flags.add(48);
    record("reveal", 49);
  }
  const match = {
    id,
    user_id: uid,
    status,
    rows: 16,
    columns: 16,
    mine_count: 40,
    move_count: moves.length,
    duration_ms: 10000,
    started_at: start,
    finished_at: end,
  };
  const state = {
    match_id: id,
    first_move_done: true,
    mine_positions: [...mines],
    revealed_positions: [...revealed],
    flagged_positions: [...flags],
  };
  const verified =
    status === "won"
      ? {
          match_id: id,
          user_id: uid,
          board_rows: 16,
          board_columns: 16,
          mine_count: 40,
          duration_ms: 10000,
          finished_at: end,
        }
      : null;
  return {
    match,
    state,
    moves,
    store: {
      match: async () => match,
      state: async () => state,
      moves: async () => moves,
      verifiedResult: async () => verified,
    },
  };
}

for (const status of ["won", "lost", "chord-loss"]) {
  test(`actual shared replay matches independently constructed Ranked ${status} state`, async () => {
    const f = fixture(status);
    const result = await readCompletedRankedRecording(
      f.store,
      id,
      uid,
      replayRecordedGame,
    );
    assert.equal(result.ok, true);
    assert.equal(result.data.recording.outcome, status === "won" ? "win" : "loss");
  });
}

test("actual replay rejects a committed no-op even if the outcome would otherwise match", async () => {
  const f = fixture("lost");
  f.moves.splice(1, 0, { ...f.moves[0], move_number: 2 });
  f.moves.forEach((move, index) => (move.move_number = index + 1));
  f.match.move_count = f.moves.length;
  assert.deepEqual(
    await readCompletedRankedRecording(f.store, id, uid, replayRecordedGame),
    {
      ok: false,
      status: 422,
    },
  );
});

for (const status of ["won", "lost", "chord-loss"]) {
  test(`Ranked ${status} uses the identical post-opening Practice learning projection`, async () => {
    const f = fixture(status);
    let calls = 0;
    const checked = await readCompletedRankedRecording(f.store, id, uid, (game) => {
      calls++;
      return replayRecordedGame(game);
    });
    assert.equal(checked.ok, true);
    const summary = summarizeVerifiedRankedReview(checked);
    assert.equal(calls, 1);
    const practice = preparePracticeAnalysis(checked.data.recording);
    assert.deepEqual(summary.score, scorePreparedPracticeReview(practice));
    assert.deepEqual(summary.report, practice.report);
    assert.equal(summary.report.recordedActions, f.moves.length - 1);
    assert.equal(
      summary.score.good + summary.score.mistakes + summary.score.uncertain,
      f.moves.length - 1,
    );
    assert.deepEqual(Object.keys(summary).sort(), ["report", "score", "version"]);
    assert.equal(summary.version, practice.version);
  });
}

test("Ranked teaching proofs retain original move IDs and post-opening display numbering", async () => {
  const f = fixture("chord-loss");
  const checked = await readCompletedRankedRecording(
    f.store,
    id,
    uid,
    replayRecordedGame,
  );
  assert.equal(checked.ok, true);
  const analysis = projectCompletedAnalysis(checked.data.recording, checked.replay);
  assert.equal(analysis.replay, checked.replay);
  const teaching = buildPreparedTeachingReview(analysis);
  assert.ok(teaching.report.moments.length > 0);
  for (const moment of teaching.report.moments) {
    assert.equal(moment.id, `move-${moment.moveNumber}`);
    assert.ok(moment.moveNumber > 1);
    const followUp = teaching.followUpReport.moments.find(
      (item) => item.id === moment.id,
    );
    assert.equal(followUp.moveNumber, moment.moveNumber - 1);
    assert.ok(teaching.explanations.has(moment.id));
  }
});

test("shared post-opening projection rejects a terminal outcome mismatch", async () => {
  const f = fixture("lost");
  const checked = await readCompletedRankedRecording(
    f.store,
    id,
    uid,
    replayRecordedGame,
  );
  assert.equal(checked.ok, true);
  assert.throws(
    () =>
      projectCompletedAnalysis(
        { ...checked.data.recording, outcome: "win" },
        checked.replay,
      ),
    /outcome/i,
  );
});

test("Ranked endpoint only projects a successful server read and serializes no internal replay", () => {
  const route = readFileSync("app/api/ranked/coaching/recording/route.ts", "utf8");
  assert.ok(
    route.indexOf("if (!result.ok)") <
      route.indexOf("const review = summarizeVerifiedRankedReview(result)"),
  );
  assert.match(route, /Response\.json\(\{ \.\.\.result\.data, review \}/);
  assert.doesNotMatch(route, /Response\.json\(result[,)]|request\.json\(/);
});
