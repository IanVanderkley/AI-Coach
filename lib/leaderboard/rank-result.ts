import { competitiveRank } from "./rank-policy.ts";
import type { RankedMatchRating } from "./match-rating.ts";

/** Rank transitions use stored receipt values, never a speculative reward. */
export function rankResultModel(receipt: RankedMatchRating) {
  const before = competitiveRank(receipt.ratingBefore);
  const after = competitiveRank(receipt.ratingAfter);
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
    nextRank:
      after.nextThreshold === null ? null : competitiveRank(after.nextThreshold).label,
  };
}
