import type { ProofVisual, TeachingGroup } from "./verified-replay.ts";

const quantity = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
export function describeGroup(group: TeachingGroup, letter?: string) {
  const source =
    group.clue === null
      ? "The board's mine counter"
      : `The ${group.originalCount}${letter ? ` (${letter})` : ""} clue`;
  const subject = `${source} tells us there ${group.originalCount === 1 ? "is" : "are"} ${quantity(group.originalCount, "mine")}${group.clue === null ? " in total" : " touching it"}.`;
  const known = group.knownMines.length
    ? ` We have already worked out ${quantity(group.knownMines.length, "mine")} here.`
    : "";
  const safe = group.knownSafe.length
    ? ` We can also leave out ${quantity(group.knownSafe.length, "square")} already proven safe.`
    : "";
  return `${subject}${known}${safe} That leaves ${quantity(group.remainingMines, "mine")} in ${quantity(group.cells.length, "unresolved square")}.`;
}
export function describeVisual(visual: ProofVisual) {
  const [a, b] = visual.groups;
  const size = visual.result.length;
  const safe = visual.mineCount === 0;
  const conclusion = safe
    ? `There are no mines in the ${size === 1 ? "highlighted square" : "highlighted squares"}. ${size === 1 ? "It is safe to open." : "They are safe to open."}`
    : `There ${visual.mineCount === 1 ? "is" : "are"} ${quantity(visual.mineCount, "mine")} in exactly ${quantity(size, "highlighted square")}. ${size === 1 ? "That square must be a mine." : "Every one must be a mine."}`;
  if (b)
    return {
      title: "Compare two clues",
      introduction:
        "The blue squares belong to both groups. The outlined extra squares belong only to group B.",
      reasoning: `${b.remainingMines} − ${a.remainingMines} = ${visual.mineCount}. Group A already accounts for ${quantity(a.remainingMines, "mine")} in group B, so only ${quantity(visual.mineCount, "mine")} can be in the extra ${size === 1 ? "square" : "squares"}.`,
      conclusion,
      habit:
        "When one clue's remaining squares are all included in another clue's group, subtract the smaller group's mine count from the larger one.",
    };
  return {
    title:
      a.clue === null
        ? "Count the remaining mines"
        : safe
          ? "All the mines are accounted for"
          : "Find the mines using one number",
    introduction: describeGroup(a),
    reasoning: safe
      ? a.clue === null
        ? "Every mine on the board is already accounted for."
        : "Every mine required by this clue is already accounted for."
      : "There are exactly as many mines as unresolved squares. No other arrangement is possible.",
    conclusion,
    habit:
      a.clue === null
        ? safe
          ? "When every mine on the board has been proven, the other covered squares are safe."
          : "When the number of mines left equals the number of unresolved squares, every unresolved square is a mine."
        : safe
          ? "When a number already has all its proven mines, the other touching squares are safe."
          : "When a number needs as many mines as it has unresolved neighbors, every one of those neighbors is a mine.",
  };
}
export function proofBounds(visual: ProofVisual, rows: number, columns: number) {
  // Include the complete neighborhood of each clue as context; all indices come from the before board.
  const indices = new Set(visual.result);
  for (const group of visual.groups) {
    for (const i of [...group.cells, ...group.knownMines, ...group.knownSafe])
      indices.add(i);
    if (group.clue !== null) {
      const row = Math.floor(group.clue / columns),
        col = group.clue % columns;
      for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++)
        for (let c = Math.max(0, col - 1); c <= Math.min(columns - 1, col + 1); c++)
          indices.add(r * columns + c);
    }
  }
  const valid = [...indices].filter(
    (i) => Number.isInteger(i) && i >= 0 && i < rows * columns,
  );
  if (!valid.length) return { top: 0, bottom: 0, left: 0, right: 0 };
  return {
    top: Math.min(...valid.map((i) => Math.floor(i / columns))),
    bottom: Math.max(...valid.map((i) => Math.floor(i / columns))),
    left: Math.min(...valid.map((i) => i % columns)),
    right: Math.max(...valid.map((i) => i % columns)),
  };
}
