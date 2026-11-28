type FlagBudget = {
  status: "active" | "won" | "lost";
  flagCount: number;
  mineCount: number;
  flaggedCells: readonly { row: number; column: number }[];
};

// Presentation/dispatch guard only; the server still owns the board and enforces its cap.
export function isRankedFlagLimitReached(board: FlagBudget): boolean {
  return board.status === "active" && board.flagCount >= board.mineCount;
}

export function blocksRankedFlagPlacement(
  board: FlagBudget,
  row: number,
  column: number,
): boolean {
  return (
    isRankedFlagLimitReached(board) &&
    !board.flaggedCells.some((cell) => cell.row === row && cell.column === column)
  );
}
