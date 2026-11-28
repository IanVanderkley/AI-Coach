# Batch 28E.2 — Action-specific learning evidence

Adds a pure projection of already prepared completed-game replay evidence. No new solver calls, no stored schema changes, no UI integration, and no competitive rating changes. Account-scoped callers must establish recording ownership and provenance before preparing analysis. A Practice recording is not an authenticated Ranked result.

- Count changed post-opening flag, reveal and chord actions once each; unflags are neutral and tracked separately. Supported, verified mistakes and uncertain counts follow existing replay decisions, not hidden mine truth. Chords count as one action even when several squares open.
- Risk management is a subset of reveal/chord actions with at least one unflagged covered proven-safe square available before the move (including the chosen square if it is safe). Flagged safe squares do not qualify. Count existing decision labels, not all possible alternative squares. This is not a probability or guess-necessity assessment.
- Aggregate within the same current-version, mode, difficulty and window cohort as 28E.1. Missing skill evidence is not failure. Old reports remain usable for overall analytics. Reject inconsistent counters, unsupported skill versions and conflicting copies. Identical copies count once. Counter validation does not authenticate data.
- Display threshold: at least ten assessed actions across at least three distinct games, per skill. Accuracy excludes uncertainty; coverage includes it. Recurring mistakes require mistakes in at least two distinct games. These are descriptive observations, not measured mastery or statistical confidence intervals.
- The original solver's supported/mistake labels are unchanged. Do not infer mastery of subset, overlap or enumeration techniques, nor the player's actual reasoning, from action outcomes. Technique-specific opportunity analysis is deferred until appropriate proof evidence is available.
- The new evidence is not yet persisted or rendered; a future integration must explicitly decide how to collect it through the existing owned-review boundary, handle legacy data and avoid replaying large histories on every render.

Verification: `node --test tests/batch28e-skill-evidence.test.mjs`, `npm test`, `npx tsc --noEmit`.
