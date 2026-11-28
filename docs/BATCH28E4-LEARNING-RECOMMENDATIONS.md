# Batch 28E.4 — Personalized learning recommendations

`recommendLearning(reviews, mode, difficulty, windowSize)` composes the existing saved-review, skill-evidence and trend projections. Pass only reports already scoped to the current account (or the current guest session). It does not authenticate records, fetch games, run a solver or use an AI provider. Practice reports are client-recorded replay evidence, not authenticated Ranked results.

- Reuse the accepted current-version cohort, bounded review window, and duplicate/conflict exclusions.
- Prioritize patterns by distinct affected games, then exact occurrences. Ties prefer opening proven mines, then flagging proven-safe squares, then unnecessary guesses. These are product choices, not a validated pedagogical ranking.
- Distinguish recurring mistakes (two or more games) from single-game observations, regardless of repetition within the game. Provide a recent exact game/move reference and a lesson from the existing catalog.
- Provide relevant skill context only when the prior skill module's sample threshold is met. Include historical counts only for comparable chronological periods; counts alone do not establish improved skill.
- If no mistakes are recorded, encourage evidence collection or reinforcement (at least 10 assessed decisions in three games). Never interpret uncertain actions as mistakes, no evidence as mastery, or an absence of mistakes as proof of skill.
- Suggest a three-game habit objective and follow-up review in the same mode/difficulty. Zero recorded instances is a target, not proof of success or mastery. Three games is a pragmatic practice target, not a statistical threshold. No new competitive rating, score, persistence, UI, API, or database changes.

The UI integration must use existing account-scoped access, handle missing replay references, render the lesson question without revealing its answer before an attempt, and label the window as saved reviews rather than all played games. Technique-specific mastery is not estimated by this module. Trend and skill data can be absent.

Verification: run `npm test` and `npx tsc --noEmit` in the full repository. The targeted test file covers selection, evidence boundaries, legacy summaries, chronology, cohort isolation and deterministic output.
