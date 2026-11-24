import { CheckCircle2, Target, TriangleAlert } from "lucide-react";
import type { ReviewScore } from "@/lib/coach/review-score";

export function ReviewOverview({
  review,
  onReviewMove,
}: {
  review: ReviewScore;
  onReviewMove: (move: number) => void;
}) {
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
          <h2>{review.headline}</h2>
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
          {review.mistakes
            ? "See the exact clues you missed, and learn how to find the safer move next time."
            : review.good
              ? "See the rules behind your successful decisions and practice them again."
              : "The coach cannot prove enough about your choices to give a fair score. You can still inspect the replay."}
        </p>
        {review.focusMove !== null && (
          <button
            type="button"
            className="coach-btn"
            onClick={() => onReviewMove(review.focusMove!)}
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
