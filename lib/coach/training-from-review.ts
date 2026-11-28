import {
  prepareTrainingExercise,
  type PreparedTrainingExercise,
  type TrainingCell,
  type TrainingObjective,
} from "./training-exercise.ts";
import type { ReplayFrame } from "./verified-replay.ts";

export const MAX_REVIEW_TRAINING_CHECKS = 4;
export const MAX_REVIEW_TRAINING_EXERCISES = 3;
/** Only the complete pre-move visible snapshot and public geometry cross this
 * boundary. No after-board, true mines, player identifiers or grading updates. */
export function prepareReviewTraining(
  geometry: { rows: number; columns: number; mineCount: number; opening?: number },
  reviewed: readonly ReplayFrame[],
): PreparedTrainingExercise[] {
  const { rows, columns, mineCount } = geometry;
  const opening =
    Number.isSafeInteger(geometry.opening) && geometry.opening! >= 0
      ? geometry.opening!
      : null;
  if (
    !Number.isSafeInteger(rows) ||
    !Number.isSafeInteger(columns) ||
    rows < 2 ||
    columns < 2 ||
    rows > 30 ||
    columns > 30 ||
    rows * columns > 480
  )
    return [];
  const exercises: PreparedTrainingExercise[] = [];
  let checked = 0;
  const seen = new Set<number>();
  for (const frame of reviewed) {
    if (
      !frame.changed ||
      frame.decision !== "mistake" ||
      !frame.mistakeType ||
      !Number.isSafeInteger(frame.actionNumber) ||
      frame.actionNumber < 2 ||
      seen.has(frame.actionNumber)
    )
      continue;
    if (
      checked >= MAX_REVIEW_TRAINING_CHECKS ||
      exercises.length >= MAX_REVIEW_TRAINING_EXERCISES
    )
      break;
    checked++;
    seen.add(frame.actionNumber);
    if (
      frame.before.length !== rows * columns ||
      frame.before.some(
        (cell) =>
          !cell ||
          cell.exploded ||
          (cell.revealed && (cell.flagged || cell.adjacentMines === null)),
      )
    )
      continue;
    const cells: TrainingCell[] = frame.before.map((cell) =>
      cell.revealed ? cell.adjacentMines! : cell.flagged ? "flagged" : "covered",
    );
    const { row, col, action } = frame.move;
    if (
      !Number.isInteger(row) ||
      !Number.isInteger(col) ||
      row < 0 ||
      row >= rows ||
      col < 0 ||
      col >= columns
    )
      continue;
    const index = row * columns + col;
    let objective: TrainingObjective;
    let title: string;
    if (
      frame.mistakeType === "flagged-known-safe" &&
      action === "flag" &&
      cells[index] === "covered"
    ) {
      objective = { kind: "classify-square", index };
      title = "Check the square before flagging";
    } else if (
      frame.mistakeType === "revealed-known-mine" &&
      action === "reveal" &&
      cells[index] === "covered"
    ) {
      objective = { kind: "classify-square", index };
      title = "Check the square before revealing";
    } else if (
      frame.mistakeType === "unnecessary-guess" &&
      (action === "reveal" || action === "chord")
    ) {
      objective = { kind: "reveal-safe" };
      title = "Find a guaranteed-safe alternative";
    } else continue; // A chord on a revealed clue is not a covered-square classification.
    const displayMove =
      opening === null ? frame.actionNumber : frame.actionNumber - opening - 1;
    if (displayMove < 1) continue;
    const result = prepareTrainingExercise({
      version: 1,
      id: `review-move-${frame.actionNumber}`,
      title: `Revisit move ${displayMove}: ${title}`,
      difficulty:
        rows * columns <= 81
          ? "beginner"
          : rows * columns <= 256
            ? "intermediate"
            : "advanced",
      rows,
      columns,
      mineCount,
      cells,
      objective,
    });
    if (!result.ok) continue;
    const { solution } = result.prepared;
    if (
      objective.kind === "classify-square" &&
      (solution.kind !== "classify-square" ||
        solution.classification !==
          (frame.mistakeType === "flagged-known-safe" ? "safe" : "mine"))
    )
      continue;
    // An advanced exact proof can disagree with the earlier, narrower review
    // classification. Do not teach that a proven-safe reveal was a mistake.
    if (
      frame.mistakeType === "unnecessary-guess" &&
      action === "reveal" &&
      result.prepared.squares.find((square) => square.index === index)?.classification !==
        "uncertain"
    )
      continue;
    if (frame.mistakeType === "unnecessary-guess" && action === "chord") {
      // A chord opens every covered, unflagged neighbour. If exact evidence
      // proves all are safe (or proves a mine), this is not an uncertain chord.
      if (typeof cells[index] !== "number") continue;
      const neighbours = result.prepared.squares.filter((square) => {
        const r = Math.floor(square.index / columns),
          c = square.index % columns;
        return (
          square.index !== index &&
          cells[square.index] === "covered" &&
          Math.abs(r - row) <= 1 &&
          Math.abs(c - col) <= 1
        );
      });
      if (
        !neighbours.some((square) => square.classification === "uncertain") ||
        neighbours.some((square) => square.classification === "mine")
      )
        continue;
      // The safer alternative must be outside the uncertain chord.
      if (
        solution.kind !== "select-square" ||
        !solution.indices.some((i) => !neighbours.some((square) => square.index === i))
      )
        continue;
    }
    exercises.push(result.prepared);
  }
  return exercises;
}
