# Batch 28D.1 — Solver correctness audit

Baseline: Batch 28C, commit `d7a1de7`. This patch adds tests and documentation only. No production logic, grading, APIs, database, UI, or provider policy changes.

## Independent oracle

For each 2×2, 2×3 and 3×3 board, enumerate every mine layout (except an all-mine board), and every subset of safe squares as revealed. Group cases by public mine total and revealed numbers. The union and intersection of all compatible mine layouts identify precisely which covered cells are guaranteed safe or guaranteed mines. Flags are not evidence. This corpus includes synthetic visible snapshots that need not be reachable during normal play; it is not a count of games or live replay histories. Each trace is checked with an independent neighborhood calculation, group partition, prerequisite order, subset relation and result arithmetic. Guided highlights are checked against the oracle, not just against the solver's output. Compare traced and plain results and all-covered-flagged versus no flags, and test every flag mask on a small ambiguous board. The all-covered-flagged case is a mathematical stress test, not a legal in-game flag count.

Run `node --test tests/batch28d-solver-audit.test.mjs` on the project's Node version; then `npm test` and `npx tsc --noEmit`.

## Baseline findings (isolated run on supplied source)

| Dimensions | Unique evidence snapshots | Layout/snapshot pairs | Sound square claims checked | Missed forced squares | Snapshots with misses |
|---|---:|---:|---:|---:|---:|
| 2×2 | 47 | 80 | 60 | 0 | 0 |
| 2×3 | 415 | 728 | 1050 | 0 | 0 |
| 3×3 | 10999 | 19682 | 47363 | 292 | 148 |
| Total | 11461 | 20490 | 48473 | 292 | 148 |

Zero false safe/mine claims in this finite corpus. Missed deductions are diagnostic, not test failures: soundness is mandatory but completeness is not yet required. Counts can improve as the solver evolves. This is not a proof of correctness on arbitrary boards. No probabilities are inferred. The isolated fixture uses the supplied solver, square-analysis and visual-deduction source; a fail-fast replay-hash stub is present because these tests never replay a game or compute a hash. The complete repo must be tested locally.

## Concrete incompleteness case

Two mines total, `.` denotes covered:

```
. . .
1 2 1
. . .
```

The left 1 counts the left and center column's covered cells. The right 1 counts the center and right column's covered cells. Their sum counts the center column twice; the middle 2 counts all covered cells once. Subtracting shows zero mines in the two covered center-column cells. There are four consistent layouts (one mine in the left column and one in the right). The baseline solver returns no proof. The test allows future solvers to discover these cells; it does not require the current gap to persist.

## Next stages and boundaries

- 28D.2: overlapping constraints with independently checked proof derivations. Update the proof presentation for any new proof kind before enabling it for grading.
- 28D.3: bounded exact enumeration with explicit incomplete/budget-exhausted status. Never turn an interrupted search into certainty.
- 28D.4: probability only under a clearly specified mine-layout model; include total mine-count coupling and unconstrained cells. No percentage merely because a square is unresolved.
- 28D.5/6: integrate visual explanations, check recorded score changes, benchmark complete replays on real difficulty sizes, and regressions before staging.

The square inspection layer already suppresses terminal exposed-mine snapshots. The underlying solver assumes revealed cells are safe, so retain the pre-move boundary and consider an explicit terminal guard when strengthening the engine. No production change in this audit patch.
