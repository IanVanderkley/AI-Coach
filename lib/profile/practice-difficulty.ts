import { summarizeRecentOutcomes, type RecentStats } from "./player-dashboard.ts";

/** These are recorded-history statistics, NOT complete lifetime or verified results. */
export const PRACTICE_DIFFICULTIES = ["Beginner", "Intermediate", "Expert"] as const;
export type PracticeDifficulty = (typeof PRACTICE_DIFFICULTIES)[number];

export type PracticeDifficultySummary = {
  difficulty: PracticeDifficulty;
  stats: RecentStats;
  fastestWinSeconds: number | null;
};

type PracticeOutcomeRecord = {
  difficulty: string;
  outcome: "win" | "loss";
  durationSeconds: number;
};

export function summarizePracticeDifficulties(
  games: readonly PracticeOutcomeRecord[],
): PracticeDifficultySummary[] {
  for (const game of games) {
    if (
      !PRACTICE_DIFFICULTIES.some((difficulty) => difficulty === game.difficulty) ||
      (game.outcome !== "win" && game.outcome !== "loss") ||
      !Number.isSafeInteger(game.durationSeconds) ||
      game.durationSeconds < 0
    ) {
      throw new Error("Invalid Practice recording for difficulty statistics.");
    }
  }
  return PRACTICE_DIFFICULTIES.map((difficulty) => {
    const recorded = games.filter((game) => game.difficulty === difficulty);
    const winTimes = recorded
      .filter((game) => game.outcome === "win")
      .map((game) => game.durationSeconds);
    return {
      difficulty,
      stats: summarizeRecentOutcomes(recorded.map((game) => game.outcome)),
      fastestWinSeconds: winTimes.length === 0 ? null : Math.min(...winTimes),
    };
  });
}
