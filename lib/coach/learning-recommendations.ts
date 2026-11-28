import { LESSONS, type MistakeKey, type ReviewMode } from "./personalized-review.ts";
import { summarizeSkillEvidence, type SkillReview } from "./skill-evidence.ts";
import { buildLearningTrends } from "./learning-trends.ts";

const PRACTICE_GAMES = 3;
const priority: Record<MistakeKey, number> = {
  "revealed-known-mine": 0,
  "flagged-known-safe": 1,
  "unnecessary-guess": 2,
};
const habits: Record<MistakeKey, string> = {
  "unnecessary-guess": "Before revealing or chording, scan the visible clues for an unflagged proven-safe square.",
  "revealed-known-mine": "Before revealing or chording, check whether any square you intend to open is a proven mine.",
  "flagged-known-safe": "Before placing a flag, check whether the visible clues prove that square contains a mine.",
};

/** Recommend a habit from owned, internally consistent saved reviews. Neither
 * missing evidence nor an uncertain action establishes a mistake. This does
 * not authorize access to recordings or infer a player's mental process.
 */
export function recommendLearning(reviews: readonly SkillReview[], mode: ReviewMode, difficulty: string, windowSize: number) {
  const skillSummary = summarizeSkillEvidence(reviews, mode, difficulty, windowSize);
  const { learning, skills, evidenceGames } = skillSummary;
  const trends = buildLearningTrends(reviews.map(row => row.saved), mode, difficulty, windowSize);
  const { games, assessedGames, assessed, uncertain } = learning.evidence;
  const base = { cohort: learning.cohort, evidence: learning.evidence, evidenceGames, exclusions: learning.exclusions,
    caveat: "Recommendations describe saved, post-opening replay decisions only. Practice is not authenticated Ranked evidence. Uncertain actions are not verified mistakes; zero recorded mistakes does not prove mastery." };
  // Prefer patterns observed across multiple games, not one unusually long game.
  // For equal breadth and frequency, prioritize opening known mines, then bad flags.
  const pattern = [...learning.patterns].filter(p => p.games > 0).sort((a,b) => b.games - a.games || b.occurrences - a.occurrences || priority[a.key] - priority[b.key])[0];
  if (pattern) {
    const lesson = LESSONS[pattern.key];
    const example = pattern.example;
    const relevantSkills = pattern.key === "flagged-known-safe" ? ["flagging"] : pattern.key === "unnecessary-guess" ? ["riskManagement"] : ["revealing", "chording"];
    const skillEvidence = skills.filter(s => relevantSkills.includes(s.key) && s.sufficient).map(s => ({ key: s.key, supported: s.supported, mistakes: s.mistakes, uncertain: s.uncertain, assessed: s.assessed, assessedGames: s.assessedGames, accuracy: s.accuracy }));
    const comparison = trends.comparison;
    const older = comparison.older.mistakePatterns.find(p => p.key === pattern.key);
    const recent = comparison.recent.mistakePatterns.find(p => p.key === pattern.key);
    return { ...base, kind: pattern.recurring ? "recurring-mistake" as const : "single-game-mistake" as const,
      title: lesson.title, goal: lesson.goal,
      reason: `This mistake was verified ${pattern.occurrences} ${pattern.occurrences === 1 ? "time" : "times"} across ${pattern.games} of ${games} saved ${games === 1 ? "game" : "games"}.`,
      focus: { key: pattern.key, games: pattern.games, occurrences: pattern.occurrences, example: example ? { ...example, mode, difficulty } : null },
      lesson: { question: lesson.question, options: [...lesson.options], answer: lesson.answer, explanation: lesson.explanation },
      skillEvidence,
      history: comparison.comparable && older && recent ? { older: { games: comparison.older.games, affected: older.games, occurrences: older.occurrences }, recent: { games: comparison.recent.games, affected: recent.games, occurrences: recent.occurrences } } : null,
      objective: { practiceGames: PRACTICE_GAMES, difficulty, habit: habits[pattern.key],
        evaluation: `Save reviews for your next ${PRACTICE_GAMES} comparable ${mode === "ranked" ? "Ranked" : "Practice"} games. Aim for zero verified instances of this mistake, and review the assessed and uncertain decision counts. No recorded mistakes alone does not establish mastery.` },
    };
  }
  const sufficient = assessedGames >= 3 && assessed >= 10;
  return { ...base, kind: sufficient ? "reinforce" as const : "collect-evidence" as const,
    title: sufficient ? "Keep building supported decisions" : "Build a learning history",
    goal: sufficient ? "Continue using visible clues to support your decisions." : "Save more completed game reviews to identify useful patterns.",
    reason: games === 0 ? "There are no eligible saved reviews in this selection." : `No verified mistakes were recorded across ${games} saved ${games === 1 ? "game" : "games"}; ${assessed} decisions were assessed and ${uncertain} remained uncertain.`,
    focus: null, lesson: null, skillEvidence: [], history: null,
    objective: { practiceGames: PRACTICE_GAMES, difficulty, habit: "Check visible clues before revealing, flagging or chording.",
      evaluation: `Save your next ${PRACTICE_GAMES} comparable ${mode === "ranked" ? "Ranked" : "Practice"} reviews and revisit the assessed and uncertain decision counts.` },
  };
}
