import { calculateRankPolicyV2, calculateRankPolicyV3 } from "./rank-policy.ts";

/** A read-only projection of a trusted private Elo event. No account identifiers. */
export type RankedMatchRating = {
  outcome: "won" | "lost";
  policyVersion: 1 | 2 | 3;
  ratingBefore: number;
  ratingDelta: number;
  ratingAfter: number;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rating(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 100 &&
    value <= 10000
  );
}

export function parseRankedMatchRating(value: unknown): RankedMatchRating {
  if (!record(value)) throw new TypeError("Invalid Ranked rating receipt.");
  const outcome = value.outcome;
  const policyVersion = value.policyVersion;
  const before = value.ratingBefore;
  const delta = value.ratingDelta;
  const after = value.ratingAfter;
  if (
    (outcome !== "won" && outcome !== "lost") ||
    (policyVersion !== 1 && policyVersion !== 2 && policyVersion !== 3) ||
    !rating(before) ||
    !rating(after) ||
    typeof delta !== "number" ||
    !Number.isSafeInteger(delta) ||
    Math.abs(delta) > (policyVersion === 1 ? 32 : policyVersion === 2 ? 90 : 100) ||
    before + delta !== after ||
    (outcome === "won" && delta < 0) ||
    (outcome === "lost" && delta > 0)
  ) {
    throw new TypeError("Invalid Ranked rating receipt.");
  }
  if (policyVersion === 2 && calculateRankPolicyV2(before, outcome).delta !== delta) {
    throw new TypeError("Invalid v2 Ranked rating receipt.");
  }
  if (policyVersion === 3 && calculateRankPolicyV3(before, outcome).delta !== delta) {
    throw new TypeError("Invalid v3 Ranked rating receipt.");
  }
  return {
    outcome,
    policyVersion,
    ratingBefore: before,
    ratingDelta: delta,
    ratingAfter: after,
  };
}

export function formatRatingDelta(delta: number): string {
  if (!Number.isSafeInteger(delta) || Math.abs(delta) > 100) {
    throw new RangeError("Invalid rating change.");
  }
  return delta > 0 ? `+${delta}` : String(delta);
}
