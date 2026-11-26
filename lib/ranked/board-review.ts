// A presentation-only snapshot created from a successful terminal move response.
// Never send this data back to a move endpoint or persist it in browser storage.
export type ReviewPosition = { row: number; column: number };
type VisibleCell = ReviewPosition & { adjacentMines: number };
type PreviousBoard = {
  matchId: string;
  status: "active" | "won" | "lost";
  moveCount: number;
  rows: number;
  columns: number;
  mineCount: number;
};
export type RankedBoardReview = {
  rows: number;
  columns: number;
  mines: ReadonlySet<number>;
  revealed: ReadonlySet<number>;
  hit: number | null;
};

function positionIndex(value: unknown, rows: number, columns: number): number | null {
  if (!value || typeof value !== "object") return null;
  const { row, column } = value as Partial<ReviewPosition>;
  if (
    typeof row !== "number" ||
    !Number.isInteger(row) ||
    row < 0 ||
    row >= rows ||
    typeof column !== "number" ||
    !Number.isInteger(column) ||
    column < 0 ||
    column >= columns
  )
    return null;
  return row * columns + column;
}

function adjacentMines(
  mines: ReadonlySet<number>,
  rows: number,
  columns: number,
  index: number,
) {
  const row = Math.floor(index / columns);
  const column = index % columns;
  let count = 0;
  for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
    for (let c = Math.max(0, column - 1); c <= Math.min(columns - 1, column + 1); c++) {
      if ((r !== row || c !== column) && mines.has(r * columns + c)) count++;
    }
  }
  return count;
}

export function buildRankedBoardReview(
  previous: PreviousBoard,
  response: unknown,
  visibleCells: readonly VisibleCell[],
): RankedBoardReview | null {
  if (previous.status !== "active" || !response || typeof response !== "object")
    return null;
  const result = response as Record<string, unknown>;
  if (
    result.matchId !== previous.matchId ||
    result.moveCount !== previous.moveCount + 1 ||
    (result.status !== "won" && result.status !== "lost")
  )
    return null;
  const { rows, columns, mineCount } = previous;
  // Only the supported Ranked board is accepted. Expand with future ladders.
  if (rows !== 16 || columns !== 16 || mineCount !== 40) return null;
  const total = rows * columns;
  const revealed = new Map<number, number>();
  for (const cell of visibleCells) {
    const index = positionIndex(cell, rows, columns);
    if (
      index === null ||
      revealed.has(index) ||
      !Number.isInteger(cell.adjacentMines) ||
      cell.adjacentMines < 0 ||
      cell.adjacentMines > 8
    )
      return null;
    revealed.set(index, cell.adjacentMines);
  }
  const mines = new Set<number>();
  let hit: number | null = null;
  if (result.status === "lost") {
    if (!Array.isArray(result.minePositions) || result.minePositions.length !== mineCount)
      return null;
    for (const mine of result.minePositions) {
      if (
        typeof mine !== "number" ||
        !Number.isInteger(mine) ||
        mine < 0 ||
        mine >= total ||
        mines.has(mine) ||
        revealed.has(mine)
      )
        return null;
      mines.add(mine);
    }
    hit = positionIndex(result.hitMine, rows, columns);
    if (hit === null || !mines.has(hit) || revealed.size >= total - mineCount)
      return null;
  } else {
    // Server-confirmed victory means every safe square has been revealed.
    // Do not infer mines on incomplete or inconsistent victory snapshots.
    if (revealed.size !== total - mineCount) return null;
    for (let index = 0; index < total; index++) {
      if (!revealed.has(index)) mines.add(index);
    }
  }
  for (const [index, number] of revealed) {
    if (adjacentMines(mines, rows, columns, index) !== number) return null;
  }
  return { rows, columns, mines, revealed: new Set(revealed.keys()), hit };
}

export function reviewRankedCell(
  review: RankedBoardReview,
  index: number,
  flagged: boolean,
) {
  const mine = review.mines.has(index);
  const number = mine
    ? null
    : adjacentMines(review.mines, review.rows, review.columns, index);
  const kind =
    index === review.hit
      ? "hit"
      : flagged
        ? mine
          ? "correct-flag"
          : "wrong-flag"
        : mine
          ? "mine"
          : review.revealed.has(index)
            ? "opened"
            : "unopened";
  return { kind, number } as const;
}
