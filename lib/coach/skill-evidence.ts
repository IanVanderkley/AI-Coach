import type { CompletedGameAnalysis } from "./practice-analysis.ts";
import { buildSavedReview, type SavedReview, type ReviewMode } from "./personalized-review.ts";
import { analyzeLearningReviews } from "./learning-analytics.ts";

export const SKILL_EVIDENCE_VERSION = 1;
export const SKILLS = ["flagging", "revealing", "chording", "riskManagement"] as const;
export type Skill = typeof SKILLS[number];
type Counts = { supported: number; mistakes: number; uncertain: number };
export type SkillEvidence = {
  version: typeof SKILL_EVIDENCE_VERSION;
  counts: Record<Skill, Counts>;
  unflags: number;
};
export type SkillReview = { saved: SavedReview; evidence?: SkillEvidence | null };
const empty = (): Counts => ({ supported: 0, mistakes: 0, uncertain: 0 });
const observed = (c: Counts) => c.supported + c.mistakes + c.uncertain;
const assessed = (c: Counts) => c.supported + c.mistakes;
const skillsByAction = { flag: "flagging", reveal: "revealing", chord: "chording" } as const;

/** Project post-opening, changed actions from an already prepared, owned replay.
 * No extra solve, no hidden mine access, no claim about the player's thought process.
 * Risk opportunity = a reveal/chord action with an unflagged covered proven-safe
 * square available before the action. Count each action once, not each alternative.
 */
export function collectSkillEvidence(analysis: CompletedGameAnalysis): SkillEvidence {
  const counts = { flagging: empty(), revealing: empty(), chording: empty(), riskManagement: empty() };
  let unflags = 0;
  for (const frame of analysis.reviewed) {
    if (!frame.changed) continue;
    if (frame.move.action === "unflag") { unflags++; continue; }
    const key = skillsByAction[frame.move.action];
    const result = frame.decision === "good" ? "supported" : frame.decision === "mistake" ? "mistakes" : "uncertain";
    counts[key][result]++;
    if (key !== "flagging" && frame.deductions.safe.some(proof => {
      const cell = frame.before[proof.index];
      return cell && !cell.revealed && !cell.flagged;
    })) counts.riskManagement[result]++;
  }
  return { version: SKILL_EVIDENCE_VERSION, counts, unflags };
}

/** Construct both projections from the same trusted prepared analysis. Metadata
 * must come from the account-scoped recording boundary, not arbitrary input.
 */
export function buildSkillReview(analysis: CompletedGameAnalysis, metadata: Pick<SavedReview, "mode" | "gameRef" | "completedAt">): SkillReview {
  return { saved: { ...metadata, difficulty: analysis.game.difficulty, outcome: analysis.game.outcome, version: analysis.version, review: buildSavedReview(analysis) }, evidence: collectSkillEvidence(analysis) };
}

const validCount = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= 10000;
function validEvidence(e: SkillEvidence | null | undefined, saved: SavedReview): e is SkillEvidence {
  if (!e || e.version !== SKILL_EVIDENCE_VERSION || !e.counts || !validCount(e.unflags)) return false;
  for (const key of SKILLS) {
    const c = e.counts[key];
    if (!c || ![c.supported, c.mistakes, c.uncertain].every(validCount)) return false;
  }
  const { flagging: f, revealing: r, chording: c, riskManagement: risk } = e.counts;
  const score = saved.review.score;
  return f.supported + r.supported + c.supported === score.good &&
    f.mistakes + r.mistakes + c.mistakes === score.mistakes &&
    f.uncertain + r.uncertain + c.uncertain + e.unflags === score.uncertain &&
    f.mistakes === saved.review.mistakeMoves["flagged-known-safe"].length &&
    risk.supported <= r.supported + c.supported && risk.mistakes <= r.mistakes + c.mistakes && risk.uncertain <= r.uncertain + c.uncertain;
}
const signature = (e: SkillEvidence) => JSON.stringify([e.version, e.unflags, ...SKILLS.flatMap(key => { const c = e.counts[key]; return [c.supported, c.mistakes, c.uncertain]; })]);

/** Aggregate only the same accepted saved-review cohort. Old summaries without
 * action evidence still count in overall learning analytics, never in skill rates.
 * This consistency check does not authenticate records; use account-scoped inputs.
 */
export function summarizeSkillEvidence(reviews: readonly SkillReview[], mode: ReviewMode, difficulty: string, windowSize: number) {
  const learning = analyzeLearningReviews(reviews.map(row => row.saved), mode, difficulty, windowSize);
  const totals = Object.fromEntries(SKILLS.map(key => [key, { ...empty(), assessedGames: 0, mistakeGames: 0 }])) as Record<Skill, Counts & { assessedGames: number; mistakeGames: number }>;
  let evidenceGames = 0, conflictingGames = 0, invalidGames = 0;
  for (const saved of learning.selected) {
    const matching = reviews.filter(row => row.saved && row.saved.gameRef === saved.gameRef && row.saved.mode === saved.mode && row.saved.difficulty === saved.difficulty && row.saved.version === saved.version && Date.parse(row.saved.completedAt) === Date.parse(saved.completedAt));
    // Reject evidence attached to an invalid or contradictory summary, even if its
    // counters happen to match the selected valid review.
    const accepted = matching.filter(row => {
      // The selected object has already passed the exact same validation.
      if (row.saved === saved) return true;
      const candidate = analyzeLearningReviews([row.saved], mode, difficulty, windowSize).selected[0];
      if (!candidate || candidate.outcome !== saved.outcome) return false;
      const a = candidate.review.score, b = saved.review.score;
      return a.good === b.good && a.mistakes === b.mistakes && a.uncertain === b.uncertain && a.progress === b.progress && a.score === b.score &&
        Object.keys(saved.review.mistakeMoves).every(key => {
          const k = key as keyof SavedReview["review"]["mistakeMoves"];
          const left = candidate.review.mistakeMoves[k], right = saved.review.mistakeMoves[k];
          return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every(move => right.includes(move));
        });
    });
    if (matching.some(row => row.evidence != null && !accepted.includes(row))) { invalidGames++; continue; }
    const candidates = accepted.flatMap(row => validEvidence(row.evidence, saved) ? [row.evidence] : []);
    if (matching.some(row => row.evidence != null && !validEvidence(row.evidence, saved))) { invalidGames++; continue; }
    if (!candidates.length) continue;
    if (new Set(candidates.map(signature)).size !== 1) { conflictingGames++; continue; }
    evidenceGames++;
    for (const key of SKILLS) {
      const c = candidates[0].counts[key], t = totals[key];
      t.supported += c.supported; t.mistakes += c.mistakes; t.uncertain += c.uncertain;
      if (assessed(c)) t.assessedGames++;
      if (c.mistakes) t.mistakeGames++;
    }
  }
  const skills = SKILLS.map(key => {
    const t = totals[key], n = assessed(t), all = observed(t);
    // Presentation threshold, not a statistical confidence interval or mastery score.
    const sufficient = n >= 10 && t.assessedGames >= 3;
    return { key, ...t, assessed: n, observed: all, sufficient,
      accuracy: sufficient ? 100 * t.supported / n : null,
      coverage: all ? 100 * n / all : null,
      recurringMistakes: t.mistakeGames >= 2 };
  });
  return { learning, skills, evidenceGames, missingEvidenceGames: learning.selected.length - evidenceGames, conflictingGames, invalidGames };
}
