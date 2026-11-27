/** Visual interpolation only. Never changes, awards, or persists rating. */
export const ELO_REVEAL_MS = 2200;
export function eloRevealFrame(before: number, after: number, elapsedMs: number) {
  const fraction = Math.min(1, Math.max(0, elapsedMs / ELO_REVEAL_MS));
  const eased = 1 - (1 - fraction) ** 3;
  return { rating: fraction === 1 ? after : Math.round(before + (after - before) * eased), done: fraction === 1 || before === after };
}
