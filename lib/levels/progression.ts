/** Account XP is earned by verified server-owned events, never browser claims. */
export const XP_PER_LEVEL = 1000;

export type LevelProgress = {
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  xpPerLevel: number;
  percent: number;
};

/** Level 1 starts at 0 XP. Every additional 1,000 XP advances one level. */
export function calculateLevelProgress(totalXp: number): LevelProgress {
  if (!Number.isSafeInteger(totalXp) || totalXp < 0) {
    throw new RangeError("Total XP must be a nonnegative safe integer.");
  }

  const xpIntoLevel = totalXp % XP_PER_LEVEL;
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  return {
    level,
    totalXp,
    xpIntoLevel,
    xpToNextLevel: XP_PER_LEVEL - xpIntoLevel,
    xpPerLevel: XP_PER_LEVEL,
    percent: (xpIntoLevel / XP_PER_LEVEL) * 100,
  };
}

export function parseAccountTotalXp(value: unknown): number {
  const parsed = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isSafeInteger(parsed) || parsed < 0) {
    throw new TypeError("The account returned an invalid XP total.");
  }
  return parsed;
}
