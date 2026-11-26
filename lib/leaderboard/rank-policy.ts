/** Batch 23 candidate policy. Not used to award live ratings until the SQL rollout. */
export const RANK_POLICY = {
  version: 2,
  minimum: 100,
  maximum: 10000,
  starting: 1000,
  divisionWidth: 100,
  benchmark: 1700,
  spread: 1900,
  kFactor: 45,
  winMultiplier: 2,
  lossMultiplier: 1,
} as const;

export const RANK_DEFINITIONS = [
  { name: "Copper", min: 100, divisions: 5, color: "#B65340" },
  { name: "Bronze", min: 600, divisions: 5, color: "#CD9B56" },
  { name: "Silver", min: 1100, divisions: 5, color: "#C0CAD8" },
  { name: "Gold", min: 1600, divisions: 5, color: "#F5C542" },
  { name: "Platinum", min: 2100, divisions: 5, color: "#22D3EE" },
  { name: "Emerald", min: 2600, divisions: 5, color: "#10B981" },
  { name: "Diamond", min: 3100, divisions: 3, color: "#A78BFA" },
  { name: "Omniscient", min: 3400, divisions: 0, color: "#FFB7C5" },
] as const;

export type CompetitiveRank = (typeof RANK_DEFINITIONS)[number]["name"];
export type RankNumeral = "I" | "II" | "III" | "IV" | "V";
const NUMERALS = ["I", "II", "III", "IV", "V"] as const;

export type RankProgress = {
  name: CompetitiveRank;
  color: string;
  division: RankNumeral | null;
  label: string;
  minimum: number;
  nextThreshold: number | null;
  eloToPromotion: number | null;
  progress: number | null;
};

function assertRating(rating: number): void {
  if (
    !Number.isSafeInteger(rating) ||
    rating < RANK_POLICY.minimum ||
    rating > RANK_POLICY.maximum
  ) {
    throw new RangeError("Invalid saved rating.");
  }
}

export function competitiveRank(rating: number): RankProgress {
  assertRating(rating);
  const definition = [...RANK_DEFINITIONS].reverse().find((rank) => rating >= rank.min);
  if (!definition) throw new RangeError("Invalid saved rating.");

  if (definition.divisions === 0) {
    return {
      name: definition.name,
      color: definition.color,
      division: null,
      label: definition.name,
      minimum: definition.min,
      nextThreshold: null,
      eloToPromotion: null,
      progress: null,
    };
  }

  const index = Math.floor((rating - definition.min) / RANK_POLICY.divisionWidth);
  const division = NUMERALS[definition.divisions - index - 1];
  const minimum = definition.min + index * RANK_POLICY.divisionWidth;
  const nextThreshold = minimum + RANK_POLICY.divisionWidth;
  return {
    name: definition.name,
    color: definition.color,
    division,
    label: `${definition.name} ${division}`,
    minimum,
    nextThreshold,
    eloToPromotion: nextThreshold - rating,
    progress: (rating - minimum) / RANK_POLICY.divisionWidth,
  };
}

/** Candidate fixed-benchmark solo rating; this is not head-to-head Elo. */
export function expectedSoloScore(rating: number): number {
  assertRating(rating);
  return 1 / (1 + 10 ** ((RANK_POLICY.benchmark - rating) / RANK_POLICY.spread));
}

/** Reference calculation for simulation and future SQL parity tests, not an award API. */
export function calculateRankPolicyV2(
  rating: number,
  outcome: "won" | "lost",
): { rating: number; delta: number } {
  const expected = expectedSoloScore(rating);
  if (outcome !== "won" && outcome !== "lost") {
    throw new RangeError("Invalid match outcome.");
  }
  // Round positive magnitudes before applying the sign, matching PostgreSQL
  // numeric rounding away from zero at ties.
  const change =
    outcome === "won"
      ? Math.round(RANK_POLICY.kFactor * RANK_POLICY.winMultiplier * (1 - expected))
      : -Math.round(RANK_POLICY.kFactor * RANK_POLICY.lossMultiplier * expected);
  const after = Math.max(
    RANK_POLICY.minimum,
    Math.min(RANK_POLICY.maximum, rating + change),
  );
  return { rating: after, delta: after - rating };
}
