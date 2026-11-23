import type { GameplayMove } from "../coach/types";
import { visibleBoardHash } from "../coach/visible-board-hash.ts";
import {
  DIFFICULTY_SETTINGS,
  type Difficulty,
  type DifficultySettings,
} from "../game-settings.ts";

/**
 * Unfinished Practice games are local to this browser, never Ranked-verified.
 * Save one per difficulty so a difficulty switch cannot erase another board.
 * Never sync hidden mine positions or an unfinished board to Supabase.
 */
export const PRACTICE_RECOVERY_PREFIX = "ai-coach:practice-recovery:v1:";
export const PRACTICE_RECOVERY_VERSION = 1;

export type RecoveryCell = {
  mine: boolean;
  adjacentMines: number;
  revealed: boolean;
  flagged: boolean;
};

export type PracticeRecoverySnapshot = {
  version: 1;
  difficulty: Difficulty;
  board: RecoveryCell[][];
  status: "ready" | "playing";
  firstClick: boolean;
  inputMode: "reveal" | "flag";
  paused: boolean;
  elapsedMs: number;
  mines: number[];
  moves: GameplayMove[];
  updatedAt: number;
};

type RecoveryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function validInt(n: unknown, max: number): n is number {
  return typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= max;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function difficultyOf(settings: DifficultySettings): Difficulty | null {
  for (const difficulty of ["beginner", "intermediate", "expert"] as const) {
    const canonical = DIFFICULTY_SETTINGS[difficulty];
    if (
      settings.label === canonical.label &&
      settings.rows === canonical.rows &&
      settings.columns === canonical.columns &&
      settings.mines === canonical.mines
    ) {
      return difficulty;
    }
  }
  return null;
}

export function practiceRecoveryKey(settings: DifficultySettings): string | null {
  const difficulty = difficultyOf(settings);
  return difficulty ? PRACTICE_RECOVERY_PREFIX + difficulty : null;
}

/** Reject stale, malformed, finished or inconsistent recordings. */
export function parsePracticeRecovery(
  value: unknown,
  settings: DifficultySettings,
): PracticeRecoverySnapshot | null {
  if (!record(value)) return null;
  const difficulty = difficultyOf(settings);
  if (
    !difficulty ||
    value.version !== PRACTICE_RECOVERY_VERSION ||
    value.difficulty !== difficulty ||
    (value.status !== "ready" && value.status !== "playing") ||
    typeof value.firstClick !== "boolean" ||
    (value.inputMode !== "reveal" && value.inputMode !== "flag") ||
    typeof value.paused !== "boolean" ||
    !validInt(value.elapsedMs, 86_400_000) ||
    !validInt(value.updatedAt, Number.MAX_SAFE_INTEGER) ||
    !Array.isArray(value.board) ||
    value.board.length !== settings.rows ||
    !Array.isArray(value.mines) ||
    !Array.isArray(value.moves) ||
    value.moves.length === 0 ||
    value.moves.length > 5000
  ) {
    return null;
  }

  const rows = settings.rows;
  const columns = settings.columns;
  const expectedMines = settings.mines;
  const mined = new Set<number>();
  for (const index of value.mines) {
    if (!validInt(index, rows * columns - 1) || mined.has(index)) return null;
    mined.add(index);
  }
  if (value.firstClick ? mined.size !== 0 : mined.size !== expectedMines) return null;
  if (value.firstClick && value.status !== "ready") return null;
  if (!value.firstClick && value.status !== "playing") return null;

  const board: RecoveryCell[][] = [];
  let flagCount = 0;
  let revealedSafe = 0;
  for (let r = 0; r < rows; r++) {
    const line = value.board[r];
    if (!Array.isArray(line) || line.length !== columns) return null;
    const parsedLine: RecoveryCell[] = [];
    for (let c = 0; c < columns; c++) {
      const cell = line[c];
      if (
        !record(cell) ||
        typeof cell.mine !== "boolean" ||
        typeof cell.revealed !== "boolean" ||
        typeof cell.flagged !== "boolean" ||
        !validInt(cell.adjacentMines, 8) ||
        (cell.revealed && cell.flagged)
      )
        return null;
      const index = r * columns + c;
      if (cell.mine !== mined.has(index) || (cell.mine && cell.revealed)) return null;
      let adjacent = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (
            nr >= 0 &&
            nr < rows &&
            nc >= 0 &&
            nc < columns &&
            mined.has(nr * columns + nc)
          )
            adjacent++;
        }
      }
      if (cell.adjacentMines !== adjacent) return null;
      if (cell.flagged) flagCount++;
      if (cell.revealed) revealedSafe++;
      parsedLine.push({
        mine: cell.mine,
        adjacentMines: cell.adjacentMines,
        revealed: cell.revealed,
        flagged: cell.flagged,
      });
    }
    board.push(parsedLine);
  }
  if (flagCount > expectedMines) return null;
  if (value.firstClick && revealedSafe !== 0) return null;
  if (
    !value.firstClick &&
    (revealedSafe === 0 || revealedSafe >= rows * columns - expectedMines)
  )
    return null;

  const moves: GameplayMove[] = [];
  let previousAtMs = -1;
  for (const entry of value.moves) {
    if (
      !record(entry) ||
      !validInt(entry.row, rows - 1) ||
      !validInt(entry.col, columns - 1) ||
      !["reveal", "flag", "unflag", "chord"].includes(String(entry.action)) ||
      !validInt(entry.atMs, 86_400_000) ||
      entry.atMs < previousAtMs ||
      typeof entry.afterHash !== "string" ||
      !/^[0-9a-f]{8}$/.test(entry.afterHash)
    )
      return null;
    if (value.firstClick && (entry.action === "reveal" || entry.action === "chord"))
      return null;
    previousAtMs = entry.atMs;
    moves.push({
      row: entry.row,
      col: entry.col,
      action: entry.action as GameplayMove["action"],
      atMs: entry.atMs,
      afterHash: entry.afterHash,
    });
  }
  if (previousAtMs > value.elapsedMs + 1000) return null;
  if (moves[moves.length - 1].afterHash !== visibleBoardHash(board)) return null;

  return {
    version: 1,
    difficulty,
    board,
    status: value.status as "ready" | "playing",
    firstClick: value.firstClick,
    inputMode: value.inputMode as "reveal" | "flag",
    paused: value.paused,
    elapsedMs: value.elapsedMs,
    mines: [...mined],
    moves,
    updatedAt: value.updatedAt,
  };
}

export function readPracticeRecovery(
  storage: RecoveryStorage | null,
  settings: DifficultySettings,
): PracticeRecoverySnapshot | null {
  const key = practiceRecoveryKey(settings);
  if (!key || !storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const snapshot = parsePracticeRecovery(parsed, settings);
    if (snapshot) return snapshot;
    storage.removeItem(key);
  } catch {
    // Disabled storage or invalid JSON must not make the game unplayable.
    try {
      storage.removeItem(key);
    } catch {
      /* Storage blocked */
    }
  }
  return null;
}

export function savePracticeRecovery(
  storage: RecoveryStorage | null,
  settings: DifficultySettings,
  snapshot: PracticeRecoverySnapshot,
): boolean {
  const key = practiceRecoveryKey(settings);
  if (!key || !storage) return false;
  if (!parsePracticeRecovery(snapshot, settings)) return false;
  try {
    storage.setItem(key, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function clearPracticeRecovery(
  storage: RecoveryStorage | null,
  settings: DifficultySettings,
): void {
  const key = practiceRecoveryKey(settings);
  if (!key || !storage) return;
  try {
    storage.removeItem(key);
  } catch {
    /* Storage blocked */
  }
}
