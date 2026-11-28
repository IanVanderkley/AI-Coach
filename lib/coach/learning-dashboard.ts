import { analyzeLearningReviews } from "./learning-analytics.ts";
import { buildLearningTrends } from "./learning-trends.ts";
import { recommendLearning } from "./learning-recommendations.ts";
import type { ReviewMode, SavedReview } from "./personalized-review.ts";

/** The existing account-scoped reports endpoint returns saved summaries, not
 * action-specific evidence. Do not derive skill percentages from those summaries.
 * All three views use exactly the same validated saved-review cohort. */
export function buildLearningDashboard(reports: readonly SavedReview[], mode: ReviewMode, difficulty: string, windowSize: number) {
  const learning = analyzeLearningReviews(reports, mode, difficulty, windowSize);
  const trends = buildLearningTrends(learning.selected, mode, difficulty, windowSize);
  const recommendation = recommendLearning(learning.selected.map(saved => ({ saved })), mode, difficulty, windowSize);
  // Keep the original meter contract, but use the validated, unrounded rate.
  // Both the text and the meter must represent the same observed decisions.
  return {
    learning: {
      ...learning,
      metrics: { ...learning.metrics, accuracy: learning.evidence.decisionAccuracy.percent },
    },
    trends,
    recommendation,
  };
}
export type LearningDashboard = ReturnType<typeof buildLearningDashboard>;
export function formatLearningPercent(value: number | null): string {
  return value === null ? "Not enough data" : `${Number(value.toFixed(1))}%`;
}
export function formatLearningChange(value: number | null): string {
  if (value === null) return "Not enough data";
  const rounded = Number(value.toFixed(1));
  return `${rounded > 0 ? "+" : ""}${rounded} pp`;
}
export function trendAvailability(comparison: LearningDashboard["trends"]["comparison"]): string {
  switch (comparison.reason) {
    case "too-few-games": return "Needs at least 10 comparable saved reviews.";
    case "overlapping-timestamps": return "These review periods overlap in time.";
    case "too-few-assessed-decisions": return "Each period needs five assessed games and at least 20 assessed decisions.";
    default: return "Recent vs. earlier reviews; observed performance, not a mastery rating.";
  }
}
