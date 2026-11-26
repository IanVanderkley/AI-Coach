import {
  RANK_DEFINITIONS,
  RANK_POLICY,
  competitiveRank,
  calculateRankPolicyV3,
} from "./rank-policy.ts";

export type RankedLobbyRating = {
  rating: number;
  highestRating: number;
  policyVersion: 3;
};

function validRating(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= RANK_POLICY.minimum &&
    value <= RANK_POLICY.maximum
  );
}

/** Read-only projection of account-owned saved ratings. No default or fabricated rating. */
export function projectRankedLobbyRating(
  rating: unknown,
  bestBefore: unknown,
  bestAfter: unknown,
): RankedLobbyRating {
  if (
    !validRating(rating) ||
    (bestBefore !== null && !validRating(bestBefore)) ||
    (bestAfter !== null && !validRating(bestAfter))
  ) {
    throw new RangeError("Invalid Ranked rating history.");
  }
  return {
    rating,
    highestRating: Math.max(rating, bestBefore ?? rating, bestAfter ?? rating),
    policyVersion: 3,
  };
}

export function parseRankedLobbyRating(value: unknown): RankedLobbyRating {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Invalid Ranked lobby response.");
  const row = value as Record<string, unknown>;
  if (
    row.policyVersion !== 3 ||
    !validRating(row.rating) ||
    !validRating(row.highestRating) ||
    row.highestRating < row.rating
  )
    throw new TypeError("Invalid Ranked lobby response.");
  return { rating: row.rating, highestRating: row.highestRating, policyVersion: 3 };
}

/** Position is interpolated between the equally spaced rank markers, not the raw Elo range. */
export function rankedLobbyModel(value: RankedLobbyRating) {
  const current = competitiveRank(value.rating);
  const highest = competitiveRank(value.highestRating);
  const index = RANK_DEFINITIONS.findIndex((rank) => rank.name === current.name);
  const next = RANK_DEFINITIONS[index + 1];
  const position = next
    ? index +
      (value.rating - RANK_DEFINITIONS[index].min) /
        (next.min - RANK_DEFINITIONS[index].min)
    : index;
  return {
    current,
    highest,
    index,
    journeyPercent: (position / (RANK_DEFINITIONS.length - 1)) * 100,
    win: calculateRankPolicyV3(value.rating, "won").delta,
    loss: calculateRankPolicyV3(value.rating, "lost").delta,
    nextRank:
      current.nextThreshold === null
        ? null
        : competitiveRank(current.nextThreshold).label,
  };
}
