import { displayRank } from "./rank-display.ts";
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
