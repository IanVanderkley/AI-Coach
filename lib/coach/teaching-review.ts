import {
  deduceVisibleBoard,
  type Proof,
  type ProofDerivation,
  type ReplayFrame,
  type VisibleCell,
} from "./verified-replay.ts";
import type { EvidenceReport } from "./evidence-report.ts";
import { preparePracticeAnalysis, type PracticeAnalysis } from "./practice-analysis.ts";
import { recommendedReveal } from "./visual-coaching.ts";
import type { PracticeSession } from "../practice/history.ts";

export function openingIndex(moves: readonly { action: string }[]) {
  return Math.max(
    0,
    moves.findIndex((move) => move.action === "reveal"),
  );
}
export function displayMoveNumber(
  moves: readonly { action: string }[],
  rawMoveNumber: number,
) {
  return rawMoveNumber - openingIndex(moves) - 1;
}
export function timelineMove(position: number, last: number) {
  return Math.max(
    0,
    Math.min(last, Math.round(Number.isFinite(position) ? position : 0)),
  );
}
export function cellLabel(index: number, columns: number) {
  return `row ${Math.floor(index / columns) + 1}, column ${(index % columns) + 1}`;
}

export type TeachingExplanation = {
  summary: string;
  nextStep: string;
  steps: ProofDerivation[];
  clues: number[];
  targets: number[];
  recommendation: number | null;
  board: readonly VisibleCell[];
  columns: number;
};

/** Expand only proofs obtained from the BEFORE board, never the actual mine layout. */
export function explainMove(
  frame: ReplayFrame,
  rows: number,
  columns: number,
  mineCount: number,
): TeachingExplanation {
  const empty: TeachingExplanation = {
    summary: frame.explanation,
    nextStep: "",
    steps: [],
    clues: [],
    targets: [],
    recommendation: null,
    board: frame.before,
    columns,
  };
  if (!frame.changed || frame.decision === "not-enough-evidence") return empty;
  const chosen = frame.move.row * columns + frame.move.col;
  const recommendation = recommendedReveal(frame);
  const isChord = frame.move.action === "chord";
  const adjacent = (index: number) =>
    index !== chosen &&
    Math.abs(Math.floor(index / columns) - frame.move.row) <= 1 &&
    Math.abs((index % columns) - frame.move.col) <= 1 &&
    !frame.before[index].revealed &&
    !frame.before[index].flagged;
  const traced = deduceVisibleBoard(rows, columns, mineCount, frame.before, true);
  let proofs: Proof[] = [];
  let summary = frame.explanation;
  let nextStep = "";
  if (frame.mistakeType === "unnecessary-guess") {
    const alternative =
      traced.safe.find((p) => p.index === recommendation) ??
      traced.safe.find((p) => p.index !== chosen);
    if (alternative) {
      proofs = [alternative];
      const where = cellLabel(alternative.index, columns);
      summary =
        "You took a risk while there was a safe move you could work out first. The clues did not prove your chosen move safe. The lesson below shows how to find the safer option.";
      nextStep = frame.before[alternative.index].flagged
        ? `Before guessing, look for a square the clues prove safe. Here, remove the flag at ${where} and reveal it. Use the newly opened area to look for more clues.`
        : `Before guessing, compare the nearby numbers. If they prove a square safe, open it first. Here, that is ${where}. Use the newly opened area to find your next move.`;
    }
  } else if (frame.mistakeType === "revealed-known-mine") {
    proofs = traced.mines.filter((p) =>
      isChord ? adjacent(p.index) : p.index === chosen,
    );
    if (proofs.length) {
      summary = `The visible clues already proved ${cellLabel(proofs[0].index, columns)} contained a mine.`;
      nextStep = isChord
        ? "Do not chord this number yet. Check which neighboring flags are actually proven and correct the flags before opening adjacent squares."
        : `Do not reveal ${cellLabel(proofs[0].index, columns)}. Flag it if your flag limit allows, then look for a proven-safe square.`;
    }
  } else if (frame.mistakeType === "flagged-known-safe") {
    proofs = traced.safe.filter((p) => p.index === chosen);
    nextStep = `Remove the flag at ${cellLabel(chosen, columns)} and reveal that proven-safe square.`;
  } else if (frame.decision === "good") {
    proofs =
      frame.move.action === "flag"
        ? traced.mines.filter((p) => p.index === chosen)
        : traced.safe.filter((p) => (isChord ? adjacent(p.index) : p.index === chosen));
    nextStep = isChord
      ? "Before another chord, check that every covered, unflagged neighbor is proven safe."
      : frame.move.action === "flag"
        ? "Keep marking mines only when the surrounding clues prove them."
        : "Read the newly revealed number and repeat the deduction on neighboring covered squares.";
  }
  const byIndex = new Map([...traced.safe, ...traced.mines].map((p) => [p.index, p]));
  const steps: ProofDerivation[] = [];
  const visited = new Set<number>();
  const emitted = new Set<ProofDerivation>();
  const clues = new Set<number>();
  function visit(proof: Proof) {
    if (visited.has(proof.index)) return;
    visited.add(proof.index);
    const derivation = proof.derivation;
    if (!derivation) return;
    for (const index of derivation.dependencies) {
      const dependency = byIndex.get(index);
      if (dependency) visit(dependency);
    }
    if (!emitted.has(derivation)) {
      emitted.add(derivation);
      steps.push(derivation);
      derivation.clues.forEach((index) => clues.add(index));
    }
  }
  proofs.forEach(visit);
  return {
    summary,
    nextStep,
    steps,
    clues: [...clues],
    targets: proofs.map((p) => p.index),
    recommendation,
    board: frame.before,
    columns,
  };
}

/** The UI uses zero-based teaching moves; persisted recordings and API IDs stay unchanged. */
export function buildTeachingReview(game: PracticeSession) {
  return buildPreparedTeachingReview(preparePracticeAnalysis(game));
}

/** Reuse a checked recording, grouping only the decisions shown in this review. */
export function buildPreparedTeachingReview(analysis: PracticeAnalysis) {
  const { game, replay, report: localReport } = analysis;
  const moments = localReport.moments;
  const explanations = new Map(
    moments.map((moment) => [
      moment.id,
      explainMove(
        replay.frames[moment.moveNumber - 1],
        game.rows,
        game.columns,
        game.mineCount,
      ),
    ]),
  );
  const followUpReport: EvidenceReport = {
    ...localReport,
    moments: moments.map((moment) => {
      const explanation = explanations.get(moment.id);
      return {
        ...moment,
        moveNumber: moment.moveNumber - analysis.opening - 1,
        evidence: explanation?.steps.length
          ? explanation.steps.map((step) => `${step.title}: ${step.text}`).join("\n")
          : moment.evidence,
        nextTime: explanation?.nextStep || moment.nextTime,
      };
    }),
  };
  return { report: localReport, followUpReport, explanations };
}
