import { analyzeLearningReviews } from "./learning-analytics.ts";
import {
  MISTAKE_TYPES,
  type ReviewMode,
  type SavedReview,
} from "./personalized-review.ts";

export const TREND_MIN_GAMES = 5;
export const TREND_MIN_ASSESSED = 20;
export const TREND_ROLLING_GAMES = 5;
const rate = (numerator: number, denominator: number) => ({
  numerator,
  denominator,
  percent: denominator ? (100 * numerator) / denominator : null,
});
const delta = (recent: number | null, older: number | null) =>
  recent === null || older === null ? null : recent - older;

/** Aggregate exact move counts; board clearance is the mean of the recorded
 * per-game clearance percentages, not a pooled count of cleared cells. */
function period(items: readonly SavedReview[]) {
  let supported = 0,
    mistakes = 0,
    uncertain = 0,
    assessedGames = 0,
    clearance = 0;
  for (const item of items) {
    const s = item.review.score;
    supported += s.good;
    mistakes += s.mistakes;
    uncertain += s.uncertain;
    clearance += s.progress;
    if (s.good + s.mistakes > 0) assessedGames++;
  }
  const assessed = supported + mistakes,
    observed = assessed + uncertain;
  return {
    games: items.length,
    assessedGames,
    supported,
    mistakes,
    uncertain,
    assessed,
    observed,
    from: items[0]?.completedAt ?? null,
    to: items.at(-1)?.completedAt ?? null,
    accuracy: rate(supported, assessed),
    coverage: rate(assessed, observed),
    averageBoardCleared: items.length ? clearance / items.length : null,
    mistakePatterns: MISTAKE_TYPES.map((key) => {
      const counts = items.map((item) => item.review.mistakeMoves[key].length);
      const games = counts.filter((n) => n > 0).length;
      return {
        key,
        occurrences: counts.reduce((a, b) => a + b, 0),
        games,
        prevalence: rate(games, items.length),
      };
    }),
  };
}

/** Historical observations, not a skill estimate or causal/statistical claim.
 * Reuse the accepted owned-review cohort: no replay, hidden layout or AI access.
 * Oldest to newest points. Windows never compare different modes/difficulties.
 */
export function buildLearningTrends(
  reports: readonly SavedReview[],
  mode: ReviewMode,
  difficulty: string,
  windowSize: number,
) {
  const learning = analyzeLearningReviews(reports, mode, difficulty, windowSize);
  const ordered = [...learning.selected].reverse();
  const points = ordered.map((item, i) => ({
    gameRef: item.gameRef,
    completedAt: item.completedAt,
    outcome: item.outcome,
    game: period([item]),
    // A full trailing window only; no future observations or zero-filled gaps.
    rolling:
      i + 1 >= TREND_ROLLING_GAMES
        ? period(ordered.slice(i + 1 - TREND_ROLLING_GAMES, i + 1))
        : null,
  }));
  const half = Math.floor(ordered.length / 2);
  const older = period(ordered.slice(0, half));
  const recent = period(ordered.slice(ordered.length - half));
  // Equal timestamps across the boundary cannot establish temporal order.
  const distinctPeriods =
    older.to !== null &&
    recent.from !== null &&
    Date.parse(older.to) < Date.parse(recent.from);
  const comparable = half >= TREND_MIN_GAMES && distinctPeriods;
  const enoughAccuracy =
    comparable &&
    [older, recent].every(
      (p) => p.assessedGames >= TREND_MIN_GAMES && p.assessed >= TREND_MIN_ASSESSED,
    );
  const reason =
    half < TREND_MIN_GAMES
      ? "too-few-games"
      : !distinctPeriods
        ? "overlapping-timestamps"
        : !enoughAccuracy
          ? "too-few-assessed-decisions"
          : null;
  return {
    cohort: learning.cohort,
    exclusions: learning.exclusions,
    points,
    totalGames: ordered.length,
    comparison: {
      older,
      recent,
      middleGamesExcluded: ordered.length - half * 2,
      comparable,
      enoughAccuracy,
      reason,
      accuracyChange: enoughAccuracy
        ? delta(recent.accuracy.percent, older.accuracy.percent)
        : null,
      coverageChange: comparable
        ? delta(recent.coverage.percent, older.coverage.percent)
        : null,
      boardClearedChange: comparable
        ? delta(recent.averageBoardCleared, older.averageBoardCleared)
        : null,
      mistakePrevalenceChanges: older.mistakePatterns.map((p, i) => ({
        key: p.key,
        change: comparable
          ? delta(recent.mistakePatterns[i].prevalence.percent, p.prevalence.percent)
          : null,
      })),
    },
    caveat:
      "Changes describe these saved games only. Decision accuracy excludes uncertain actions; compare evidence coverage alongside it. These are not mastery ratings or statistical proof of improvement.",
  };
}
