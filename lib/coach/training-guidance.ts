import { assessTrainingAnswer, type PreparedTrainingExercise, type TrainingAnswer } from "./training-exercise.ts";
import type { ProofDerivation } from "./verified-replay.ts";

/** Human-readable, one-based coordinates for every training surface. */
export const trainingPositionLabel = (index: number, columns: number) => `row ${Math.floor(index / columns) + 1}, column ${index % columns + 1}`;
/** Translate solver notation only at the presentation boundary; leave proofs intact. */
export function formatTrainingCoordinates(text: string): string {
  return text.replace(/\bR(\d+)C(\d+)\b/g, (_match, row: string, column: string) => `row ${row}, column ${column}`);
}
function describeSquare(prepared: PreparedTrainingExercise, index: number): string {
  const square = prepared.squares.find(s => s.index === index);
  if (!square) return "That square is not an eligible covered square.";
  const where = trainingPositionLabel(index, prepared.exercise.columns).replace(/^row/, "Row");
  if (square.classification === "uncertain") return `${where} is uncertain: there are compatible mine layouts in which it contains a mine and others in which it is safe. The clues do not guarantee either outcome. Uncertain does not mean a 50/50 chance.`;
  return `${where} is guaranteed ${square.classification === "mine" ? "to contain a mine" : "safe"}: ${square.classification === "mine" ? "every" : "no"} compatible mine layout places a mine there.`;
}

/** Explain the submitted square, not an unrelated example. No new solver work. */
export function explainTrainingAnswer(prepared: PreparedTrainingExercise, answer: TrainingAnswer): string | null {
  if (assessTrainingAnswer(prepared, answer).status === "invalid") return null;
  const index = "index" in answer ? answer.index : prepared.exercise.objective.kind === "classify-square" ? prepared.exercise.objective.index : -1;
  const square = prepared.squares.find(s => s.index === index);
  return `${describeSquare(prepared, index)}${square?.proof ? ` ${formatTrainingCoordinates(square.proof.reason)}` : ""}${prepared.exercise.cells[index] === "flagged" ? " A flag is only a player mark, not a proof." : ""}`;
}

/** Trace the solver's already verified dependencies in order. A missing or cyclic
 * certificate must fall back to exact-layout reasoning, never an invented proof. */
function trace(prepared: PreparedTrainingExercise, index: number): ProofDerivation[] {
  const proofs = new Map(prepared.squares.map(s => [s.index, s.proof]));
  const visited = new Set<number>(), active = new Set<number>();
  const steps: ProofDerivation[] = [];
  function visit(i: number): boolean {
    if (visited.has(i)) return true;
    const step = proofs.get(i)?.derivation;
    if (!step || active.has(i)) return false;
    active.add(i);
    for (const dependency of step.dependencies) if (!visit(dependency)) return false;
    active.delete(i); visited.add(i); steps.push(step); return true;
  }
  return visit(index) ? steps : [];
}
export function trainingGuidance(prepared: PreparedTrainingExercise, correctAnswer?: TrainingAnswer) {
  const { exercise, solution } = prepared;
  const index = exercise.objective.kind === "classify-square" ? exercise.objective.index :
    correctAnswer && "index" in correctAnswer && assessTrainingAnswer(prepared, correctAnswer).status === "correct" ? correctAnswer.index :
    solution.kind === "select-square" ? solution.indices[0] : -1;
  const square = prepared.squares.find(s => s.index === index);
  const steps = trace(prepared, index);
  const first = steps[0];
  const validClue = (i: number) => typeof exercise.cells[i] === "number";
  const clues = [...new Set(steps.flatMap(step => step.clues))].filter(validClue);
  const groups = first?.visual?.groups ?? first?.overlap?.groups ?? [];
  const related = [...new Set(groups.flatMap(group => group.cells))].filter(i => exercise.cells[i] === "covered" || exercise.cells[i] === "flagged");
  const locate = first?.clues.filter(validClue) ?? [];
  const hint1 = locate.length ? `Start with ${locate.map(i => trainingPositionLabel(i, exercise.columns)).join(" and ")}. Count the covered neighbours, including diagonals.` : "Use the visible numbers and the total mine count together. A flag is not proof.";
  const hint2 = groups.length ? groups.map(group => `${group.clue === null ? "The total mine count" : `Clue ${trainingPositionLabel(group.clue, exercise.columns)}`} requires ${group.remainingMines} ${group.remainingMines === 1 ? "mine" : "mines"} among ${group.cells.length} unresolved ${group.cells.length === 1 ? "square" : "squares"} after accounting for any proven cells.`).join(" ") : "Consider all mine placements that satisfy every revealed number and the total mine count. Can the square be both safe and mined in different valid placements?";
  return { index, clues, locate, related, hint1, hint2, conclusion: describeSquare(prepared, index), steps: steps.map(step => ({ ...step, title: formatTrainingCoordinates(step.title), text: formatTrainingCoordinates(step.text) })), flagNote: exercise.cells[index] === "flagged" ? "The existing flag is a mark, not proof." : null, classification: square?.classification };
}
