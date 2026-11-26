import { CheckCircle2, Target, TriangleAlert } from "lucide-react";
import type { ReviewScore } from "@/lib/coach/review-score";
import type { ReportMoment } from "@/lib/coach/evidence-report";
import type { CoachPreferences } from "@/lib/settings/types";
import { reviewToneSummary } from "@/lib/coach/review-presentation";

export function ReviewOverview({
  review,
  preferences,
  focus,
  onReviewMove,
}: {
  review: ReviewScore;
  preferences?: CoachPreferences | null;
  focus?: ReportMoment;
  onReviewMove: (move: number) => void;
}) {
  const focusMove = focus?.moveNumber ?? review.focusMove;
  return (
    <article className="coach-review-overview" aria-label="Post-game feedback">
      <p className="subtle-label">POST-GAME FEEDBACK</p>
      <div className="coach-review-headline">
        <div className="grade-badge" data-grade={review.grade ?? "none"}>
          <span className="grade-letter">{review.grade ?? "—"}</span>
          <span className="grade-score">
            {review.score === null ? "Not graded" : `${review.score}/100`}
          </span>
        </div>
        <div>
          <h2>{reviewToneSummary(review, preferences?.coachingStyle)}</h2>
          <p>
            Practice learning score · based on this recording, not your overall ability.
          </p>
        </div>
      </div>
      <dl className="coach-review-metrics">
        <div>
          <dt>Board cleared</dt>
          <dd>{review.progress}%</dd>
        </div>
        <div>
          <dt>Proven good moves</dt>
          <dd>{review.good}</dd>
        </div>
        <div>
          <dt>Verified mistakes</dt>
          <dd>{review.mistakes}</dd>
        </div>
        <div>
          <dt>Uncertain moves</dt>
          <dd>{review.uncertain}</dd>
        </div>
      </dl>
      <div className="coach-review-focus">
        {review.mistakes ? (
          <TriangleAlert size={19} aria-hidden="true" />
        ) : (
          <CheckCircle2 size={19} aria-hidden="true" />
        )}
        <p>
          {focus
            ? `Suggested lesson: ${focus.category}.`
            : review.mistakes
              ? "Inspect the visible clues behind your mistakes."
              : review.good
                ? "Review the deductions that supported your decisions."
                : "There is not enough evidence to grade the decisions. You can still inspect the replay."}
        </p>
        {focusMove !== null && (
          <button
            type="button"
            className="coach-btn"
            onClick={() => onReviewMove(focusMove!)}
          >
            <Target size={15} aria-hidden="true" /> Review key move
          </button>
        )}
      </div>
      <details>
        <summary>How the score is calculated</summary>
        <p>
          60% of the score is board completion. 40% is the share of provable decisions
          that were good. Move 0 and uncertain choices are not graded as decisions. If no
          later decision can be proved, no score is shown. This is a learning aid, not an
          official rank.
        </p>
      </details>
    </article>
  );
}
