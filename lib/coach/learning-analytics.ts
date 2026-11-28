import { MISTAKE_TYPES, REVIEW_WINDOWS, summarizeLearning, type ReviewMode, type SavedReview } from "./personalized-review.ts";
import { PRACTICE_ANALYSIS_VERSION } from "./practice-analysis.ts";

const nonnegative = (value: number) => Number.isSafeInteger(value) && value >= 0;
const percentage = (value: number) => Number.isFinite(value) && value >= 0 && value <= 100;
const rate = (numerator: number, denominator: number) => ({ numerator, denominator, percent: denominator ? 100 * numerator / denominator : null });

/** Validate the counters used by analytics, not recording provenance or authorization. */
function consistentReview(item: SavedReview): boolean {
  const { review, gameRef, completedAt, outcome } = item;
  if (typeof gameRef !== "string" || !gameRef.trim() || typeof completedAt !== "string" || !Number.isFinite(Date.parse(completedAt)) || (outcome !== "win" && outcome !== "loss")) return false;
  const score = review?.score, report = review?.report, moves = review?.mistakeMoves;
  if (!score || !report || !moves) return false;
  const { good, mistakes, uncertain, progress } = score;
  if (![good, mistakes, uncertain].every(nonnegative) || good + mistakes + uncertain > 10000 || !percentage(progress)) return false;
  if (score.score === null ? good + mistakes !== 0 : !percentage(score.score) || good + mistakes === 0) return false;
  if (report.provenGood !== good || report.verifiedMistakes !== mistakes || report.uncertainActions !== uncertain || report.recordedActions !== good + mistakes + uncertain) return false;
  const seen = new Set<number>();
  for (const key of MISTAKE_TYPES) {
    const refs = moves[key];
    if (!Array.isArray(refs) || refs.length > mistakes) return false;
    for (const ref of refs) {
      if (!Number.isSafeInteger(ref) || ref < 2 || ref > 10000 || seen.has(ref)) return false;
      seen.add(ref);
    }
  }
  return seen.size === mistakes;
}

/** Compare only the fields used in the learning summary; duplicate payloads must not inflate it. */
function fingerprint(item: SavedReview) {
  const { score, mistakeMoves } = item.review;
  return JSON.stringify([Date.parse(item.completedAt), item.outcome, score.good, score.mistakes, score.uncertain, score.progress, score.score, ...MISTAKE_TYPES.map(key => [...mistakeMoves[key]].sort((a, b) => a - b))]);
}

/** Private saved-review analytics. Callers must use their existing account-scoped report fetch.
 * No hidden board data, competitive rating, inferred skill score or new replay work.
 */
export function analyzeLearningReviews(reports: readonly SavedReview[], mode: ReviewMode, difficulty: string, windowSize: number) {
  if (!REVIEW_WINDOWS.some(size => size === windowSize) || !["Beginner", "Intermediate", "Expert"].includes(difficulty) || (mode !== "practice" && mode !== "ranked") || (mode === "ranked" && difficulty !== "Intermediate")) throw new Error("Invalid learning cohort or review window.");
  const exclusions = { outsideCohort: 0, otherVersion: 0, invalid: 0, duplicate: 0, conflictingGames: 0, outsideWindow: 0 };
  const unique = new Map<string, { item: SavedReview; signature: string }>();
  const conflicts = new Set<string>();
  for (const item of reports) {
    if (!item || typeof item !== "object") { exclusions.invalid++; continue; }
    if (item.mode !== mode || item.difficulty !== difficulty) { exclusions.outsideCohort++; continue; }
    if (item.version !== PRACTICE_ANALYSIS_VERSION) { exclusions.otherVersion++; continue; }
    if (!consistentReview(item)) { exclusions.invalid++; continue; }
    if (conflicts.has(item.gameRef)) continue;
    const signature = fingerprint(item), previous = unique.get(item.gameRef);
    if (previous) {
      if (previous.signature === signature) exclusions.duplicate++;
      else { unique.delete(item.gameRef); conflicts.add(item.gameRef); }
    } else unique.set(item.gameRef, { item, signature });
  }
  exclusions.conflictingGames = conflicts.size;
  const summary = summarizeLearning([...unique.values()].map(entry => entry.item), mode, difficulty, windowSize);
  exclusions.outsideWindow = unique.size - summary.selected.length;
  const { good, mistakes, uncertain } = summary.metrics;
  const assessed = good + mistakes, observed = assessed + uncertain;
  const games = summary.selected.length;
  const assessedGames = summary.selected.filter(item => item.review.score.good + item.review.score.mistakes > 0).length;
  const gamesWithMistakes = summary.selected.filter(item => item.review.score.mistakes > 0).length;
  return {
    // Reuse the current grouping, scoring and saved-review selection logic.
    ...summary,
    cohort: { mode, difficulty, windowSize, version: PRACTICE_ANALYSIS_VERSION, source: "saved-reviews" as const },
    exclusions,
    evidence: { games, assessedGames, gamesWithoutAssessedDecisions: games - assessedGames, observed, assessed, uncertain, decisionAccuracy: rate(good, assessed), decisionCoverage: rate(assessed, observed), gamesWithMistakes: rate(gamesWithMistakes, games) },
    averageBoardCleared: games ? summary.selected.reduce((sum, item) => sum + item.review.score.progress, 0) / games : null,
    // These are observed mistakes, not missed opportunities for specific techniques.
    patterns: summary.patterns.map(pattern => ({ ...pattern, recurring: pattern.games >= 2, prevalence: rate(pattern.games, games) })),
  };
}
