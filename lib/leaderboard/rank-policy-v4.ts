/** Batch 26A candidate: pure reference policy only; not a live award path. */
export const RANK_POLICY_V4 = {
  version: 4,
  starting: 1500,
  // PostgreSQL integer storage boundary, not a gameplay demotion floor.
  minimum: -2147483648,
  maximum: 10000,
  divisionWidth: 100,
} as const;

export const RANK_TIERS_V4 = [
  { name: "Copper", min: 0, divisions: 5, win: 160, loss: 10 },
  { name: "Bronze", min: 500, divisions: 5, win: 140, loss: 10 },
  { name: "Silver", min: 1000, divisions: 5, win: 120, loss: 10 },
  { name: "Gold", min: 1500, divisions: 5, win: 110, loss: 12 },
  { name: "Platinum", min: 2000, divisions: 5, win: 100, loss: 15 },
  { name: "Emerald", min: 2500, divisions: 5, win: 85, loss: 18 },
  { name: "Diamond", min: 3000, divisions: 3, win: 70, loss: 22 },
  { name: "Omniscient", min: 3300, divisions: 0, win: 50, loss: 25 },
] as const;

const NUMERALS = ["I", "II", "III", "IV", "V"] as const;

function assertRating(rating: number): void {
  if (
    !Number.isSafeInteger(rating) ||
    rating < RANK_POLICY_V4.minimum ||
    rating > RANK_POLICY_V4.maximum
  ) {
    throw new RangeError("Invalid v4 rating.");
  }
}

/** Negative ratings are Copper V with zero displayed progress and real Elo debt. */
export function competitiveRankV4(rating: number) {
  assertRating(rating);
  const tier = [...RANK_TIERS_V4].reverse().find((t) => rating >= t.min) ?? RANK_TIERS_V4[0];
  const index = Math.max(0, Math.floor((rating - tier.min) / 100));
  const division = tier.divisions === 0 ? null : NUMERALS[tier.divisions - 1 - index];
  const floor = tier.divisions === 0 ? tier.min : tier.min + index * 100;
  const nextThreshold = tier.divisions === 0 ? null : floor + 100;
  const protectedFloor = rating < 100 ? null : floor;
  return {
    name: tier.name,
    division,
    label: division === null ? tier.name : `${tier.name} ${division}`,
    protectedFloor,
    nextThreshold,
    eloToPromotion: nextThreshold === null ? null : nextThreshold - rating,
    progress: nextThreshold === null ? null : Math.max(0, (rating - floor) / 100),
    win: tier.win,
    loss: tier.loss,
  };
}

/** Rewards use the pre-match rating. A crossing loss stops at the division floor
 * only when starting strictly above it. No protection at exactly zero progress.
 * Final-guess compensation is deliberately excluded until server proof exists.
 */
export function calculateRankPolicyV4(rating: number, outcome: "won" | "lost") {
  const rank = competitiveRankV4(rating);
  if (outcome !== "won" && outcome !== "lost") {
    throw new RangeError("Invalid match outcome.");
  }
  const nominalDelta = outcome === "won" ? rank.win : -rank.loss;
  const raw = rating + nominalDelta;
  const demotionProtected =
    outcome === "lost" &&
    rank.protectedFloor !== null &&
    rating > rank.protectedFloor &&
    raw < rank.protectedFloor;
  const after = Math.max(
    RANK_POLICY_V4.minimum,
    Math.min(RANK_POLICY_V4.maximum, demotionProtected ? rank.protectedFloor! : raw),
  );
  return { rating: after, delta: after - rating, nominalDelta, demotionProtected };
}
