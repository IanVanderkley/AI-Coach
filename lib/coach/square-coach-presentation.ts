import type { SquareAnalysis } from "./square-analysis.ts";
import type { TeachingGroup, VisibleCell } from "./verified-replay.ts";

const quantity = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
export function relativeSquare(from: number, to: number, columns: number): string {
  const dr = Math.floor(to / columns) - Math.floor(from / columns);
  const dc = (to % columns) - (from % columns);
  if (!dr && !dc) return "at this square";
  const vertical = dr < 0 ? "up" : "down";
  const horizontal = dc < 0 ? "left" : "right";
  if (Math.abs(dr) <= 1 && Math.abs(dc) <= 1) {
    return dr && dc
      ? `${vertical}-${horizontal}`
      : dr
        ? dr < 0
          ? "directly above"
          : "directly below"
        : `directly to the ${horizontal}`;
  }
  return [
    dr ? `${quantity(Math.abs(dr), "row")} ${vertical}` : "",
    dc ? `${quantity(Math.abs(dc), "column")} ${horizontal}` : "",
  ]
    .filter(Boolean)
    .join(" and ");
}

export function localSquareBounds(index: number, rows: number, columns: number) {
  const row = Math.floor(index / columns),
    col = index % columns;
  return {
    top: Math.max(0, row - 2),
    bottom: Math.min(rows - 1, row + 2),
    left: Math.max(0, col - 2),
    right: Math.min(columns - 1, col + 2),
  };
}

export function replayCellGlyph(cell: VisibleCell): string {
  if (cell.exploded || (cell.revealed && cell.adjacentMines === null)) return "✹";
  if (cell.flagged) return "⚑";
  return cell.revealed && cell.adjacentMines ? String(cell.adjacentMines) : "";
}

const groupName = (g: TeachingGroup, index: number, columns: number) =>
  g.clue === null
    ? "the board's total mine count"
    : `the ${g.originalCount === 0 ? "empty (0) clue" : g.originalCount} ${relativeSquare(index, g.clue, columns)}`;

/** Explain the final recorded derivation first; prerequisites remain available in order. */
export function describeSquareCoach(analysis: SquareAnalysis, index: number) {
  const { classification, explanation, summary } = analysis;
  const { steps, columns } = explanation;
  const visual = steps.at(-1)?.visual;
  if (!visual || !visual.result.includes(index))
    return { text: summary, clues: [] as number[], prerequisite: "" };
  const [a, b] = visual.groups;
  if (!a) return { text: summary, clues: [] as number[], prerequisite: "" };
  const safe = classification === "proven-safe";
  const result = safe
    ? "So your selected square cannot contain a mine."
    : "So your selected square must contain a mine.";
  const name = groupName(a, index, columns);
  const describeRemaining = (g: TeachingGroup) =>
    `${g.remainingMines} ${g.remainingMines === 1 ? "mine" : "mines"} in ${quantity(g.cells.length, "still-unresolved square")}`;
  let text: string;
  if (b) {
    const other = groupName(b, index, columns);
    text = `Compare ${name} with ${other}. After accounting for earlier deductions, the first group needs ${describeRemaining(a)}, and the second needs ${describeRemaining(b)}. Every unresolved square in the first group is also in the second. Subtract ${a.remainingMines} from ${b.remainingMines}: that leaves ${quantity(visual.mineCount, "mine")} in ${quantity(visual.result.length, "extra square")}, including this one. ${result}`;
  } else {
    const known = a.knownMines.length;
    const positions =
      a.knownMines.length <= 3
        ? a.knownMines.map((i) => relativeSquare(index, i, columns)).join(", ")
        : "";
    const accounted = known
      ? ` Earlier deductions have already proven ${quantity(known, "mine")}${positions ? ` (${positions})` : ""}.`
      : "";
    const excluded = a.knownSafe.length
      ? ` We can also rule out ${quantity(a.knownSafe.length, "covered square")} already proven safe.`
      : "";
    text = `Look at ${name}. It accounts for ${quantity(a.originalCount, "mine")}${a.clue === null ? " on the board" : " touching that clue"}.${accounted}${excluded} ${safe ? "No mines remain" : `Exactly ${quantity(a.remainingMines, "mine")} remain${a.remainingMines === 1 ? "s" : ""}`} in ${quantity(a.cells.length, "unresolved square")}${safe ? ", including yours" : "; every one must contain a mine"}. ${result}`;
  }
  const clues = [
    ...new Set(visual.groups.flatMap((g) => (g.clue === null ? [] : [g.clue]))),
  ];
  const prerequisite =
    steps.length > 1
      ? "This conclusion depends on earlier deductions. Open the full proof to see how those facts were established, in order."
      : "";
  return { text, clues, prerequisite };
}
