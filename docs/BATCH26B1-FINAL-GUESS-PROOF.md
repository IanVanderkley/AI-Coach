# Batch 26B.1 — Final guess proof reference

This additive patch does not change Ranked settlement, active board responses, XP, database schema or the live site.

On a 16 × 16 board with 40 mines, exactly 215 revealed safe cells leave 41 covered cells containing 40 mines and one safe cell. For every covered candidate, all other covered cells must be mines. Compare that hypothetical layout against every revealed clue. Exactly two consistent layouts with different safe candidates establish a genuine final binary ambiguity. Flags are not evidence. A unique safe candidate, more than two candidates, malformed input or zero consistent layouts does not qualify. The reference accepts only revealed clues (0–8) or null for covered cells, never the actual hidden layout or player flags.

The two layouts are equally likely under uniform mine placement conditional on the known first-opening exclusions. Before settlement integration, verify the actual generator and reconstruct clues from server-owned pre-loss state. Do not use this reference on arbitrary client input as an award authorization. A proven pair is not a loss receipt. The trusted settlement path must establish a completed loss by direct reveal of one candidate, with the pre-loss state and actual mine hit verified transactionally. Chord losses, earlier guesses and nonterminal games do not qualify. Do not expose candidate positions or proof results for active Ranked games.

Proposed reward remains half the nominal victory reward at the pre-settlement rank (round half up for odd rewards), bounded by the existing ceiling. Preserve the loss statistic; maintain idempotency and historical receipt semantics. Reward changes will be a separate reviewed migration and receipt compatibility patch.

Run `npm test`, `npm run typecheck`, and `git diff --check`. The new tests use an independent exhaustive oracle and deterministic fixtures. No database commands are needed for this patch.
