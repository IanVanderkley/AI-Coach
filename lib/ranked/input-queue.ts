export type RankedMoveIntent = {
  matchId: string;
  row: number;
  column: number;
  action: "reveal" | "flag" | "chord";
};

type Position = { row: number; column: number };
type VisibleBoard = {
  matchId: string;
  status: "active" | "won" | "lost";
  rows: number;
  columns: number;
  firstMoveDone: boolean;
  revealedCells: (Position & { adjacentMines: number })[];
  flaggedCells: Position[];
};

// Bound the delay between an intentional input and its eventual execution.
export const MAX_QUEUED_RANKED_MOVES = 3;

export function sameRankedSquare(a: RankedMoveIntent, b: RankedMoveIntent): boolean {
  return a.matchId === b.matchId && a.row === b.row && a.column === b.column;
}

export function appendRankedIntent(
  queue: readonly RankedMoveIntent[],
  intent: RankedMoveIntent,
  active: RankedMoveIntent | null,
): readonly RankedMoveIntent[] {
  if (
    queue.length >= MAX_QUEUED_RANKED_MOVES ||
    (active && sameRankedSquare(active, intent)) ||
    queue.some((move) => sameRankedSquare(move, intent))
  )
    return queue;
  return [...queue, intent];
}

// Revalidate the original action against the latest *confirmed* visible state.
// Never reinterpret a queued reveal as a chord or guess hidden mine locations.
export function canDispatchRankedIntent(
  board: VisibleBoard,
  intent: RankedMoveIntent,
): boolean {
  if (
    board.matchId !== intent.matchId ||
    board.status !== "active" ||
    !Number.isInteger(intent.row) ||
    !Number.isInteger(intent.column) ||
    intent.row < 0 ||
    intent.row >= board.rows ||
    intent.column < 0 ||
    intent.column >= board.columns
  )
    return false;
  const at = (cell: Position) => cell.row === intent.row && cell.column === intent.column;
  const revealed = board.revealedCells.find(at);
  const flagged = board.flaggedCells.some(at);
  if (intent.action === "reveal") return !revealed && !flagged;
  if (intent.action === "flag") return board.firstMoveDone && !revealed;
  if (!revealed || revealed.adjacentMines <= 0) return false;
  let flags = 0;
  let hidden = false;
  for (
    let row = Math.max(0, intent.row - 1);
    row <= Math.min(board.rows - 1, intent.row + 1);
    row++
  ) {
    for (
      let column = Math.max(0, intent.column - 1);
      column <= Math.min(board.columns - 1, intent.column + 1);
      column++
    ) {
      if (row === intent.row && column === intent.column) continue;
      const neighbor = (cell: Position) => cell.row === row && cell.column === column;
      if (board.flaggedCells.some(neighbor)) flags++;
      else if (!board.revealedCells.some(neighbor)) hidden = true;
    }
  }
  return flags === revealed.adjacentMines && hidden;
}

export function takeRankedIntent(
  queue: readonly RankedMoveIntent[],
  board: VisibleBoard,
): {
  next: RankedMoveIntent | null;
  remaining: readonly RankedMoveIntent[];
} {
  const index = queue.findIndex((intent) => canDispatchRankedIntent(board, intent));
  return index < 0
    ? { next: null, remaining: [] }
    : { next: queue[index], remaining: queue.slice(index + 1) };
}
