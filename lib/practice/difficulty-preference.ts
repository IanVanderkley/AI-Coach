import type { Difficulty } from "../game-settings.ts";

// Selection only: unfinished Practice boards are not persisted by this helper.
export const PRACTICE_DIFFICULTY_KEY = "ai-coach:practice-difficulty:v1";
type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "setItem">;

export function isPracticeDifficulty(value: unknown): value is Difficulty {
  return value === "beginner" || value === "intermediate" || value === "expert";
}

export function readPracticeDifficulty(storage: ReadStorage | null): Difficulty | null {
  if (!storage) return null;
  try {
    const saved: unknown = storage.getItem(PRACTICE_DIFFICULTY_KEY);
    return isPracticeDifficulty(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function savePracticeDifficulty(
  storage: WriteStorage | null,
  difficulty: Difficulty,
): boolean {
  if (!storage || !isPracticeDifficulty(difficulty)) return false;
  try {
    storage.setItem(PRACTICE_DIFFICULTY_KEY, difficulty);
    return true;
  } catch {
    return false;
  }
}
