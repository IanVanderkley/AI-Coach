import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  appendRankedIntent,
  canDispatchRankedIntent,
  takeRankedIntent,
  MAX_QUEUED_RANKED_MOVES,
} from "../lib/ranked/input-queue.ts";
import { createRankedMoveTiming } from "../lib/ranked/move-timing.ts";

const intent = (row, column, action = "reveal", matchId = "match") => ({
  row,
  column,
  action,
  matchId,
});
const board = {
  matchId: "match",
  status: "active",
  rows: 16,
  columns: 16,
  firstMoveDone: true,
  revealedCells: [{ row: 0, column: 0, adjacentMines: 1 }],
  flaggedCells: [{ row: 0, column: 1 }],
};

test("queue preserves FIFO and caps outstanding inputs", () => {
  let queue = [];
  for (let col = 1; col <= 5; col++)
    queue = appendRankedIntent(queue, intent(5, col), null);
  assert.equal(queue.length, MAX_QUEUED_RANKED_MOVES);
  assert.deepEqual(
    queue.map((m) => m.column),
    [1, 2, 3],
  );
  const { next, remaining } = takeRankedIntent(queue, board);
  assert.equal(next.column, 1);
  assert.deepEqual(
    remaining.map((m) => m.column),
    [2, 3],
  );
});

test("queue does not duplicate an active or already queued square", () => {
  const active = intent(3, 3);
  assert.deepEqual(appendRankedIntent([], intent(3, 3, "flag"), active), []);
  const queue = [intent(2, 2)];
  assert.equal(appendRankedIntent(queue, intent(2, 2, "flag"), active), queue);
});

test("queued reveals never change into chords, and flags respect first reveal", () => {
  assert.equal(canDispatchRankedIntent(board, intent(0, 0)), false);
  assert.equal(canDispatchRankedIntent(board, intent(0, 1)), false);
  assert.equal(canDispatchRankedIntent(board, intent(0, 0, "flag")), false);
  assert.equal(
    canDispatchRankedIntent({ ...board, firstMoveDone: false }, intent(1, 1, "flag")),
    false,
  );
  assert.equal(canDispatchRankedIntent(board, intent(0, 1, "flag")), true);
  assert.equal(canDispatchRankedIntent(board, intent(1, 1)), true);
});

test("queued chords use current visible neighboring flags, not guessed mine positions", () => {
  const chord = intent(0, 0, "chord");
  assert.equal(canDispatchRankedIntent(board, chord), true);
  assert.equal(canDispatchRankedIntent({ ...board, flaggedCells: [] }, chord), false);
  const full = {
    ...board,
    revealedCells: [
      ...board.revealedCells,
      { row: 1, column: 0, adjacentMines: 1 },
      { row: 1, column: 1, adjacentMines: 1 },
    ],
  };
  assert.equal(canDispatchRankedIntent(full, chord), false);
});

test("terminal, stale match and invalid coordinates cannot dispatch", () => {
  for (const invalid of [
    intent(-1, 0),
    intent(16, 0),
    intent(0, 2.5),
    intent(2, 2, "reveal", "other"),
  ])
    assert.equal(canDispatchRankedIntent(board, invalid), false);
  for (const status of ["lost", "won"])
    assert.equal(takeRankedIntent([intent(2, 2)], { ...board, status }).next, null);
  assert.deepEqual(takeRankedIntent([intent(0, 0), intent(1, 1), intent(2, 2)], board), {
    next: intent(1, 1),
    remaining: [intent(2, 2)],
  });
});

test("server timing attaches only elapsed numeric durations and preserves response", async () => {
  let now = 10;
  const t = createRankedMoveTiming(() => now);
  now = 15;
  t.startAuth();
  now = 45;
  t.finishAuth();
  now = 50;
  t.startDatabase();
  now = 75;
  const response = t.attach(
    Response.json(
      { result: "ok" },
      { status: 200, headers: { "Cache-Control": "private, no-store" } },
    ),
  );
  assert.equal(
    response.headers.get("Server-Timing"),
    "app;dur=65, auth;dur=30, db;dur=25",
  );
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(await response.json(), { result: "ok" });
});

test("page serializes queued moves, clears unsent input on recovery and rechecks revision", () => {
  const source = readFileSync("app/ranked/page.tsx", "utf8");
  assert.match(source, /recoveringRef\.current = true;\s*clearQueuedMoves\(\);/);
  assert.match(source, /async function startMatch\(\) \{\s*clearQueuedMoves\(\);/);
  assert.match(source, /board\.moveCount > sent\.revision/);
  assert.match(
    source,
    /if \(moveInFlight\.current \|\| submittingMove \|\| !revisionReady\(\)\)\s+return/,
  );
  assert.match(source, /takeRankedIntent\(queueRef\.current, board\)/);
  assert.match(source, /queueMove\("chord", row, column\)/);
  assert.match(source, /queueMove\("flag", row, column\)/);
  assert.match(source, /queueMove\("reveal", row, column\)/);
  assert.match(source, /aria-busy=\{isPending \|\| isQueued\}/);
  assert.match(source, /document\.visibilityState === "hidden"/);
  assert.match(source, /Cancel queued/);
});

test("all three move endpoints time auth and one admitted RPC without changing security", () => {
  for (const action of ["reveal", "flag", "chord"]) {
    const source = readFileSync(`app/api/ranked/matches/${action}/route.ts`, "utf8");
    assert.ok(
      source.indexOf("timing.startAuth()") < source.indexOf("supabase.auth.getUser()"),
    );
    assert.ok(source.indexOf("timing.finishAuth()") < source.indexOf("status: 401"));
    assert.ok(
      source.indexOf("timing.startDatabase()") >
        source.indexOf("if (!isRankedMoveRevision(expectedMoveCount))"),
    );
    assert.ok(
      source.indexOf("timing.startDatabase()") <
        source.indexOf('admin.rpc("execute_ranked_move",'),
    );
    assert.match(
      source,
      /timing\.attach\(combinedMoveResponse\(data, Boolean\(error\)\)\)/,
    );
  }
});
