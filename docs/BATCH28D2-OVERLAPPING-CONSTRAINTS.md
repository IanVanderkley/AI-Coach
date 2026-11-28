# Batch 28D.2 — Experimental overlapping constraints

The existing `deduceVisibleBoard(rows, columns, mineCount, cells, explain)` behavior remains the default. Pass an explicit sixth argument `true` to enable the experimental overlap rule; no current replay, grading, coaching or UI caller does so. No deployment or migration is required.

## Rule

For two exact constraints A and B with a shared region and nonempty exclusive regions, the number of shared mines S is bounded by `max(0, A.count - |A-only|, B.count - |B-only|)` and `min(|shared|, A.count, B.count)`. If a third existing exact constraint describes the union, its mine count U implies `S = A.count + B.count - U`. The exclusive regions contain `A.count - S` and `B.count - S` mines respectively. A region is proven only when its mine count is forced to zero or its full size. The rule runs only after ordinary clue/subset deductions reach a fixed point, and the existing rules resume after new discoveries. Flags are not evidence. The experiment has a 100,000 pair-check budget per solve; exhaustion does not prove a guess is necessary. Terminal exposed mines are excluded in advanced mode.

The new `overlap` certificate preserves actual clue groups, prior deductions, shared bounds and the exact result. It is intentionally separate from `ProofVisual`, which currently represents only one-group or subset deductions. Before enabling the mode in production callers, add visual support, reconcile grading/report policy and test full-size replays and performance. The budget limits only the new pair search, not the original solver's entire workload.

## Isolated results

| Board | Snapshots | Previous misses | Advanced misses | Sound advanced claims |
| ----- | --------: | --------------: | --------------: | --------------------: |
| 2×2   |        47 |               0 |               0 |                    60 |
| 2×3   |       415 |               0 |               0 |                 1,050 |
| 3×3   |    10,999 |             292 |             108 |                47,547 |
| Total |    11,461 |             292 |             108 |                48,657 |

184 additional forced-square claims across 84 snapshots; zero incorrect claims in this corpus. Every traced step was checked against all assignments to its input groups; prerequisite order, group provenance, flags and traced/plain agreement were also checked. The two-sided 1-2-1 example now finds both safe squares in opt-in mode. These are synthetic small-board snapshots, not all real games. No completeness or probability guarantee follows from this finite audit.

Run `node --test tests/batch28d-overlap.test.mjs`, `npm test`, `npx tsc --noEmit` and `git diff --check`. The isolated fixture used the uploaded solver and a fail-fast hash stub; complete repository verification is still necessary.
