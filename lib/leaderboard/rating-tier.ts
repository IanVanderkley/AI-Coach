/** Cosmetic rating milestones only. Competitive RP/placements are not enabled. */
export type RatingTier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";

export function ratingTier(value: number): RatingTier {
  if (!Number.isSafeInteger(value) || value < 100 || value > 10000) {
    throw new RangeError("Invalid saved rating.");
  }
  if (value < 900) return "Bronze";
  if (value < 1100) return "Silver";
  if (value < 1300) return "Gold";
  if (value < 1500) return "Platinum";
  return "Diamond";
}

export function ratingTierClass(tier: RatingTier): string {
  return `rating-tier-${tier.toLowerCase()}`;
}
