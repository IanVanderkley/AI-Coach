import { calculateRankPolicyV2, calculateRankPolicyV3 } from "./rank-policy.ts";
import { calculateRankPolicyV4, RANK_POLICY_V4 } from "./rank-policy-v4.ts";
import { finalGuessCompensation } from "./final-guess-compensation.ts";

/** A read-only projection of a trusted private Elo event. No account identifiers. */
export type RankedMatchRating = {
  outcome: "won" | "lost";
  policyVersion: 1 | 2 | 3 | 4;
  ratingBefore: number;
  ratingDelta: number;
  ratingAfter: number;
  finalGuessCompensated?: true;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rating(value: unknown, minimum: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
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
  const marker = value.finalGuessCompensated;
  const compensated = marker === true;
  if (
    (marker !== undefined && marker !== true) ||
    (compensated && (policyVersion !== 4 || outcome !== "lost"))
  ) {
    throw new TypeError("Invalid final guess receipt marker.");
  }
  const minimum = policyVersion === 4 ? RANK_POLICY_V4.minimum : 100;
  if (
    (outcome !== "won" && outcome !== "lost") ||
    (policyVersion !== 1 &&
      policyVersion !== 2 &&
      policyVersion !== 3 &&
      policyVersion !== 4) ||
    !rating(before, minimum) ||
    !rating(after, minimum) ||
    typeof delta !== "number" ||
    !Number.isSafeInteger(delta) ||
    Math.abs(delta) >
      (policyVersion === 1
        ? 32
        : policyVersion === 2
          ? 90
          : policyVersion === 3
            ? 100
            : 160) ||
    before + delta !== after ||
    (outcome === "won" && delta < 0) ||
    (outcome === "lost" && !compensated && delta > 0)
  ) {
    throw new TypeError("Invalid Ranked rating receipt.");
  }
  if (policyVersion === 2 && calculateRankPolicyV2(before, outcome).delta !== delta) {
    throw new TypeError("Invalid v2 Ranked rating receipt.");
  }
  if (policyVersion === 3 && calculateRankPolicyV3(before, outcome).delta !== delta) {
    throw new TypeError("Invalid v3 Ranked rating receipt.");
  }
  if (
    policyVersion === 4 &&
    (compensated
      ? finalGuessCompensation(before)
      : calculateRankPolicyV4(before, outcome).delta) !== delta
  ) {
    throw new TypeError("Invalid v4 Ranked rating receipt.");
  }
  return {
    outcome,
    policyVersion,
    ratingBefore: before,
    ratingDelta: delta,
    ratingAfter: after,
    ...(compensated ? { finalGuessCompensated: true as const } : {}),
  };
}

export function formatRatingDelta(
  delta: number,
  policyVersion: RankedMatchRating["policyVersion"] = 3,
): string {
  if (
    !Number.isSafeInteger(delta) ||
    Math.abs(delta) > (policyVersion === 4 ? 160 : 100)
  ) {
    throw new RangeError("Invalid rating change.");
  }
  return delta > 0 ? `+${delta}` : String(delta);
}
