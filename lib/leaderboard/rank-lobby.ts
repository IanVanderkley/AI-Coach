import {
  RANK_POLICY,
  calculateRankPolicyV3,
} from "./rank-policy.ts";
import { displayRank, rankDefinitionsForPolicy, type RankDisplayVersion } from "./rank-display.ts";
import { calculateRankPolicyV4, RANK_POLICY_V4 } from "./rank-policy-v4.ts";

export type RankedLobbyRating = {
  rating: number;
  highestRating: number;
  policyVersion: RankDisplayVersion;
};

function validRating(value: unknown, version: RankDisplayVersion): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= (version === 4 ? RANK_POLICY_V4.minimum : RANK_POLICY.minimum) &&
    value <= RANK_POLICY.maximum
  );
}

/** Read-only projection of account-owned saved ratings. No default or fabricated rating. */
export function projectRankedLobbyRating(
  rating: unknown,
  bestBefore: unknown,
  bestAfter: unknown,
  policyVersion: RankDisplayVersion = 3,
): RankedLobbyRating {
  if (
    (policyVersion !== 3 && policyVersion !== 4) ||
    !validRating(rating, policyVersion) ||
    (bestBefore !== null && !validRating(bestBefore, policyVersion)) ||
    (bestAfter !== null && !validRating(bestAfter, policyVersion))
  ) {
    throw new RangeError("Invalid Ranked rating history.");
  }
  return {
    rating,
    highestRating: Math.max(rating, bestBefore ?? rating, bestAfter ?? rating),
    policyVersion,
  };
}

export function parseRankedLobbyRating(value: unknown): RankedLobbyRating {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Invalid Ranked lobby response.");
  const row = value as Record<string, unknown>;
  if (
    (row.policyVersion !== 3 && row.policyVersion !== 4) ||
    !validRating(row.rating, row.policyVersion) ||
    !validRating(row.highestRating, row.policyVersion) ||
    row.highestRating < row.rating
  )
    throw new TypeError("Invalid Ranked lobby response.");
  return { rating: row.rating, highestRating: row.highestRating, policyVersion: row.policyVersion };
}

/** Position is interpolated between the equally spaced rank markers, not the raw Elo range. */
export function rankedLobbyModel(value: RankedLobbyRating) {
  const current = displayRank(value.rating, value.policyVersion);
  const highest = displayRank(value.highestRating, value.policyVersion);
  const definitions = rankDefinitionsForPolicy(value.policyVersion);
  const award = value.policyVersion === 4 ? calculateRankPolicyV4 : calculateRankPolicyV3;
  const index = definitions.findIndex((rank) => rank.name === current.name);
  const next = definitions[index + 1];
  const position = next
    ? index +
      Math.max(0, value.rating - definitions[index].min) /
        (next.min - definitions[index].min)
    : index;
  return {
    current,
    highest,
    index,
    journeyPercent: (position / (definitions.length - 1)) * 100,
    win: award(value.rating, "won").delta,
    loss: award(value.rating, "lost").delta,
    nextRank:
      current.nextThreshold === null
        ? null
        : displayRank(current.nextThreshold, value.policyVersion).label,
  };
}
