import { projectCompletedAnalysis } from "../coach/practice-analysis.ts";
import { scorePreparedReview } from "../coach/review-score.ts";
import type { VerifiedRankedRecording } from "./coaching-recording.ts";

/** Only project a recording after the server-owned reader verifies its ownership,
 * terminal state, move sequence and final board. Never accept this type from JSON.
 * The replay stays internal: the response carries a compact learning summary.
 */
export function summarizeVerifiedRankedReview(result: VerifiedRankedRecording) {
  const analysis = projectCompletedAnalysis(result.data.recording, result.replay);
  return {
    version: analysis.version,
    score: scorePreparedReview(analysis),
    report: analysis.report,
  };
}

export type RankedCoachingReview = ReturnType<typeof summarizeVerifiedRankedReview>;
