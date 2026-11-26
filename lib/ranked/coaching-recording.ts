import type { GameplayMove } from "../coach/types.ts";
import type { RecordedGame, ReplayResult } from "../coach/verified-replay.ts";
import type { PracticeSession } from "../practice/history.ts";

// A bounded first release: never silently truncate a recording or expose an
// unchecked layout. The PostgREST default row cap is 1,000.
export const RANKED_COACHING_MAX_MOVES = 1000;
const ROWS = 16;
const COLUMNS = 16;
const MINE_COUNT = 40;
const TOTAL = ROWS * COLUMNS;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isRankedRecordingId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export type CompletedRankedRecording = {
  source: "server-recorded-ranked";
  matchId: string;
  completedAt: string;
  durationMs: number;
  recording: PracticeSession;
};

type RecordingResult =
  | { ok: true; data: CompletedRankedRecording }
  | { ok: false; status: 404 | 422 };

export type RankedRecordingStore = {
  match: (matchId: string, userId: string) => Promise<unknown>;
  verifiedResult: (matchId: string, userId: string) => Promise<unknown>;
  state: (matchId: string) => Promise<unknown>;
  moves: (matchId: string, limit: number) => Promise<unknown>;
};

type Replay = (game: RecordedGame) => ReplayResult;

function asRow(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requireRow(value: unknown): Record<string, unknown> {
  const row = asRow(value);
  if (!row) throw new Error("Invalid recording row.");
  return row;
}

function integer(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= min &&
    value <= max
  );
}

function timestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function positions(value: unknown, max: number, exact = false): number[] {
  if (
    !Array.isArray(value) ||
    value.length > max ||
    (exact && value.length !== max) ||
    !value.every((item) => integer(item, 0, TOTAL - 1)) ||
    new Set(value).size !== value.length
  ) {
    throw new Error("Invalid recording positions.");
  }
  return [...value];
}

function samePositions(a: readonly number[], b: readonly number[]): boolean {
  const set = new Set(a);
  return a.length === b.length && b.every((index) => set.has(index));
}

/** Only the server route supplies this store. No browser recording is accepted.
 * Check ownership, terminal status and the official win before reading any layout.
 * Database errors propagate to the route; integrity failures return a generic 422.
 */
export async function readCompletedRankedRecording(
  store: RankedRecordingStore,
  matchId: string,
  userId: string,
  replay: Replay,
): Promise<RecordingResult> {
  const unavailable = { ok: false, status: 404 } as const;
  const invalid = { ok: false, status: 422 } as const;
  if (!isRankedRecordingId(matchId) || !isRankedRecordingId(userId)) return unavailable;
  const match = asRow(await store.match(matchId, userId));
  if (
    !match ||
    match.id !== matchId ||
    match.user_id !== userId ||
    (match.status !== "won" && match.status !== "lost")
  ) {
    return unavailable;
  }
  if (
    match.rows !== ROWS ||
    match.columns !== COLUMNS ||
    match.mine_count !== MINE_COUNT ||
    !integer(match.move_count, 1, RANKED_COACHING_MAX_MOVES) ||
    !integer(match.duration_ms, 0, Number.MAX_SAFE_INTEGER) ||
    !timestamp(match.started_at) ||
    !timestamp(match.finished_at) ||
    Date.parse(match.finished_at) < Date.parse(match.started_at)
  ) {
    return invalid;
  }

  const official = await store.verifiedResult(matchId, userId);
  if (match.status === "won") {
    const win = asRow(official);
    if (
      !win ||
      win.match_id !== matchId ||
      win.user_id !== userId ||
      win.board_rows !== ROWS ||
      win.board_columns !== COLUMNS ||
      win.mine_count !== MINE_COUNT ||
      win.duration_ms !== match.duration_ms ||
      !timestamp(win.finished_at) ||
      Date.parse(win.finished_at) !== Date.parse(match.finished_at)
    ) {
      return invalid;
    }
  } else if (official !== null) {
    return invalid;
  }

  // A terminal match cannot receive further gameplay moves. Still recheck the
  // related IDs, complete revision sequence and final state before returning it.
  const [rawState, rawMoves] = await Promise.all([
    store.state(matchId),
    store.moves(matchId, match.move_count),
  ]);
  try {
    const state = requireRow(rawState);
    if (state.match_id !== matchId || state.first_move_done !== true) return invalid;
    const mines = positions(state.mine_positions, MINE_COUNT, true);
    const revealed = positions(state.revealed_positions, TOTAL - MINE_COUNT);
    const flagged = positions(state.flagged_positions, MINE_COUNT);
    const hidden = new Set(mines);
    const opened = new Set(revealed);
    if (revealed.some((i) => hidden.has(i)) || flagged.some((i) => opened.has(i))) {
      return invalid;
    }
    if (!Array.isArray(rawMoves) || rawMoves.length !== match.move_count) return invalid;
    const moves: GameplayMove[] = rawMoves.map((raw, index) => {
      const move = requireRow(raw);
      if (
        move.match_id !== matchId ||
        move.move_number !== index + 1 ||
        !integer(move.row_index, 0, ROWS - 1) ||
        !integer(move.column_index, 0, COLUMNS - 1) ||
        (move.action !== "reveal" &&
          move.action !== "flag" &&
          move.action !== "unflag" &&
          move.action !== "chord") ||
        !timestamp(move.received_at)
      ) {
        throw new Error("Invalid Ranked move.");
      }
      // received_at is a database transaction timestamp, not a monotonic
      // player clock. The committed move_number is the authoritative order.
      return { row: move.row_index, col: move.column_index, action: move.action };
    });
    const first = moves[0];
    if (
      first.action !== "reveal" ||
      mines.some(
        (i) =>
          Math.abs(Math.floor(i / COLUMNS) - first.row) <= 1 &&
          Math.abs((i % COLUMNS) - first.col) <= 1,
      )
    ) {
      return invalid;
    }
    const recording: PracticeSession = {
      game: "minesweeper",
      difficulty: "Intermediate",
      rows: ROWS,
      columns: COLUMNS,
      mineCount: MINE_COUNT,
      outcome: match.status === "won" ? "win" : "loss",
      durationSeconds: Math.floor(match.duration_ms / 1000),
      mines,
      moves,
    };
    const result = replay(recording);
    if (
      result.status !== match.status ||
      result.rows !== ROWS ||
      result.columns !== COLUMNS ||
      result.frames.length !== moves.length ||
      result.frames.some(
        (frame, index) => !frame.changed || frame.actionNumber !== index + 1,
      ) ||
      result.finalBoard.length !== TOTAL
    ) {
      return invalid;
    }
    // The replay shows all mines after a loss; SQL retains only safe reveals.
    // Flags remain recorded even on mines displayed by the terminal replay.
    const replayRevealed: number[] = [];
    const replayFlagged: number[] = [];
    result.finalBoard.forEach((cell, index) => {
      if (cell.revealed && !hidden.has(index)) replayRevealed.push(index);
      if (cell.flagged) replayFlagged.push(index);
    });
    if (
      !samePositions(revealed, replayRevealed) ||
      !samePositions(flagged, replayFlagged)
    ) {
      return invalid;
    }
    return {
      ok: true,
      data: {
        source: "server-recorded-ranked",
        matchId,
        completedAt: match.finished_at,
        durationMs: match.duration_ms,
        recording,
      },
    };
  } catch {
    return invalid;
  }
}
