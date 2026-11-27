import type { ReviewMode } from "./personalized-review.ts";

export const LEARNING_VIEW_KEY = "ai-coach:learning-view:v1";
export type LearningView = {
  mode: ReviewMode;
  difficulty: string;
  windowSize: number;
  expanded: boolean;
};
export const DEFAULT_LEARNING_VIEW: LearningView = {
  mode: "practice",
  difficulty: "Intermediate",
  windowSize: 10,
  expanded: true,
};

/** Browser presentation preferences only: never store reports or account IDs here. */
export function readLearningView(storage: Pick<Storage, "getItem"> | null): LearningView {
  try {
    const raw = storage?.getItem(LEARNING_VIEW_KEY);
    if (!raw) return { ...DEFAULT_LEARNING_VIEW };
    const value = JSON.parse(raw) as Partial<LearningView> | null;
    if (!value || typeof value !== "object") return { ...DEFAULT_LEARNING_VIEW };
    return {
      mode: value.mode === "ranked" ? "ranked" : "practice",
      difficulty:
        typeof value.difficulty === "string" &&
        ["Beginner", "Intermediate", "Expert"].includes(value.difficulty)
          ? value.difficulty
          : DEFAULT_LEARNING_VIEW.difficulty,
      windowSize:
        typeof value.windowSize === "number" &&
        [10, 25, 50, 100].includes(value.windowSize)
          ? value.windowSize
          : 10,
      expanded: typeof value.expanded === "boolean" ? value.expanded : true,
    };
  } catch {
    return { ...DEFAULT_LEARNING_VIEW };
  }
}
export function writeLearningView(
  storage: Pick<Storage, "setItem"> | null,
  view: LearningView,
) {
  try {
    storage?.setItem(
      LEARNING_VIEW_KEY,
      JSON.stringify({
        mode: view.mode,
        difficulty: view.difficulty,
        windowSize: view.windowSize,
        expanded: view.expanded,
      }),
    );
  } catch {
    /* Optional presentation storage. */
  }
}
