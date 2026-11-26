import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isRankedRecordingId,
  readCompletedRankedRecording,
  RANKED_COACHING_MAX_MOVES,
} from "../lib/ranked/coaching-recording.ts";

const matchId = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
const start = "2026-11-26T12:00:00.000Z";
const end = "2026-11-26T12:00:10.000Z";
const mines = [
  ...Array.from({ length: 16 }, (_, i) => 48 + i),
  ...Array.from({ length: 16 }, (_, i) => 96 + i),
  ...Array.from({ length: 8 }, (_, i) => 144 + i),
];
const opened = Array.from({ length: 48 }, (_, i) => i);
const move = (n, action, row, col) => ({
  match_id: matchId,
  move_number: n,
  action,
  row_index: row,
  column_index: col,
  received_at: start,
});

function fixture() {
  const match = {
    id: matchId,
    user_id: owner,
    status: "lost",
    rows: 16,
    columns: 16,
    mine_count: 40,
    move_count: 4,
    duration_ms: 10000,
    started_at: start,
    finished_at: end,
  };
  const state = {
    match_id: matchId,
    mine_positions: [...mines],
    revealed_positions: [...opened],
    flagged_positions: [],
    first_move_done: true,
  };
  const moves = [
    move(1, "reveal", 0, 0),
    move(2, "flag", 3, 0),
    move(3, "unflag", 3, 0),
    move(4, "reveal", 3, 1),
  ];
  const calls = [];
  const f = { match, state, moves, official: null, calls };
  f.store = {
    async match(id, uid) {
      calls.push(["match", id, uid]);
      return f.match;
    },
    async verifiedResult(id, uid) {
      calls.push(["official", id, uid]);
      return f.official;
    },
    async state(id) {
      calls.push(["state", id]);
      return f.state;
    },
    async moves(id, limit) {
      calls.push(["moves", id, limit]);
      return f.moves;
    },
  };
  // An explicit adapter fixture, not a substitute for the actual replay test.
  f.replay = (game) => {
    calls.push(["replay"]);
    return {
      rows: 16,
      columns: 16,
      status: "lost",
      frames: game.moves.map((_, i) => ({ actionNumber: i + 1, changed: true })),
      finalBoard: Array.from({ length: 256 }, (_, i) => ({
        revealed: opened.includes(i) || mines.includes(i),
        flagged: false,
      })),
    };
  };
  f.read = () => readCompletedRankedRecording(f.store, matchId, owner, f.replay);
  return f;
}

const invalid = { ok: false, status: 422 };
const missing = { ok: false, status: 404 };

test("only a complete loss is serialized, without private account or rating fields", async () => {
  const f = fixture();
  const result = await f.read();
  assert.equal(result.ok, true);
  assert.equal(result.data.source, "server-recorded-ranked");
  assert.equal(result.data.matchId, matchId);
  assert.equal(result.data.durationMs, 10000);
  assert.equal(result.data.recording.outcome, "loss");
  assert.deepEqual(result.data.recording.moves[2], { row: 3, col: 0, action: "unflag" });
  assert.deepEqual(Object.keys(result.data).sort(), [
    "completedAt",
    "durationMs",
    "matchId",
    "recording",
    "source",
  ]);
  assert.deepEqual(
    f.calls.map((entry) => entry[0]),
    ["match", "official", "state", "moves", "replay"],
  );
});

test("missing, foreign, active and abandoned matches never request a layout or replay", async () => {
  for (const change of [
    (f) => (f.match = null),
    (f) => (f.match.user_id = other),
    (f) => (f.match.id = other),
    (f) => (f.match.status = "active"),
    (f) => (f.match.status = "abandoned"),
  ]) {
    const f = fixture();
    change(f);
    assert.deepEqual(await f.read(), missing);
    assert.deepEqual(f.calls, [["match", matchId, owner]]);
  }
});

test("invalid match or owner UUID is rejected before a database lookup", async () => {
  const f = fixture();
  assert.equal(isRankedRecordingId("not-a-uuid"), false);
  assert.deepEqual(
    await readCompletedRankedRecording(f.store, "bad", owner, f.replay),
    missing,
  );
  assert.deepEqual(
    await readCompletedRankedRecording(f.store, matchId, "bad", f.replay),
    missing,
  );
  assert.deepEqual(f.calls, []);
});

test("oversized recordings and invalid match metadata fail before layout reads", async () => {
  for (const change of [
    (f) => (f.match.move_count = RANKED_COACHING_MAX_MOVES + 1),
    (f) => (f.match.move_count = 0),
    (f) => (f.match.rows = 9),
    (f) => (f.match.duration_ms = -1),
    (f) => (f.match.finished_at = null),
  ]) {
    const f = fixture();
    change(f);
    assert.deepEqual(await f.read(), invalid);
    assert.deepEqual(
      f.calls.map((entry) => entry[0]),
      ["match"],
    );
  }
});

test("a win without an exact owner-matched official result never reads the layout", async () => {
  const official = {
    match_id: matchId,
    user_id: owner,
    board_rows: 16,
    board_columns: 16,
    mine_count: 40,
    duration_ms: 10000,
    finished_at: end,
  };
  for (const value of [
    null,
    { ...official, user_id: other },
    { ...official, duration_ms: 9999 },
    { ...official, board_rows: 9 },
    { ...official, finished_at: start },
  ]) {
    const f = fixture();
    f.match.status = "won";
    f.official = value;
    assert.deepEqual(await f.read(), invalid);
    assert.deepEqual(
      f.calls.map((entry) => entry[0]),
      ["match", "official"],
    );
  }
});

test("a loss with an official victory record fails closed", async () => {
  const f = fixture();
  f.official = { match_id: matchId, user_id: owner };
  assert.deepEqual(await f.read(), invalid);
  assert.deepEqual(
    f.calls.map((entry) => entry[0]),
    ["match", "official"],
  );
});

test("missing, reordered, extra and malformed moves are rejected", async () => {
  for (const change of [
    (f) => f.moves.pop(),
    (f) => f.moves.push(move(5, "flag", 3, 2)),
    (f) => (f.moves[1].move_number = 1),
    (f) => (f.moves[1].match_id = other),
    (f) => (f.moves[1].action = "unknown"),
    (f) => (f.moves[1].row_index = 16),
    (f) => (f.moves[1].received_at = "invalid"),
    (f) => (f.moves[0].action = "flag"),
    (f) => (f.moves[0].row_index = 2),
  ]) {
    const f = fixture();
    change(f);
    assert.deepEqual(await f.read(), invalid);
    assert.ok(!f.calls.some((entry) => entry[0] === "replay"));
  }
});

test("wrong state ID, duplicate mines and inconsistent revealed or flagged cells fail closed", async () => {
  for (const change of [
    (f) => (f.state = null),
    (f) => (f.state.match_id = other),
    (f) => (f.state.first_move_done = false),
    (f) => (f.state.mine_positions[0] = f.state.mine_positions[1]),
    (f) => f.state.revealed_positions.push(48),
    (f) => f.state.flagged_positions.push(0),
    (f) => f.state.revealed_positions.pop(),
    (f) => f.state.flagged_positions.push(48),
  ]) {
    const f = fixture();
    change(f);
    assert.deepEqual(await f.read(), invalid);
  }
});

test("replay outcome mismatch, no-op actions and exceptions are rejected", async () => {
  for (const change of [
    (result) => (result.status = "won"),
    (result) => (result.frames[1].changed = false),
    (result) => result.frames.pop(),
    (result) => result.finalBoard.pop(),
  ]) {
    const f = fixture();
    const original = f.replay;
    f.replay = (game) => {
      const result = original(game);
      change(result);
      return result;
    };
    assert.deepEqual(await f.read(), invalid);
  }
  const f = fixture();
  f.replay = () => {
    throw new Error("Sensitive internal replay error");
  };
  assert.deepEqual(await f.read(), invalid);
});

test("database errors are distinguishable from bad recordings", async () => {
  const f = fixture();
  f.store.state = async () => {
    throw new Error("Database unavailable");
  };
  await assert.rejects(f.read(), /Database unavailable/);
});

test("database received_at is not treated as a monotonic gameplay timestamp", async () => {
  const f = fixture();
  f.moves[2].received_at = "2026-11-26T11:59:59.999Z";
  const result = await f.read();
  assert.equal(result.ok, true);
  assert.ok(result.data.recording.moves.every((move) => move.atMs === undefined));
});

test("route uses verified claims, live session guard, rate limit and owner-terminal filtering", () => {
  const route = readFileSync("app/api/ranked/coaching/recording/route.ts", "utf8");
  assert.match(route, /client\.auth\.getClaims\(\)/);
  assert.match(route, /readVerifiedRankedSessionId\(data\?\.claims\)/);
  assert.match(route, /"ranked_session_is_active"/);
  assert.ok(
    route.indexOf("if (active !== true)") <
      route.indexOf("await readCompletedRankedRecording"),
  );
  assert.ok(
    route.indexOf("await guardRankedRateLimit") <
      route.indexOf("await readCompletedRankedRecording"),
  );
  assert.match(route, /\.eq\("user_id", owner\)\s*\.in\("status", \["won", "lost"\]\)/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.match(route, /count: "exact"/);
  assert.match(route, /count === limit \? data : null/);
  assert.match(route, /replayRecordedGame/);
  assert.doesNotMatch(
    route,
    /request\.json\(|\.insert\(|\.update\(|\.delete\(|export async function POST/,
  );
});
