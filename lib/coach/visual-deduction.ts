import type { ProofVisual, TeachingGroup } from "./verified-replay.ts";
import type { SquareAnalysis } from "./square-analysis.ts";
import { localSquareBounds, relativeSquare } from "./square-coach-presentation.ts";

export type VisualRole =
  | "clue-a"
  | "clue-b"
  | "group-a"
  | "extra"
  | "known-mine"
  | "known-safe"
  | "safe"
  | "mine";
export type VisualPhase = {
  title: string;
  text: string;
  marks: ReadonlyMap<number, VisualRole>;
  equation?: string;
};
const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
function clueName(group: TeachingGroup, index: number, columns: number) {
  if (group.clue === null) return "the board's total mine count";
  return `the ${group.originalCount === 0 ? "empty (0)" : group.originalCount} clue ${relativeSquare(index, group.clue, columns)}`;
}

/** Presentation only: consume the solver's final derivation, never infer a new proof. */
export function buildVisualLesson(analysis: SquareAnalysis, index: number) {
  const { explanation, classification } = analysis;
  const { board, columns, steps } = explanation;
  const visual: ProofVisual | undefined = steps.at(-1)?.visual;
  if (
    !visual ||
    !visual.result.includes(index) ||
    !["proven-safe", "proven-mine"].includes(classification)
  )
    return null;
  const [a, b] = visual.groups;
  if (!a || visual.groups.length > 2 || !visual.result.length) return null;
  const safe = classification === "proven-safe";
  if (visual.mineCount !== (safe ? 0 : visual.result.length)) return null;
  const extra = b ? b.cells.filter((i) => !a.cells.includes(i)) : a.cells;
  const result = new Set(visual.result);
  if (
    result.size !== visual.result.length ||
    extra.length !== result.size ||
    !extra.every((i) => result.has(i))
  )
    return null;
  if (
    b &&
    (!a.cells.every((i) => b.cells.includes(i)) ||
      b.remainingMines - a.remainingMines !== visual.mineCount)
  )
    return null;
  if (!b && a.remainingMines !== visual.mineCount) return null;
  const indices = new Set<number>([index]);
  for (const g of visual.groups) {
    if (
      g.originalCount - g.knownMines.length !== g.remainingMines ||
      g.remainingMines < 0 ||
      g.remainingMines > g.cells.length
    )
      return null;
    for (const i of [...g.cells, ...g.knownMines, ...g.knownSafe]) {
      if (!Number.isInteger(i) || !board[i] || board[i].revealed) return null;
      indices.add(i);
    }
    if (g.clue !== null) {
      if (
        !board[g.clue]?.revealed ||
        board[g.clue].exploded ||
        board[g.clue].adjacentMines !== g.originalCount
      )
        return null;
      indices.add(g.clue);
    }
  }
  const bounds = localSquareBounds(index, board.length / columns, columns);
  for (const i of indices) {
    const r = Math.floor(i / columns),
      c = i % columns;
    bounds.top = Math.min(bounds.top, r);
    bounds.bottom = Math.max(bounds.bottom, r);
    bounds.left = Math.min(bounds.left, c);
    bounds.right = Math.max(bounds.right, c);
  }
  const marks = (
    includeB: boolean,
    conclude: boolean,
  ): ReadonlyMap<number, VisualRole> => {
    const map = new Map<number, VisualRole>();
    for (const g of includeB && b ? [a, b] : [a]) {
      for (const i of g.knownMines) map.set(i, "known-mine");
      for (const i of g.knownSafe) map.set(i, "known-safe");
    }
    if (includeB && b) for (const i of extra) map.set(i, "extra");
    for (const i of a.cells) map.set(i, "group-a");
    if (conclude) for (const i of visual.result) map.set(i, safe ? "safe" : "mine");
    if (a.clue !== null) map.set(a.clue, "clue-a");
    if (includeB && b && b.clue !== null) map.set(b.clue, "clue-b");
    return map;
  };
  const remaining = (g: TeachingGroup) =>
    `${count(g.remainingMines, "mine")} in ${count(g.cells.length, "covered square")}`;
  const earlier = (g: TeachingGroup) =>
    g.knownMines.length || g.knownSafe.length
      ? ` Earlier steps already proved ${count(g.knownMines.length, "mine")} and ${count(g.knownSafe.length, "covered safe square")} in this group.`
      : "";
  const phases: VisualPhase[] = [
    {
      title: b ? "Start with group A" : "Read the clue",
      text: `Look at ${clueName(a, index, columns)}.${earlier(a)} There ${a.remainingMines === 1 ? "is" : "are"} exactly ${remaining(a)} marked A (blue).`,
      marks: marks(false, false),
    },
  ];
  if (b)
    phases.push({
      title: "Compare the bigger group",
      text: `Now look at ${clueName(b, index, columns)}. ${earlier(b).trim() ? earlier(b).trim() + " " : ""}Group B needs ${remaining(b)}. It includes all the blue A squares, plus the purple extra squares marked B.`,
      marks: marks(true, false),
    });
  phases.push({
    title: safe ? "Find the safe squares" : "Find the mines",
    text: b
      ? `Group A already accounts for ${count(a.remainingMines, "mine")} in group B. ${safe ? "There are no mines left for the extra squares." : "Every extra square must contain a mine."} ${safe ? "Your square is safe." : "Your square is a mine."}`
      : `${safe ? "All the required mines are already accounted for. The remaining highlighted squares are safe." : "There are exactly as many mines as remaining squares. Every highlighted result square is a mine."} ${safe ? "Your square is safe." : "Your square is a mine."}`,
    marks: marks(!!b, true),
    equation: b
      ? `${b.remainingMines} − ${a.remainingMines} = ${count(visual.mineCount, "mine")} in ${count(extra.length, "extra square")}`
      : `${count(a.remainingMines, "mine")} in ${count(a.cells.length, "remaining square")}`,
  });
  return {
    phases,
    bounds,
    prerequisiteCount: steps.length - 1,
    habit: b
      ? "When one group fits inside another, compare how many mines each needs."
      : safe
        ? a.clue === null
          ? "When all mines on the board are accounted for, the remaining covered squares are safe."
          : "When a clue has all its mines accounted for, its other covered neighbors are safe."
        : a.clue === null
          ? "When the remaining mine count equals the remaining covered squares, all those squares are mines."
          : "When a clue needs as many mines as covered squares, every one is a mine.",
  };
}
