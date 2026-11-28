import type { PreparedTrainingExercise, TrainingDifficulty } from "./training-exercise.ts";

export const TRAINING_PROGRESS_KEY = "ai-coach:starter-training:v1";
export const TRAINING_HISTORY_LIMIT = 60;
export const TRAINING_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type TrainingHistoryEntry = { id: string; correct: boolean; hints: number };
export type TrainingHistory = readonly TrainingHistoryEntry[];
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Store only known generic puzzle IDs, answer outcome and hints displayed at
 * submission. Never store a board, account ID, replay reference or answer. */
export function parseTrainingHistory(value: unknown, ids: readonly string[]): TrainingHistoryEntry[] | null {
  if (!isRecord(value) || Object.keys(value).length !== 2 || value.version !== 1 || !Array.isArray(value.history) || value.history.length > TRAINING_HISTORY_LIMIT) return null;
  const allowed = new Set(ids);
  const result: TrainingHistoryEntry[] = [];
  for (const entry of value.history) {
    if (!isRecord(entry) || Object.keys(entry).length !== 3 || typeof entry.id !== "string" || !allowed.has(entry.id) || typeof entry.correct !== "boolean" || typeof entry.hints !== "number" || !Number.isInteger(entry.hints) || entry.hints < 0 || entry.hints > 3) return null;
    result.push({ id: entry.id, correct: entry.correct, hints: entry.hints });
  }
  return result;
}
export function appendTrainingAttempt(history: TrainingHistory, entry: TrainingHistoryEntry, ids: readonly string[]): TrainingHistoryEntry[] {
  return parseTrainingHistory({ version: 1, history: [...history, entry].slice(-TRAINING_HISTORY_LIMIT) }, ids) ?? [...history];
}
export function readTrainingHistory(storage: Pick<Storage, "getItem"> | null, ids: readonly string[]) {
  if (!storage) return { history: [] as TrainingHistoryEntry[], available: false };
  try {
    const raw = storage.getItem(TRAINING_PROGRESS_KEY);
    if (raw === null) return { history: [] as TrainingHistoryEntry[], available: true };
    let history: TrainingHistoryEntry[] | null = null;
    if (raw.length <= 12000) { try { history = parseTrainingHistory(JSON.parse(raw), ids); } catch { /* malformed saved data */ } }
    return { history: history ?? [], available: true };
  } catch { return { history: [] as TrainingHistoryEntry[], available: false }; }
}
export function writeTrainingHistory(storage: Pick<Storage, "setItem"> | null, history: TrainingHistory, ids: readonly string[]): boolean {
  const validated = parseTrainingHistory({ version: 1, history }, ids);
  if (!storage || !validated) return false;
  try { storage.setItem(TRAINING_PROGRESS_KEY, JSON.stringify({ version: 1, history: validated })); return true; }
  catch { return false; }
}
export function trainingProgress(history: TrainingHistory) {
  return { attempts: history.length, correct: history.filter(entry => entry.correct).length,
    assisted: history.filter(entry => entry.hints > 0).length, solved: new Set(history.filter(entry => entry.correct).map(entry => entry.id)).size };
}

/** Suggest a level from the latest answer for each distinct generic puzzle.
 * Advance after two correct answers without a displayed hint on different
 * puzzles, or completing the level. Revisit a missed puzzle before advancing.
 * Repeated boards are practice evidence, not a mastery or skill rating. */
export function recommendTraining(catalog: readonly PreparedTrainingExercise[], history: TrainingHistory): { position: number; difficulty: TrainingDifficulty; reason: string } | null {
  const latest = new Map(history.map(entry => [entry.id, entry]));
  const solved = new Set(history.filter(entry => entry.correct).map(entry => entry.id));
  for (const difficulty of TRAINING_LEVELS) {
    const positions = catalog.flatMap((p, index) => p.exercise.difficulty === difficulty ? [index] : []);
    if (!positions.length) continue;
    const current = positions.map(i => ({ index: i, id: catalog[i].exercise.id, last: latest.get(catalog[i].exercise.id) }));
    const unassisted = current.filter(p => p.last?.correct && p.last.hints === 0).length;
    const complete = current.every(p => solved.has(p.id));
    const missed = current.find(p => p.last && !p.last.correct);
    if (difficulty !== "advanced" && !missed && (unassisted >= 2 || complete)) continue;
    const newPuzzle = current.find(p => !p.last);
    const remaining = current.find(p => !solved.has(p.id));
    const assisted = current.find(p => p.last?.hints);
    const next = missed ?? newPuzzle ?? remaining ?? assisted ?? current[0];
    return { position: next.index, difficulty, reason: missed ? "Revisit a puzzle you missed and work through its clues." : newPuzzle ? "Try a new puzzle at this level." : remaining ? "Keep practicing the remaining puzzles." : assisted ? "Try this puzzle again with fewer hints." : "Review a familiar puzzle to reinforce your deductions." };
  }
  const first = catalog[0];
  return first ? { position: 0, difficulty: first.exercise.difficulty, reason: "Review any puzzle to reinforce your deductions." } : null;
}
