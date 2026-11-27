# Batch 25A.2 — Decision accuracy

- An incorrect flag identified from the completed mine layout is an observed outcome, not a proven decision mistake. The legacy report retains actual correct/incorrect flag counts for compatibility, but only penalizes a flag proven safe before the action. Unsupported correct flags are not described as proof of logical play.
- The legacy `forcedGuesses` response field remains for compatibility. Its label and explanation now describe the absence of a proven-safe alternative, not a forced guess, equal odds, or a guaranteed unavoidable loss.
- A chord is not automatically a strength. Reveal/chord counts use a common denominator. Fatal avoidable decisions are not duplicated in the improvements summary. Recommendations must not assume flags are proven mines.
- The evidence report describes risky chords as actions affecting uncertain neighbors, prioritizes an immediately actionable proven-safe alternative, and tells a player to remove a flag first when the only proof is a flagged safe square. Unresolved flags, unflags and reveals retain explicit uncertainty; verified proof categories and existing counters stay compatible.

## Scope and limitations

This patch improves the existing legacy and verified analysis paths without changing official XP/Elo, persistence, database or provider access. It does not merge the two solvers or make the limited deduction search complete. The next step is a single verified report/score projection for checkpointed games; the legacy contract for unstamped demos remains separate. No claim of a truly unavoidable guess is made. Run the full checks and manually compare a completed Practice review and the demo. Paid AI stays disabled.
