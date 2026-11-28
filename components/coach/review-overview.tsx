import {
  CheckCircle2,
  Target,
  TriangleAlert,
  Play,
  MessageCircleQuestion,
} from "lucide-react";
import type { ReviewScore } from "@/lib/coach/review-score";
import type { ReportMoment } from "@/lib/coach/evidence-report";
import type { CoachPreferences } from "@/lib/settings/types";
import { reviewToneSummary } from "@/lib/coach/review-presentation";

export function ReviewOverview({
  review,
  mode = "practice",
  preferences,
  focus,
  strength,
  onOpenReplay,
  onAskCoach,
  onReviewMove,
}: {
  review: ReviewScore;
  mode?: "practice" | "ranked";
  preferences?: CoachPreferences | null;
  focus?: ReportMoment;
  strength?: ReportMoment;
  onOpenReplay: () => void;
  onAskCoach: () => void;
  onReviewMove: (move: number) => void;
}) {
  const focusMove = focus?.moveNumber ?? review.focusMove;
  return (
    <article className="coach-review-overview" aria-label="Post-game feedback">
      <h2 className="coach-overview-title">Game performance</h2>
      <div className="coach-review-headline">
        <div className="grade-badge" data-grade={review.grade ?? "none"}>
          <span className="grade-letter">{review.grade ?? "—"}</span>
          <span className="grade-score">
            {review.score === null ? "Not graded" : `${review.score}/100`}
          </span>
        </div>
        <div>
          <h3>{reviewToneSummary(review, preferences?.coachingStyle)}</h3>
          <p>
            {mode === "ranked" ? "Ranked" : "Practice"} learning score · based on this
            recording, not your overall ability.
          </p>
        </div>
      </div>
      <dl className="coach-review-metrics">
        <div>
          <dt>Board cleared</dt>
          <dd>{review.progress}%</dd>
          <progress
            className="coach-review-board-progress"
            aria-label="Board cleared"
            max={100}
            value={review.progress}
          />
        </div>
        <div>
          <dt>Good decisions</dt>
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
      {strength && (
        <div className="coach-review-strength">
          <CheckCircle2 size={19} aria-hidden="true" />
          <div>
            <strong>What went well</strong>
            <p>{strength.category}</p>
          </div>
        </div>
      )}
      <div className="coach-review-focus">
        {review.mistakes ? (
          <TriangleAlert size={19} aria-hidden="true" />
        ) : (
          <CheckCircle2 size={19} aria-hidden="true" />
        )}
        <div className="coach-review-lesson-copy">
          <strong>Suggested lesson</strong>
          <p>
            {focus
              ? focus.category
              : review.mistakes
                ? "Inspect the visible clues behind your mistakes."
                : review.good
                  ? "Review the deductions that supported your decisions."
                  : "There is not enough evidence to grade the decisions. You can still inspect the replay."}
          </p>
        </div>
        <div className="coach-review-actions">
          {focusMove !== null && (
            <button
              type="button"
              className="coach-btn"
              onClick={() => onReviewMove(focusMove!)}
            >
              <Target size={15} aria-hidden="true" /> Review lesson
            </button>
          )}
          <button type="button" className="coach-btn secondary" onClick={onOpenReplay}>
            <Play size={15} aria-hidden="true" /> Open replay
          </button>
          <button type="button" className="coach-btn secondary" onClick={onAskCoach}>
            <MessageCircleQuestion size={15} aria-hidden="true" /> Ask your coach
          </button>
        </div>
      </div>
    </article>
  );
}
