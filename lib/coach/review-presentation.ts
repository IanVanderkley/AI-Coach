import type { ReviewScore } from "./review-score.ts";
import type { CoachingStyle, ExplanationDetail } from "../settings/types.ts";

/** Presentation only: never alter a decision, finding, grade or score. */
export function reviewToneSummary(
  review: Pick<ReviewScore, "good" | "mistakes" | "headline">,
  style?: CoachingStyle,
): string {
  const good = review.good;
  const mistakes = review.mistakes;
  const supported = `${good} supported ${good === 1 ? "decision" : "decisions"}`;
  const errors = `${mistakes} verified ${mistakes === 1 ? "mistake" : "mistakes"}`;
  if (style === "encouraging") {
    if (good && mistakes)
      return `You made ${supported}. Build on those as you work through ${errors}.`;
    if (good) return `You made ${supported}. Keep building on that reasoning.`;
    if (mistakes)
      return `You have ${errors} to learn from. Work through one clue at a time.`;
    return "There is not enough evidence to grade these decisions yet. You can still learn from the replay.";
  }
  if (style === "direct") {
    if (mistakes)
      return `${errors.charAt(0).toUpperCase()}${errors.slice(1)}. Review the relevant clues before your next game.`;
    if (good)
      return `${supported.charAt(0).toUpperCase()}${supported.slice(1)}. Repeat the supported deductions.`;
    return "No provable post-opening decisions. Review the recording without a grade.";
  }
  return review.headline;
}

export function explanationLabel(detail: ExplanationDetail): string {
  return detail === "brief"
    ? "brief explanations"
    : detail === "detailed"
      ? "detailed explanations"
      : "standard explanations";
}

/** Keep the complete proof on demand in every mode. Detailed opens technical arithmetic within it. */
export function reviewProofOptions(detail: ExplanationDetail) {
  return { expanded: false, technical: detail === "detailed" };
}
