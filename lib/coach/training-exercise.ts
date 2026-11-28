import { calculateComponentProbabilities } from "./component-probabilities.ts";
import { deduceVisibleBoard, type Proof, type VisibleCell } from "./verified-replay.ts";

export const TRAINING_EXERCISE_VERSION = 1;
export const TRAINING_MAX_SIDE = 30;
export type TrainingCell = number | "covered" | "flagged";
export type TrainingDifficulty = "beginner" | "intermediate" | "advanced";
export type TrainingClassification = "safe" | "mine" | "uncertain";
export type TrainingObjective =
  | { kind: "reveal-safe" }
  | { kind: "flag-mine" }
  | { kind: "classify-square"; index: number };
export type TrainingExercise = {
  version: typeof TRAINING_EXERCISE_VERSION;
  id: string;
  title: string;
  difficulty: TrainingDifficulty;
  rows: number;
  columns: number;
  mineCount: number;
  cells: TrainingCell[];
  objective: TrainingObjective;
};
export type TrainingAnswer =
  | { index: number }
  | { classification: TrainingClassification };
type SquareEvidence = {
  index: number;
  classification: TrainingClassification;
  mineLayouts: string;
  proof?: Proof;
};
type Solution =
  | { kind: "select-square"; indices: number[] }
  | { kind: "classify-square"; classification: TrainingClassification };
export type PreparedTrainingExercise = {
  exercise: TrainingExercise;
  totalLayouts: string;
  squares: SquareEvidence[];
  solution: Solution;
};
export type TrainingPreparation =
  | { ok: true; prepared: PreparedTrainingExercise }
  | {
      ok: false;
      reason: "invalid" | "inconsistent" | "limited" | "no-solution" | "proof-conflict";
    };
export type TrainingAssessment = { status: "correct" | "incorrect" | "invalid" };

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const keys = (value: Record<string, unknown>, expected: readonly string[]) =>
  Object.keys(value).length === expected.length &&
  expected.every((key) => Object.hasOwn(value, key));
const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= min &&
  value <= max;
const classification = (value: unknown): value is TrainingClassification =>
  value === "safe" || value === "mine" || value === "uncertain";
const cellValue = (value: unknown): value is TrainingCell =>
  value === "covered" || value === "flagged" || integer(value, 0, 8);

/** Versioned whole-board snapshot, not a cropped replay with a misleading global mine count.
 * Reject unknown fields (including answer keys, mine positions and competitive data). */
export function parseTrainingExercise(value: unknown): TrainingExercise | null {
  if (
    !record(value) ||
    !keys(value, [
      "version",
      "id",
      "title",
      "difficulty",
      "rows",
      "columns",
      "mineCount",
      "cells",
      "objective",
    ]) ||
    value.version !== TRAINING_EXERCISE_VERSION
  )
    return null;
  const { id, title, difficulty, rows, columns, mineCount, cells, objective } = value;
  if (
    typeof id !== "string" ||
    !/^[A-Za-z0-9_-]{1,80}$/.test(id) ||
    typeof title !== "string" ||
    !title.trim() ||
    title.length > 120 ||
    (difficulty !== "beginner" &&
      difficulty !== "intermediate" &&
      difficulty !== "advanced") ||
    !integer(rows, 2, TRAINING_MAX_SIDE) ||
    !integer(columns, 2, TRAINING_MAX_SIDE) ||
    rows * columns > 480 ||
    !integer(mineCount, 0, rows * columns - 1) ||
    !Array.isArray(cells) ||
    cells.length !== rows * columns
  )
    return null;
  // Array.from also visits sparse holes; Array.every alone does not.
  const copied = Array.from(cells);
  if (
    !copied.every(cellValue) ||
    !copied.some((c) => typeof c === "number") ||
    !copied.some((c) => typeof c !== "number") ||
    !record(objective)
  )
    return null;
  let parsedObjective: TrainingObjective;
  if (
    (objective.kind === "reveal-safe" || objective.kind === "flag-mine") &&
    keys(objective, ["kind"])
  )
    parsedObjective = { kind: objective.kind };
  else if (
    objective.kind === "classify-square" &&
    keys(objective, ["kind", "index"]) &&
    integer(objective.index, 0, copied.length - 1) &&
    typeof copied[objective.index] !== "number"
  )
    parsedObjective = { kind: objective.kind, index: objective.index };
  else return null;
  return {
    version: TRAINING_EXERCISE_VERSION,
    id,
    title: title.trim(),
    difficulty,
    rows,
    columns,
    mineCount,
    cells: copied,
    objective: parsedObjective,
  };
}

export function trainingVisibleBoard(exercise: TrainingExercise): VisibleCell[] {
  return exercise.cells.map((cell) => ({
    revealed: typeof cell === "number",
    flagged: cell === "flagged",
    adjacentMines: typeof cell === "number" ? cell : null,
    exploded: false,
  }));
}

/** Exact enumeration must establish a nonempty set of compatible full layouts.
 * No partial enumeration or hidden layout can authorize an answer. Rule proofs
 * are optional explanation certificates and must agree with exact counts. */
export function prepareTrainingExercise(value: unknown): TrainingPreparation {
  const exercise = parseTrainingExercise(value);
  if (!exercise) return { ok: false, reason: "invalid" };
  const { rows, columns, mineCount, objective } = exercise;
  const board = trainingVisibleBoard(exercise);
  const exact = calculateComponentProbabilities(rows, columns, mineCount, board);
  if (exact.status !== "complete")
    return {
      ok: false,
      reason:
        exact.status === "limited"
          ? "limited"
          : exact.status === "inconsistent"
            ? "inconsistent"
            : "invalid",
    };
  const total = BigInt(exact.totalLayouts);
  if (total <= BigInt(0)) return { ok: false, reason: "inconsistent" };
  const deductions = deduceVisibleBoard(rows, columns, mineCount, board, true, true);
  const squares: SquareEvidence[] = exact.squares.map((square) => ({
    ...square,
    classification:
      square.mineLayouts === "0"
        ? "safe"
        : square.mineLayouts === exact.totalLayouts
          ? "mine"
          : "uncertain",
  }));
  const byIndex = new Map(squares.map((square) => [square.index, square]));
  for (const kind of ["safe", "mine"] as const) {
    for (const proof of kind === "safe" ? deductions.safe : deductions.mines) {
      const square = byIndex.get(proof.index);
      if (!square || square.classification !== kind)
        return { ok: false, reason: "proof-conflict" };
      square.proof = proof;
    }
  }
  let solution: Solution;
  if (objective.kind === "classify-square") {
    const square = byIndex.get(objective.index);
    if (!square) return { ok: false, reason: "invalid" };
    solution = { kind: "classify-square", classification: square.classification };
  } else {
    const target = objective.kind === "reveal-safe" ? "safe" : "mine";
    // An existing flag is not a reveal or a new flag action. Classification
    // exercises can still ask whether a flagged square is logically justified.
    const indices = squares
      .filter(
        (square) => square.classification === target && !board[square.index].flagged,
      )
      .map((square) => square.index);
    if (!indices.length) return { ok: false, reason: "no-solution" };
    solution = { kind: "select-square", indices };
  }
  return {
    ok: true,
    prepared: { exercise, totalLayouts: exact.totalLayouts, squares, solution },
  };
}

/** This accepts only a locally prepared exercise. For future persisted attempts,
 * a server must prepare the trusted exercise again, never accept a client result. */
export function assessTrainingAnswer(
  prepared: PreparedTrainingExercise,
  answer: unknown,
): TrainingAssessment {
  if (!record(answer)) return { status: "invalid" };
  const { exercise, solution } = prepared;
  if (solution.kind === "classify-square") {
    if (!keys(answer, ["classification"]) || !classification(answer.classification))
      return { status: "invalid" };
    return {
      status: answer.classification === solution.classification ? "correct" : "incorrect",
    };
  }
  if (
    !keys(answer, ["index"]) ||
    !integer(answer.index, 0, exercise.cells.length - 1) ||
    exercise.cells[answer.index] !== "covered"
  )
    return { status: "invalid" };
  return { status: solution.indices.includes(answer.index) ? "correct" : "incorrect" };
}
