import { competitiveRankV4, RANK_POLICY_V4 } from "./rank-policy-v4.ts";

/** Receipt projection only. The database proves eligibility and awards the rating. */
export function finalGuessCompensation(rating: number): number {
  const rank = competitiveRankV4(rating);
  return Math.min(RANK_POLICY_V4.maximum - rating, Math.ceil(rank.win / 2));
}
