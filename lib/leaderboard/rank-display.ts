import { competitiveRank, RANK_DEFINITIONS, type RankProgress } from "./rank-policy.ts";
import { competitiveRankV4, RANK_TIERS_V4 } from "./rank-policy-v4.ts";

export type RankDisplayVersion = 3 | 4;

/** Keep historical colors and artwork; select the scale explicitly. */
export function rankDefinitionsForPolicy(version: RankDisplayVersion) {
  if (version === 3) return RANK_DEFINITIONS;
  return RANK_TIERS_V4.map((tier, index) => ({
    name: tier.name, min: tier.min, divisions: tier.divisions,
    color: RANK_DEFINITIONS[index].color,
  }));
}

export function displayRank(rating: number, version: RankDisplayVersion): RankProgress {
  if (version === 3) return competitiveRank(rating);
  const rank = competitiveRankV4(rating);
  return {
    name: rank.name,
    color: RANK_DEFINITIONS.find((tier) => tier.name === rank.name)!.color,
    division: rank.division,
    label: rank.label,
    minimum: rank.protectedFloor ?? 0,
    nextThreshold: rank.nextThreshold,
    eloToPromotion: rank.eloToPromotion,
    progress: rank.progress,
  };
}
