/** Lifetime Ranked results for the currently playable, server-owned Intermediate board.
 * Only the backend may construct these totals from the official database.
 */
export type RankedLifetimeStats = {
  games: number;
  wins: number;
  losses: number;
  winRate: number | null;
  fastestWinMs: number | null;
};

function count(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid ${label} count from the Ranked database.`);
  }
  return value;
}

/** Count server-confirmed wins and terminal losses, never active/abandoned matches. */
export function summarizeRankedLifetime(
  verifiedWinCount: unknown,
  serverLossCount: unknown,
  fastestVerifiedWinMs: unknown,
): RankedLifetimeStats {
  const wins = count(verifiedWinCount, "verified win");
  const losses = count(serverLossCount, "loss");
  const games = wins + losses;
  if (!Number.isSafeInteger(games)) throw new Error("Ranked total overflow.");

  let fastestWinMs: number | null = null;
  if (fastestVerifiedWinMs !== null) {
    if (
      typeof fastestVerifiedWinMs !== "number" ||
      !Number.isSafeInteger(fastestVerifiedWinMs) ||
      fastestVerifiedWinMs < 0 ||
      wins === 0
    ) {
      throw new Error("Invalid fastest verified Ranked win.");
    }
    fastestWinMs = fastestVerifiedWinMs;
  } else if (wins > 0) {
    throw new Error("Missing fastest verified Ranked win.");
  }

  return {
    games,
    wins,
    losses,
    winRate: games === 0 ? null : (wins / games) * 100,
    fastestWinMs,
  };
}

/** Validate JSON from the owned, no-store server endpoint before showing totals. */
export function parseRankedLifetimeResponse(value: unknown): RankedLifetimeStats {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid Ranked lifetime response.");
  }
  const body = value as Record<string, unknown>;
  if (body.scope !== "verified-intermediate-lifetime") {
    throw new Error("Unexpected Ranked statistics scope.");
  }
  const input = body.stats;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Missing Ranked lifetime totals.");
  }
  const stats = input as Record<string, unknown>;
  const validated = summarizeRankedLifetime(stats.wins, stats.losses, stats.fastestWinMs);
  if (stats.games !== validated.games || stats.winRate !== validated.winRate) {
    throw new Error("Inconsistent Ranked lifetime totals.");
  }
  return validated;
}
