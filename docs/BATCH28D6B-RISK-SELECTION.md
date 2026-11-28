# Batch 28D.6b — Explain equal risk and verify selected-square probabilities

No solver or grading changes. On the same evidence snapshot, covered squares with no neighboring revealed clue are exchangeable under the uniform-compatible-layout model. Other squares may also have identical exact risks. Display selected coordinates, adjacent-clue context, number of other squares with the exact same risk (not merely rounded), and a contrasting unflagged uncertain square when available. The comparison is educational, not necessarily a recommendation.

Six new tests verify per-index lookup on a shared snapshot, constrained vs unconstrained odds, exact peer counts, flag independence, contrasting square selection, and UI source wiring. The reconstructed fixture uses a stub replay hash; browser testing on the user's actual recording and full repository type checking are still required. This patch does not establish whether the reported identical odds were correct for that recording.
