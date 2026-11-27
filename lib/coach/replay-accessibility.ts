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
      if (index === recommendation && safe.has(index)) facts.push("suggested reveal");
      return `C${col + 1}: ${facts.join(", ")}`;
    });
    return `Row ${row + 1}: ${parts.join("; ")}.`;
  });
}
