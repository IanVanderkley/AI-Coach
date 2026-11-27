import type { CoachResult, CoachMistake, CoachMoveRef } from "./types";
import type { PracticeAnalysis } from "./practice-analysis.ts";
import { scorePreparedPracticeReview } from "./review-score.ts";
import { explainMove } from "./teaching-review.ts";
import { coachingLead, practicePrompt, prioritizeMoments } from "./visual-coaching.ts";
import type { CoachPreferences } from "../settings/types";

/** Adapt the shared evidence to the older post-game report shape, without a second
 * solver or a provider-generated gameplay claim. All move IDs remain raw recording IDs.
 */
export function coachPreparedPractice(
  analysis: PracticeAnalysis,
  preferences?: CoachPreferences | null,
): CoachResult {
  const { game, replay, report } = analysis;
  const score = scorePreparedPracticeReview(analysis);
  const ordered = prioritizeMoments(report, preferences);
  const focus = ordered[0];
  const limit = preferences?.explanationDetail === "brief" ? 2 : 5;
  const ref = (index: number): CoachMoveRef => ({
    row: Math.floor(index / game.columns),
    col: index % game.columns,
  });
  const mistakeMoments = ordered.filter((moment) => moment.kind === "mistake");
  const mistakes: CoachMistake[] = mistakeMoments.slice(0, limit).map((moment) => {
    const frame = replay.frames[moment.moveNumber - 1];
    const explanation = explainMove(frame, game.rows, game.columns, game.mineCount);
    const kind =
      frame.mistakeType === "revealed-known-mine"
        ? "proven-mine"
        : frame.mistakeType === "flagged-known-safe"
          ? "wrong-flag"
          : frame.status === "lost"
            ? "fatal-guess"
            : "avoidable-guess";
    return {
      moveNumber: moment.moveNumber,
      row: frame.move.row,
      col: frame.move.col,
      kind,
      title: moment.category,
      why: [moment.finding, moment.evidence].join(" "),
      fix: explanation.nextStep || moment.nextTime,
      betterMove:
        explanation.recommendation === null ? null : ref(explanation.recommendation),
      clues: explanation.clues.map(ref),
    };
  });
  const frame = focus ? replay.frames[focus.moveNumber - 1] : null;
  return {
    report: {
      headline: coachingLead(focus, preferences),
      grade: score.grade,
      score: score.score,
      summary: `Reviewed ${report.recordedActions} post-opening actions: ${report.provenGood} proven good, ${report.verifiedMistakes} proven mistakes, ${report.uncertainActions} unresolved. ${score.progress}% of safe squares cleared.`,
      strengths: ordered
        .filter((moment) => moment.kind === "good")
        .slice(0, limit)
        .map((moment) => moment.finding),
      improvements: mistakeMoments.slice(0, limit).map((moment) => moment.finding),
      keyMoment:
        focus && frame
          ? {
              moveNumber: focus.moveNumber,
              row: frame.move.row,
              col: frame.move.col,
              description: focus.finding,
              why: focus.evidence,
            }
          : null,
      nextSteps: focus
        ? [focus.nextTime, practicePrompt(preferences)]
        : [practicePrompt(preferences)],
      mistakes,
      metrics: null,
      source: "rules",
      model: null,
      notes: [
        report.caveat,
        "Grade uses the shared Practice learning score. No provable post-opening decision means no grade.",
      ],
    },
    fallbackReason: null,
  };
}
