import { summarizeEvidenceFrames, type EvidenceReport } from "./evidence-report.ts";
import {
  replayRecordedGame,
  type ReplayFrame,
  type ReplayResult,
} from "./verified-replay.ts";
import type { PracticeSession } from "../practice/history.ts";

/** Version for the post-opening Practice review, not an official Ranked rating. */
export const PRACTICE_ANALYSIS_VERSION = 1;

export type PracticeAnalysis = {
  version: typeof PRACTICE_ANALYSIS_VERSION;
  game: PracticeSession;
  replay: ReplayResult;
  opening: number;
  reviewed: readonly ReplayFrame[];
  report: EvidenceReport;
};

/** Validate the recording once, then reuse the same evidence for every review surface.
 * Completed recordings are client-recorded Practice evidence, not authenticated Ranked results.
 * Keep legacy unstamped history readable; mixed stamped/unstamped recordings fail closed.
 */
export function preparePracticeAnalysis(game: PracticeSession): PracticeAnalysis {
  if (game.outcome !== "win" && game.outcome !== "loss") {
    throw new Error("A completed Practice outcome is required.");
  }
  const moves = game.moves;
  if (
    Array.isArray(moves) &&
    moves.some((move) => move && move.afterHash !== undefined) &&
    !moves.every(
      (move) =>
        move &&
        typeof move.afterHash === "string" &&
        /^[0-9a-f]{8}$/.test(move.afterHash),
    )
  ) {
    throw new Error("The Practice recording has missing or invalid checkpoints.");
  }
  const replay = replayRecordedGame(game);
  if (replay.status !== (game.outcome === "win" ? "won" : "lost")) {
    throw new Error("The recorded outcome does not match the replay.");
  }
  const opening = replay.frames.findIndex(
    (frame) => frame.move.action === "reveal" && frame.changed,
  );
  if (opening < 0) throw new Error("No opening reveal is available.");
  const reviewed = replay.frames.slice(opening + 1).filter((frame) => frame.changed);
  const report = summarizeEvidenceFrames(reviewed, game.columns);
  return { version: PRACTICE_ANALYSIS_VERSION, game, replay, opening, reviewed, report };
}
