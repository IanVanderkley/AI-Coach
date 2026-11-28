import { prepareTrainingExercise, assessTrainingAnswer, type TrainingExercise, type TrainingObjective, type PreparedTrainingExercise, type TrainingAnswer, type TrainingAssessment } from "./training-exercise.ts";

// Complete visible boards only. No solution indices, mine layouts or authored grades.
const make = (id: string, title: string, difficulty: TrainingExercise["difficulty"], rows: number, columns: number, mineCount: number, cells: TrainingExercise["cells"], objective: TrainingObjective): TrainingExercise => ({ version: 1, id, title, difficulty, rows, columns, mineCount, cells, objective });
const C = "covered", F = "flagged";
const starterExercises = [
  make("starter-mine", "Find a guaranteed mine", "beginner", 3, 3, 1, [1,C,C,1,1,1,0,0,0], { kind: "flag-mine" }),
  make("starter-safe", "Find a guaranteed-safe square", "beginner", 3, 3, 1, [1,C,C,1,1,1,0,0,0], { kind: "reveal-safe" }),
  make("starter-uncertain", "Recognize uncertainty", "beginner", 2, 2, 1, [1,C,C,C], { kind: "classify-square", index: 1 }),
  make("starter-compare-safe", "Compare neighbouring clues", "intermediate", 2, 3, 1, [1,1,1,C,C,C], { kind: "reveal-safe" }),
  make("starter-compare-mine", "Identify the proven mine", "intermediate", 2, 3, 1, [1,1,1,C,C,C], { kind: "classify-square", index: 4 }),
  make("starter-flag", "Check an existing flag", "intermediate", 2, 2, 1, [1,F,C,C], { kind: "classify-square", index: 1 }),
];

/** Prepare once when a training session opens. Reject the catalog as a unit if
 * any definition fails; never silently substitute an authored answer. */
export function prepareStarterTraining(): PreparedTrainingExercise[] | null {
  return prepareCatalog(starterExercises);
}

// Multi-clue chains verified against the complete visible board.
const advancedExercises = [
  make("advanced-chain-1", "Connect the visible clues", "advanced", 4, 4, 4, [C,2,2,C,C,C,3,C,1,C,C,C,0,1,1,1], {kind:"classify-square",index:4}),
  make("advanced-chain-2", "Compare overlapping clues", "advanced", 4, 4, 4, [C,C,C,2,0,1,C,C,1,C,3,C,C,C,C,1], {kind:"classify-square",index:7}),
  make("advanced-chain-3", "Reason about multiple layouts", "advanced", 4, 4, 4, [2,C,1,C,C,C,C,0,C,2,C,1,1,C,C,C], {kind:"classify-square",index:8}),
];
export function prepareAdaptiveTraining(): PreparedTrainingExercise[] | null {
  return prepareCatalog([...starterExercises, ...advancedExercises]);
}
function prepareCatalog(exercises: readonly TrainingExercise[]): PreparedTrainingExercise[] | null {
  const prepared: PreparedTrainingExercise[] = [];
  const ids = new Set<string>();
  for (const exercise of exercises) {
    const result = prepareTrainingExercise(exercise);
    if (!result.ok || ids.has(exercise.id)) return null;
    ids.add(exercise.id);
    prepared.push(result.prepared);
  }
  return prepared;
}

/** Desktop mouse actions must match the requested exercise. Touch and native
 * keyboard activation use the requested action, so neither requires a mouse. */
export type TrainingCellInput = "reveal" | "flag" | "activate";
export function trainingCellAnswer(objective: TrainingObjective, index: number, input: TrainingCellInput): TrainingAnswer | null {
  if (objective.kind === "classify-square" || !Number.isSafeInteger(index) || index < 0) return null;
  const expected = objective.kind === "reveal-safe" ? "reveal" : "flag";
  return input === expected || input === "activate" ? { index } : null;
}

export type TrainingAttempt = { answer: TrainingAnswer; status: Exclude<TrainingAssessment["status"], "invalid"> };
export type TrainingSession = { position: number; attempt: TrainingAttempt | null };
export const newTrainingSession = (): TrainingSession => ({ position: 0, attempt: null });
export type TrainingAction = { kind: "answer"; answer: TrainingAnswer } | { kind: "retry" | "previous" | "next" } | { kind: "jump"; position: number };

/** Transient exercise state only. No gameplay input, account writes or rewards. */
export function updateTrainingSession(session: TrainingSession, catalog: readonly PreparedTrainingExercise[], action: TrainingAction): TrainingSession {
  const exercise = catalog[session.position];
  if (!exercise) return session;
  if (action.kind === "answer") {
    if (session.attempt) return session;
    const result = assessTrainingAnswer(exercise, action.answer);
    if (result.status === "invalid") return session;
    return { ...session, attempt: { answer: { ...action.answer }, status: result.status } };
  }
  if (action.kind === "retry") return session.attempt ? { ...session, attempt: null } : session;
  const position = action.kind === "jump" ? action.position : session.position + (action.kind === "next" ? 1 : -1);
  return Number.isSafeInteger(position) && position >= 0 && position < catalog.length && position !== session.position ? { position, attempt: null } : session;
}
