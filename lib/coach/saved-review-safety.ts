import type { SavedReview, ReviewMode } from "./personalized-review.ts";
import type { ReportMoment } from "./evidence-report.ts";

export type LearningCohort = { mode: ReviewMode; difficulty: "Beginner" | "Intermediate" | "Expert" };

/** Separate history selection from the existing single-game status request. */
export function parseLearningCohort(params: URLSearchParams): LearningCohort | null {
  if (params.size !== 2 || params.getAll("mode").length !== 1 || params.getAll("difficulty").length !== 1) return null;
  const mode = params.get("mode"), difficulty = params.get("difficulty");
  if (mode !== "practice" && mode !== "ranked") return null;
  if (difficulty !== "Beginner" && difficulty !== "Intermediate" && difficulty !== "Expert") return null;
  if (mode === "ranked" && difficulty !== "Intermediate") return null;
  return { mode, difficulty };
}

function displayMoment(value: unknown): value is ReportMoment {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const m = value as Record<string, unknown>;
  return typeof m.id === "string" && m.id.length > 0 &&
    typeof m.moveNumber === "number" && Number.isSafeInteger(m.moveNumber) && m.moveNumber >= 2 && m.moveNumber <= 1000 &&
    (m.kind === "mistake" || m.kind === "good") &&
    typeof m.occurrences === "number" && Number.isSafeInteger(m.occurrences) && m.occurrences >= 1 && m.occurrences <= 1000 &&
    [m.category, m.action, m.location, m.finding, m.evidence, m.nextTime].every(v => typeof v === "string");
}

/** Presentation only. Invoke on a numerically validated review. Missing or malformed
 * optional display fields must not break valid analytics or create a fake finding. */
export function safeSavedReviewPresentation(saved: SavedReview): SavedReview {
  const { score, report } = saved.review;
  const moments: ReportMoment[] = [];
  const seen = new Set<string>();
  if (Array.isArray(report.moments)) for (const value of report.moments) {
    if (!displayMoment(value) || seen.has(value.id)) continue;
    seen.add(value.id);
    moments.push(value);
    if (moments.length === 5) break;
  }
  const grade = score.score !== null && (score.grade === "S" || score.grade === "A" || score.grade === "B" || score.grade === "C" || score.grade === "D") ? score.grade : null;
  return { ...saved, review: { ...saved.review, score: { ...score, grade }, report: { ...report, moments, takeaway: typeof report.takeaway === "string" ? report.takeaway : "Saved teaching text is unavailable. Open the replay to review this game." } } };
}
