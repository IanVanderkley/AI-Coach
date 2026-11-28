import type { VisibleCell } from "./verified-replay.ts";

/** Text alternative to the read-only board, using only displayed information. */
export function describeReplayRows(
  cells: readonly VisibleCell[],
  columns: number,
  selected: number,
  safe: ReadonlySet<number>,
  mines: ReadonlySet<number>,
  clues: ReadonlySet<number>,
  recommendation?: number | null,
  inspected?: number,
  nearby: ReadonlySet<number> = new Set(),
): string[] {
  if (!Number.isSafeInteger(columns) || columns < 1 || cells.length % columns !== 0)
    return [];
  return Array.from({ length: cells.length / columns }, (_, row) => {
    const parts = cells.slice(row * columns, (row + 1) * columns).map((cell, col) => {
      const index = row * columns + col;
      const facts = [
        cell.exploded
          ? "exploded mine"
          : cell.revealed
            ? cell.adjacentMines === null
              ? "revealed mine"
              : `revealed ${cell.adjacentMines}`
            : cell.flagged
              ? "player flag"
              : "covered",
      ];
      if (!cell.revealed && safe.has(index)) facts.push("proven safe");
      if (!cell.revealed && mines.has(index)) facts.push("proven mine");
      if (clues.has(index)) facts.push("supporting clue");
      if (index === selected) facts.push("selected square");
      if (index === inspected) facts.push("inspected square");
      if (nearby.has(index)) facts.push("nearby clue");
      if (index === recommendation && safe.has(index)) facts.push("suggested reveal");
      return `C${col + 1}: ${facts.join(", ")}`;
    });
    return `Row ${row + 1}: ${parts.join("; ")}.`;
  });
}

/** Navigate within a rectangular board without wrapping across row boundaries. */
export function replayKeyboardIndex(
  index: number,
  columns: number,
  count: number,
  key: string,
): number | null {
  if (
    !Number.isSafeInteger(columns) ||
    columns < 1 ||
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count % columns !== 0 ||
    !Number.isSafeInteger(index) ||
    index < 0 ||
    index >= count
  )
    return null;
  const col = index % columns;
  switch (key) {
    case "ArrowLeft":
      return col > 0 ? index - 1 : index;
    case "ArrowRight":
      return col < columns - 1 ? index + 1 : index;
    case "ArrowUp":
      return index >= columns ? index - columns : index;
    case "ArrowDown":
      return index + columns < count ? index + columns : index;
    case "Home":
      return index - col;
    case "End":
      return index - col + columns - 1;
    default:
      return null;
  }
}

/** Context only: revealed, positive numbered neighbors in this visible snapshot. */
export function nearbyReplayClues(
  cells: readonly VisibleCell[],
  columns: number,
  index: number,
): number[] {
  if (
    !Number.isSafeInteger(columns) ||
    columns < 1 ||
    cells.length % columns !== 0 ||
    !Number.isSafeInteger(index) ||
    index < 0 ||
    index >= cells.length
  )
    return [];
  const row = Math.floor(index / columns),
    col = index % columns;
  const result: number[] = [];
  for (
    let r = Math.max(0, row - 1);
    r <= Math.min(cells.length / columns - 1, row + 1);
    r++
  ) {
    for (let c = Math.max(0, col - 1); c <= Math.min(columns - 1, col + 1); c++) {
      const n = r * columns + c;
      const cell = cells[n];
      if (
        n !== index &&
        cell.revealed &&
        !cell.exploded &&
        cell.adjacentMines !== null &&
        cell.adjacentMines > 0
      )
        result.push(n);
    }
  }
  return result;
}
