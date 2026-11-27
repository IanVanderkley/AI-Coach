export const COACHING_SECTIONS_KEY = "ai-coach.coaching-sections.v1";
export const COACHING_SECTION_LABELS = {
  practice: "Recent Practice matches",
  ranked: "Recent Ranked matches",
  progress: "Your learning progress",
  method: "How progress is measured",
  drill: "Quick drill",
  plan: "Three-game training plan",
  patterns: "Mistake patterns",
  saved: "Saved reports",
  findings: "Saved findings",
  samples: "Sample reports and tools",
  accuracy: "Review accuracy information",
  replay: "Replay and visual proof",
  lessons: "Detailed lessons",
  score: "Score calculation",
  aiFocus: "Optional AI focus",
} as const;
export type CoachingSection = keyof typeof COACHING_SECTION_LABELS;
export type CoachingSections = Record<CoachingSection, boolean>;
export const DEFAULT_COACHING_SECTIONS: CoachingSections = {
  practice: true,
  ranked: true,
  progress: true,
  method: false,
  drill: false,
  plan: false,
  patterns: false,
  saved: false,
  findings: false,
  samples: false,
  accuracy: false,
  replay: false,
  lessons: false,
  score: false,
  aiFocus: false,
};
export function normalizeCoachingSections(input: unknown): CoachingSections {
  const result = { ...DEFAULT_COACHING_SECTIONS };
  if (!input || typeof input !== "object" || Array.isArray(input)) return result;
  for (const key of Object.keys(result) as CoachingSection[]) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value === "boolean") result[key] = value;
  }
  return result;
}
export function loadCoachingSections(
  storage: Pick<Storage, "getItem"> | null,
): CoachingSections {
  try {
    const raw = storage?.getItem(COACHING_SECTIONS_KEY);
    return normalizeCoachingSections(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_COACHING_SECTIONS };
  }
}
