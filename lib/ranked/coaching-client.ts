import { preparePracticeAnalysis } from "../coach/practice-analysis.ts";
import { scorePreparedReview } from "../coach/review-score.ts";
import type { CompletedRankedRecording } from "./coaching-recording.ts";
import { isRankedRecordingId, RANKED_COACHING_MAX_MOVES } from "./coaching-recording.ts";
import type { RankedCoachingReview } from "./coaching-analysis.ts";

/** Called only on a successful response from the owner-checked Ranked API.
 * Replay locally for the interactive UI, checking the server's grade and evidence.
 * This is a consistency check, not independent proof of server authorization. */
export function prepareRankedReviewResponse(raw: unknown, matchId: string) {
  if (!raw || typeof raw !== "object" || !isRankedRecordingId(matchId))
    throw new Error("Invalid Ranked review.");
  const value = raw as Partial<CompletedRankedRecording> & {
    review?: RankedCoachingReview;
  };
  const game = value.recording;
  if (
    value.source !== "server-recorded-ranked" ||
    value.matchId !== matchId ||
    typeof value.completedAt !== "string" ||
    !Number.isFinite(Date.parse(value.completedAt)) ||
    typeof value.durationMs !== "number" ||
    !Number.isSafeInteger(value.durationMs) ||
    value.durationMs < 0 ||
    !game ||
    game.game !== "minesweeper" ||
    game.difficulty !== "Intermediate" ||
    game.rows !== 16 ||
    game.columns !== 16 ||
    game.mineCount !== 40 ||
    game.durationSeconds !== Math.floor(value.durationMs / 1000) ||
    !Array.isArray(game.moves) ||
    game.moves.length < 1 ||
    game.moves.length > RANKED_COACHING_MAX_MOVES ||
    !value.review
  )
    throw new Error("Invalid Ranked review.");
  const analysis = preparePracticeAnalysis(game);
  const review = scorePreparedReview(analysis);
  if (
    analysis.opening !== 0 ||
    analysis.replay.frames.some((frame) => !frame.changed) ||
    value.review.version !== analysis.version ||
    JSON.stringify(value.review.score) !== JSON.stringify(review) ||
    JSON.stringify(value.review.report) !== JSON.stringify(analysis.report)
  )
    throw new Error("Ranked review is inconsistent. Refresh and try again.");
  return { game, analysis, review };
}
