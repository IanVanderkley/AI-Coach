import {
  deduceVisibleBoard,
  type Proof,
  type ProofDerivation,
  type VisibleCell,
} from "./verified-replay.ts";
import type { TeachingExplanation } from "./teaching-review.ts";

export type SquareClassification =
  | "proven-safe"
  | "proven-mine"
  | "unresolved"
  | "revealed";
export type SquareAnalysis = {
  classification: SquareClassification;
  summary: string;
  flagNote: string | null;
  explanation: TeachingExplanation;
};

/** One traced solve per visible snapshot, independent of the inspected index. */
export function prepareSquareAnalysis(
  board: readonly VisibleCell[],
  rows: number,
  columns: number,
  mineCount: number,
) {
  // The solver assumes all revealed squares are safe. A terminal mine reveal
  // violates that assumption; never generate proofs from that snapshot.
  const terminal = board.some(
    (cell) => cell.exploded || (cell.revealed && cell.adjacentMines === null),
  );
  const deductions = terminal
    ? { safe: [], mines: [] }
    : deduceVisibleBoard(rows, columns, mineCount, board, true);
  const safe = new Set(deductions.safe.map((proof) => proof.index));
  const mines = new Set(deductions.mines.map((proof) => proof.index));
  const proofs = new Map(
    [...deductions.safe, ...deductions.mines].map((proof) => [proof.index, proof]),
  );
  return { board, columns, terminal, safe, mines, proofs };
}

type SquareContext = ReturnType<typeof prepareSquareAnalysis>;
const label = (index: number, columns: number) =>
  `row ${Math.floor(index / columns) + 1}, column ${(index % columns) + 1}`;

/** Extract dependencies in order, without inferring anything from later snapshots. */
function proofChain(root: Proof, proofs: ReadonlyMap<number, Proof>) {
  const steps: ProofDerivation[] = [];
  const emitted = new Set<ProofDerivation>();
  const visited = new Set<number>();
  const visiting = new Set<number>();
  function visit(proof: Proof): boolean {
    if (visited.has(proof.index)) return true;
    if (visiting.has(proof.index) || !proof.derivation) return false;
    visiting.add(proof.index);
    for (const index of proof.derivation.dependencies) {
      const dependency = proofs.get(index);
      if (!dependency || !visit(dependency)) return false;
    }
    visiting.delete(proof.index);
    visited.add(proof.index);
    if (!emitted.has(proof.derivation)) {
      emitted.add(proof.derivation);
      steps.push(proof.derivation);
    }
    return true;
  }
  return visit(root) ? steps : [];
}

export function explainSquare(
  context: SquareContext,
  index: number,
): SquareAnalysis | null {
  const { board, columns, terminal, safe, mines, proofs } = context;
  if (!Number.isSafeInteger(index) || index < 0 || index >= board.length) return null;
  const cell = board[index];
  const where = label(index, columns);
  let classification: SquareClassification = "unresolved";
  let summary: string;
  let steps: ProofDerivation[] = [];
  if (cell.revealed) {
    classification = "revealed";
    const count = cell.adjacentMines;
    summary =
      cell.exploded || count === null
        ? `The mine at ${where} is already exposed in this snapshot. That is an observed outcome, not a deduction.`
        : `The revealed ${count} at ${where} tells you that exactly ${count} ${count === 1 ? "mine touches" : "mines touch"} this square, including diagonals. The square itself is already open and safe.`;
  } else if (terminal) {
    summary =
      "This is a terminal board with exposed mines. New deductions are not calculated from it.";
  } else {
    const proof = proofs.get(index);
    steps = proof ? proofChain(proof, proofs) : [];
    if (steps.length && safe.has(index) && !mines.has(index)) {
      classification = "proven-safe";
      summary = `The available clues prove that ${where} contains no mine. ${proof!.reason}`;
    } else if (steps.length && mines.has(index) && !safe.has(index)) {
      classification = "proven-mine";
      summary = `The available clues prove that ${where} contains a mine. ${proof!.reason}`;
    } else {
      steps = [];
      summary = `The current solver cannot prove whether ${where} contains a mine using the information in this snapshot. This does not mean a guess is unavoidable or that the odds are 50/50.`;
    }
  }
  const flagNote =
    cell.flagged && !cell.revealed
      ? classification === "proven-safe"
        ? "This player flag is contradicted by the proof: the square is safe."
        : classification === "proven-mine"
          ? "This player flag is supported by an independent logical proof."
          : "This is a player flag, not proof of a mine. Its correctness is unresolved by the solver."
      : null;
  const clues = [...new Set(steps.flatMap((step) => step.clues))];
  return {
    classification,
    summary,
    flagNote,
    explanation: {
      summary,
      nextStep: "",
      steps,
      clues,
      targets: steps.length ? [index] : [],
      recommendation: null,
      board,
      columns,
    },
  };
}
