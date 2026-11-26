/** Finish at the last recorded action, not a later React effect or animation. */
export function completedPracticeSeconds(
  lastMoveMs: unknown,
  fallbackMs: number,
): number {
  const elapsed =
    typeof lastMoveMs === "number" && Number.isFinite(lastMoveMs) && lastMoveMs >= 0
      ? lastMoveMs
      : fallbackMs;
  return Number.isFinite(elapsed) ? Math.floor(Math.max(0, elapsed) / 1000) : 0;
}
