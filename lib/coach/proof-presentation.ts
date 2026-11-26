import type { ProofVisual } from "./verified-replay.ts";

const quantity = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;
const coordinates = (indices: readonly number[], columns: number) =>
  indices.length
    ? indices
        .map((i) => `R${Math.floor(i / columns) + 1}C${(i % columns) + 1}`)
        .join(", ")
    : "none";

/** A presentation-only view of the recorded deduction; never infer new facts. */
export function describeTechnicalProof(visual: ProofVisual, columns: number): string[] {
  const lines = visual.groups.map((group, i) => {
    const label =
      group.clue === null
        ? "Board mine count"
        : `Clue ${coordinates([group.clue], columns)}`;
    const prefix = visual.groups.length > 1 ? `Group ${i === 0 ? "A" : "B"}: ` : "";
    return `${prefix}${label}: ${quantity(group.originalCount, "mine")}. Proven mines: ${group.knownMines.length} (${coordinates(group.knownMines, columns)}). Proven-safe covered squares: ${group.knownSafe.length} (${coordinates(group.knownSafe, columns)}). ${group.originalCount} - ${group.knownMines.length} = ${quantity(group.remainingMines, "mine")} in ${quantity(group.cells.length, "unresolved square")} (${coordinates(group.cells, columns)}).`;
  });
  const [a, b] = visual.groups;
  if (b)
    lines.push(
      `Subtract group A from group B: ${b.remainingMines} - ${a.remainingMines} = ${quantity(visual.mineCount, "mine")} in ${quantity(visual.result.length, "extra square")}.`,
    );
  lines.push(
    `${quantity(visual.result.length, "proven square")}: ${coordinates(visual.result, columns)}. ${visual.mineCount === 0 ? (visual.result.length === 1 ? "This square is safe." : "These squares are safe.") : visual.result.length === 1 ? "This square is a mine." : "Every square is a mine."}`,
  );
  return lines;
}

/** Preserve the original proof order and expose the entire chain on request. */
export function proofStepIndices(
  count: number,
  selected: number,
  showAll: boolean,
): number[] {
  if (!Number.isSafeInteger(count) || count <= 0) return [];
  if (showAll) return Array.from({ length: count }, (_, i) => i);
  return [
    Math.max(
      0,
      Math.min(count - 1, Number.isFinite(selected) ? Math.trunc(selected) : 0),
    ),
  ];
}
