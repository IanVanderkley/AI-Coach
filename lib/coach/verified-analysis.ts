import { summarizeEvidenceFrames, type EvidenceReport } from "./evidence-report.ts";
import { preparePracticeAnalysis, type PracticeAnalysis } from "./practice-analysis.ts";
import { parseVerifiedPracticeRecording } from "./verified-brief.ts";
import type { PracticeSession } from "../practice/history";

export type VerifiedAnalysis =
  | {
      ok: true;
      game: PracticeSession;
      report: EvidenceReport;
      analysis: PracticeAnalysis;
    }
  | { ok: false; status: 400 | 422; error: string };

/** A supplied checkpoint, even an invalid one, opts into strict validation. */
export function hasMoveCheckpoints(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || !("moves" in raw)) return false;
  return (
    Array.isArray(raw.moves) &&
    raw.moves.some(
      (move: unknown) =>
        move !== null &&
        typeof move === "object" &&
        Object.prototype.hasOwnProperty.call(move, "afterHash"),
    )
  );
}

/**
 * Shared deterministic boundary for completed checkpointed Practice recordings.
 * Verification means replay consistency, not server-authenticated Ranked history.
 * Never expose raw replay exceptions, mine layouts or untrusted instructions.
 */
export function prepareVerifiedAnalysis(raw: unknown): VerifiedAnalysis {
  let game: PracticeSession;
  try {
    game = parseVerifiedPracticeRecording(raw);
  } catch {
    return {
      ok: false,
      status: 400,
      error:
        "The Practice recording is missing or invalid, or a move checkpoint is absent.",
    };
  }
  try {
    const analysis = preparePracticeAnalysis(game);
    const report = summarizeEvidenceFrames(
      analysis.replay.frames,
      game.columns,
      game.moves.length,
    );
    return { ok: true, game, report, analysis };
  } catch {
    return {
      ok: false,
      status: 422,
      error:
        "The Practice recording did not match its visible-board checkpoints or final outcome.",
    };
  }
}
