/** Read-only view model for the existing server-verified Intermediate leaderboard. */
export const VERIFIED_LEADERBOARD_ENDPOINT =
  "/api/ranked-results?boardSize=16&mineCount=40";

export const VERIFIED_LEADERBOARD_LIMIT = 50;

export type VerifiedLeaderboardEntry = {
  rank: number;
  durationMs: number;
  finishedAt: string;
};

export type VerifiedLeaderboardResponse = {
  mode: "ranked";
  source: "server-verified";
  boardSize: 16;
  mineCount: 40;
  timing: "server-wall-clock";
  results: VerifiedLeaderboardEntry[];
};

/**
 * Validate the anonymous public API response, projecting only fields the UI needs.
 * Reject invalid data rather than presenting guessed or client-claimed rankings.
 */
export function parseVerifiedLeaderboardResponse(
  value: unknown,
): VerifiedLeaderboardResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Invalid verified leaderboard response.");
  }

  const payload = value as Record<string, unknown>;
  if (
    payload.mode !== "ranked" ||
    payload.source !== "server-verified" ||
    payload.boardSize !== 16 ||
    payload.mineCount !== 40 ||
    payload.timing !== "server-wall-clock" ||
    !Array.isArray(payload.results) ||
    payload.results.length > VERIFIED_LEADERBOARD_LIMIT
  ) {
    throw new TypeError("Invalid verified leaderboard response.");
  }

  let lastDuration = 0;
  let lastFinish = "";
  const results: VerifiedLeaderboardEntry[] = payload.results.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new TypeError("Invalid verified leaderboard entry.");
    }

    const row = item as Record<string, unknown>;
    const { rank, durationMs, finishedAt } = row;
    if (
      rank !== index + 1 ||
      typeof durationMs !== "number" ||
      !Number.isSafeInteger(durationMs) ||
      durationMs <= 0 ||
      typeof finishedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T/.test(finishedAt) ||
      !Number.isFinite(Date.parse(finishedAt)) ||
      durationMs < lastDuration ||
      (durationMs === lastDuration && finishedAt < lastFinish)
    ) {
      throw new TypeError("Invalid verified leaderboard entry.");
    }

    lastDuration = durationMs;
    lastFinish = finishedAt;
    // Never forward unexpected keys such as user IDs, emails or match IDs.
    return { rank, durationMs, finishedAt };
  });

  return {
    mode: "ranked",
    source: "server-verified",
    boardSize: 16,
    mineCount: 40,
    timing: "server-wall-clock",
    results,
  };
}
