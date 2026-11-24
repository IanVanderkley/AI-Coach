// Server-confirmed Ranked outcomes only. Never infer rewards from the UI.
export type RankedResultBoard = {
  matchId: string;
  status: "active" | "won" | "lost";
  moveCount: number;
  flagCount: number;
  rows: number;
  columns: number;
  mineCount: number;
  durationMs?: number | null;
};

export type RankedResultSummary = {
  matchId: string;
  outcome: "won" | "lost";
  moveCount: number;
  flagCount: number;
  rows: number;
  columns: number;
  mineCount: number;
  durationMs: number | null;
};

export function buildRankedResult(
  board: RankedResultBoard | null,
  dismissedMatchId: string | null,
): RankedResultSummary | null {
  if (!board || board.status === "active" || board.matchId === dismissedMatchId) {
    return null;
  }
  return {
    matchId: board.matchId,
    outcome: board.status,
    moveCount: board.moveCount,
    flagCount: board.flagCount,
    rows: board.rows,
    columns: board.columns,
    mineCount: board.mineCount,
    durationMs:
      typeof board.durationMs === "number" &&
      Number.isSafeInteger(board.durationMs) &&
      board.durationMs >= 0
        ? board.durationMs
        : null,
  };
}

export function formatRankedDuration(milliseconds: number | null): string {
  if (milliseconds === null || !Number.isSafeInteger(milliseconds) || milliseconds < 0) {
    return "—";
  }
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hundredths = Math.floor((milliseconds % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}
