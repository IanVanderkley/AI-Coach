import { replayRecordedGame } from "./verified-replay.ts";
import type { PracticeSession } from "../practice/history.ts";

export type ReviewScore = {
  score: number | null;
  grade: "S" | "A" | "B" | "C" | "D" | null;
  progress: number;
  good: number;
  mistakes: number;
  uncertain: number;
  focusMove: number | null;
  headline: string;
};

/** Practice learning score only. Never a Ranked rating or claim of player skill. */
export function scorePracticeReview(game: PracticeSession): ReviewScore {
  const replay = replayRecordedGame(game);
  if (replay.status !== (game.outcome === "win" ? "won" : "lost")) {
    throw new Error("The recorded outcome does not match the replay.");
  }
  const opening = replay.frames.findIndex((frame) => frame.move.action === "reveal");
  if (opening < 0) throw new Error("No opening reveal is available.");
  const reviewed = replay.frames.slice(opening + 1).filter((frame) => frame.changed);
  const good = reviewed.filter((frame) => frame.decision === "good").length;
  const mistakes = reviewed.filter((frame) => frame.decision === "mistake");
  const uncertain = reviewed.length - good - mistakes.length;
  const safeCells = game.rows * game.columns - game.mineCount;
  const cleared = replay.finalBoard.filter(
    (cell) => cell.revealed && cell.adjacentMines !== null && !cell.exploded,
  ).length;
  const progress = Math.round((100 * cleared) / safeCells);
  const assessed = good + mistakes.length;
  // Progress contributes 60%; quality of provable post-opening decisions 40%.
  // Unknown decisions are neither rewarded nor punished. No evidence = no grade.
  const score = assessed
    ? Math.round(0.6 * ((100 * cleared) / safeCells) + 0.4 * ((100 * good) / assessed))
    : null;
  const grade =
    score === null
      ? null
      : score >= 90
        ? "S"
        : score >= 78
          ? "A"
          : score >= 65
            ? "B"
            : score >= 50
              ? "C"
              : "D";
  const focus =
    mistakes.find((frame) => frame.status === "lost") ??
    mistakes[0] ??
    reviewed.find((frame) => frame.decision === "good");
  const headline = mistakes.length
    ? "Let's work through the decisions you could improve."
    : good
      ? "Build on the moves you got right."
      : "Not enough evidence to grade this game.";
  return {
    score,
    grade,
    progress,
    good,
    mistakes: mistakes.length,
    uncertain,
    focusMove: focus?.actionNumber ?? null,
    headline,
  };
}
