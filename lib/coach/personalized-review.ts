import {
  PRACTICE_ANALYSIS_VERSION,
  type CompletedGameAnalysis,
} from "./practice-analysis.ts";
import { scorePreparedReview, type ReviewScore } from "./review-score.ts";
import type { EvidenceReport } from "./evidence-report.ts";
import type { SkillEvidence } from "./skill-evidence.ts";

export const REVIEW_WINDOWS = [10, 25, 50, 100] as const;
export const MISTAKE_TYPES = [
  "unnecessary-guess",
  "revealed-known-mine",
  "flagged-known-safe",
] as const;
export type MistakeKey = (typeof MISTAKE_TYPES)[number];
export type ReviewMode = "practice" | "ranked";
export type SavedReview = {
  mode: ReviewMode;
  gameRef: string;
  difficulty: string;
  outcome: "win" | "loss";
  completedAt: string;
  version: number;
  review: {
    score: ReviewScore;
    report: EvidenceReport;
    mistakeMoves: Record<MistakeKey, number[]>;
    /** Optional versioned counters from the same completed server-side replay. */
    skillEvidence?: SkillEvidence;
  };
};

export const LESSONS = {
  "unnecessary-guess": {
    title: "Find guaranteed-safe moves first",
    goal: "Scan visible clues for a safe deduction before taking an uncertain risk.",
    question:
      "A revealed 1 has exactly two covered neighbours. Other visible clues prove one contains a mine. What should you do with the other?",
    options: ["Reveal the other square", "Flag both squares", "Guess elsewhere"],
    answer: 0,
    explanation:
      "The 1 is already satisfied by the proven mine, so the other square is safe. Use the deduction instead of guessing.",
    practice:
      "Play three Practice games. Before each uncertain reveal, scan for a guaranteed-safe alternative.",
  },
  "revealed-known-mine": {
    title: "Check mine proofs before revealing",
    goal: "Confirm each square is safe before revealing or chording.",
    question:
      "A revealed 2 has exactly two covered neighbours. What can you prove about those two?",
    options: ["Both are safe", "Both are mines", "Only one is a mine"],
    answer: 1,
    explanation:
      "The clue requires exactly two adjacent mines. With only two covered neighbours, both are mines.",
    practice:
      "Play three Practice games. Before a chord, check that every square it opens is supported by visible clues.",
  },
  "flagged-known-safe": {
    title: "Flag only proven mines",
    goal: "Treat a flag as a claim that needs visible-board evidence.",
    question:
      "A revealed 1 has exactly two covered neighbours: a proven mine and one other square. Is the other square a valid place for a flag?",
    options: ["Yes, flag it", "Only if you are losing", "No, it is proven safe"],
    answer: 2,
    explanation:
      "The proven mine satisfies the clue. The remaining covered neighbour must be safe, so do not flag it.",
    practice:
      "Play three Practice games. For each flag, identify the clue that proves it is a mine.",
  },
} as const;

/** Store exact post-opening mistake move references, not merely the top five lessons. */
export function buildSavedReview(analysis: CompletedGameAnalysis): SavedReview["review"] {
  const mistakeMoves: SavedReview["review"]["mistakeMoves"] = {
    "unnecessary-guess": [],
    "revealed-known-mine": [],
    "flagged-known-safe": [],
  };
  for (const frame of analysis.reviewed) {
    if (frame.decision === "mistake" && frame.mistakeType) {
      mistakeMoves[frame.mistakeType].push(frame.actionNumber);
    }
  }
  return { score: scorePreparedReview(analysis), report: analysis.report, mistakeMoves };
}

/** Only current-version reports are comparable. Compare identical modes/difficulties. */
export function summarizeLearning(
  reports: readonly SavedReview[],
  mode: ReviewMode,
  difficulty: string,
  window: number,
) {
  const unique = new Map<string, SavedReview>();
  for (const item of reports) {
    if (
      item.version !== PRACTICE_ANALYSIS_VERSION ||
      item.mode !== mode ||
      item.difficulty !== difficulty
    )
      continue;
    const key = item.gameRef;
    if (!unique.has(key)) unique.set(key, item);
  }
  const selected = [...unique.values()]
    .sort(
      (a, b) =>
        Date.parse(b.completedAt) - Date.parse(a.completedAt) ||
        a.gameRef.localeCompare(b.gameRef),
    )
    .slice(0, window);
  const patterns = MISTAKE_TYPES.map((key) => {
    const matching = selected.filter((item) => item.review.mistakeMoves[key].length > 0);
    return {
      key,
      games: matching.length,
      occurrences: matching.reduce(
        (sum, item) => sum + item.review.mistakeMoves[key].length,
        0,
      ),
      example: matching[0]
        ? { gameRef: matching[0].gameRef, move: matching[0].review.mistakeMoves[key][0] }
        : null,
    };
  }).sort(
    (a, b) =>
      b.games - a.games || b.occurrences - a.occurrences || a.key.localeCompare(b.key),
  );
  function metrics(items: readonly SavedReview[]) {
    const good = items.reduce((sum, item) => sum + item.review.score.good, 0);
    const mistakes = items.reduce((sum, item) => sum + item.review.score.mistakes, 0);
    const uncertain = items.reduce((sum, item) => sum + item.review.score.uncertain, 0);
    const graded = items.filter((item) => item.review.score.score !== null);
    return {
      good,
      mistakes,
      uncertain,
      accuracy: good + mistakes ? Math.round((100 * good) / (good + mistakes)) : null,
      score: graded.length
        ? Math.round(
            graded.reduce((sum, item) => sum + (item.review.score.score ?? 0), 0) /
              graded.length,
          )
        : null,
      graded: graded.length,
    };
  }
  const half = Math.floor(selected.length / 2);
  const recent = metrics(selected.slice(0, half));
  const older = metrics(selected.slice(selected.length - half));
  const accuracyChange =
    half >= 5 && recent.accuracy !== null && older.accuracy !== null
      ? recent.accuracy - older.accuracy
      : null;
  return { selected, patterns, metrics: metrics(selected), accuracyChange, half };
}
