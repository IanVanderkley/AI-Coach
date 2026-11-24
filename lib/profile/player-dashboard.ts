/** Display-only summaries of available, completed records.
 * These numbers are NOT lifetime statistics or competitive RP.
 */
export type RecentOutcome = "win" | "loss" | "won" | "lost";

export type RecentStats = {
  games: number;
  wins: number;
  losses: number;
  winRate: number | null;
};

export function summarizeRecentOutcomes(outcomes: readonly RecentOutcome[]): RecentStats {
  let wins = 0;
  let losses = 0;
  for (const outcome of outcomes) {
    if (outcome === "win" || outcome === "won") wins++;
    else if (outcome === "loss" || outcome === "lost") losses++;
    else throw new Error("Unsupported match outcome in player summary.");
  }
  const games = wins + losses;
  return {
    games,
    wins,
    losses,
    winRate: games === 0 ? null : (wins / games) * 100,
  };
}

/** Unknown/failed/unauthorized mode data must never be mistaken for zero games. */
export function combineRecentStats(
  practice: RecentStats | null,
  ranked: RecentStats | null,
): RecentStats | null {
  if (!practice || !ranked) return null;
  const games = practice.games + ranked.games;
  const wins = practice.wins + ranked.wins;
  const losses = practice.losses + ranked.losses;
  return {
    games,
    wins,
    losses,
    winRate: games === 0 ? null : (wins / games) * 100,
  };
}

export function showRecentCount(value: number | null): string {
  return value === null ? "—" : value.toLocaleString();
}

export function showRecentWinRate(value: number | null | undefined): string {
  return value == null ? "—" : `${value.toFixed(1)}%`;
}
