import { displayRank, rankDefinitionsForPolicy } from "./rank-display.ts";
import { calculateRankPolicyV4 } from "./rank-policy-v4.ts";
import type { RankedMatchRating } from "./match-rating.ts";

/** Rank transitions use stored receipt values, never a speculative reward. */
export function rankResultModel(receipt: RankedMatchRating) {
  const version = receipt.policyVersion === 4 ? 4 : 3;
  const before = displayRank(receipt.ratingBefore, version);
  const after = displayRank(receipt.ratingAfter, version);
  const transition =
    receipt.policyVersion === 1 || before.label === after.label
      ? "unchanged"
      : receipt.ratingAfter > receipt.ratingBefore
        ? "promotion"
        : "demotion";
  return {
    before,
    after,
    transition,
    demotionProtected:
      receipt.policyVersion === 4 &&
      !receipt.finalGuessCompensated &&
      calculateRankPolicyV4(receipt.ratingBefore, receipt.outcome).demotionProtected,
    nextRank:
      after.nextThreshold === null
        ? null
        : displayRank(after.nextThreshold, version).label,
  };
}

/** Each crossed division receives exactly one visual step. No new Elo is awarded. */
export function rankTransitionSteps(receipt: RankedMatchRating) {
  const model = rankResultModel(receipt);
  if (model.transition === "unchanged") return [];
  const version = receipt.policyVersion === 4 ? 4 : 3;
  const thresholds = rankDefinitionsForPolicy(version)
    .flatMap((tier) =>
      Array.from({ length: Math.max(1, tier.divisions) }, (_, i) => tier.min + i * 100),
    )
    .slice(1);
  const up = model.transition === "promotion";
  const crossed = up
    ? thresholds.filter(
        (floor) => receipt.ratingBefore < floor && floor <= receipt.ratingAfter,
      )
    : thresholds
        .filter((floor) => receipt.ratingAfter < floor && floor <= receipt.ratingBefore)
        .reverse();
  let fromRating = receipt.ratingBefore;
  return crossed.map((floor, index) => {
    const toRating =
      index === crossed.length - 1 ? receipt.ratingAfter : up ? floor : floor - 1;
    const step = {
      fromRating,
      toRating,
      from: displayRank(fromRating, version),
      to: displayRank(toRating, version),
      direction: model.transition,
    };
    fromRating = toRating;
    return step;
  });
}

export const RANK_PROMOTION_STEP_MS = 1100;
export const RANK_DEMOTION_STEP_MS = 950;
