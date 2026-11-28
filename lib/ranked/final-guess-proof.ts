/** Pure visible-board reference; never use a browser claim to award rating.
 * Ranked Intermediate only. null means covered, 0..8 means revealed safe clue.
 * Flags and the true hidden layout are intentionally absent from this interface.
 */
export const FINAL_GUESS_ROWS = 16;
export const FINAL_GUESS_COLUMNS = 16;
export const FINAL_GUESS_MINES = 40;
const TOTAL = FINAL_GUESS_ROWS * FINAL_GUESS_COLUMNS;

function neighbors(index: number): number[] {
  const row = Math.floor(index / FINAL_GUESS_COLUMNS);
  const column = index % FINAL_GUESS_COLUMNS;
  const result: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = column + dc;
      if (r >= 0 && r < FINAL_GUESS_ROWS && c >= 0 && c < FINAL_GUESS_COLUMNS)
        result.push(r * FINAL_GUESS_COLUMNS + c);
    }
  }
  return result;
}

/** At 215 revealed safe cells, each possible world has exactly one covered
 * safe square and all other covered squares are mines. Enumerate all worlds.
 * Return a pair only when exactly two satisfy EVERY revealed clue.
 * This is a proof of ambiguity, not proof of a completed loss or an Elo receipt.
 */
export function proveFinalFiftyFifty(
  clues: readonly (number | null)[],
): readonly [number, number] | null {
  if (!Array.isArray(clues) || clues.length !== TOTAL) return null;
  const covered: number[] = [];
  const constraints: { covered: Set<number>; count: number; clue: number }[] = [];
  // Indexed reads also reject holes in sparse arrays.
  for (let index = 0; index < TOTAL; index++) {
    const clue = clues[index];
    if (clue === null) covered.push(index);
    else if (!Number.isInteger(clue) || clue < 0 || clue > 8) return null;
  }
  if (covered.length !== FINAL_GUESS_MINES + 1) return null;
  for (let index = 0; index < TOTAL; index++) {
    const clue = clues[index];
    if (clue === null) continue;
    const adjacentCovered = neighbors(index).filter((near) => clues[near] === null);
    const count = adjacentCovered.length;
    if (clue !== count && clue !== count - 1) return null;
    constraints.push({ covered: new Set(adjacentCovered), count, clue });
  }
  const candidates: number[] = [];
  for (const candidate of covered) {
    if (
      constraints.every(
        ({ covered: near, count, clue }) =>
          clue === count - (near.has(candidate) ? 1 : 0),
      )
    ) {
      candidates.push(candidate);
      if (candidates.length > 2) return null;
    }
  }
  return candidates.length === 2 ? [candidates[0], candidates[1]] : null;
}
