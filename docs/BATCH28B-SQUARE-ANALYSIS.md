# Batch 28B — Individual square analysis

The inspected coordinate is independent of the recorded action. The square analysis panel classifies the selected square as proven safe, proven mine, unresolved, or revealed. It shows independent flag evidence and reuses TeachingProof for the exact ordered derivation chain, including global and subset deductions. It does not infer probability, treat flags as known mines, or change move grading.

## Evidence boundary

For every non-opening teaching move, square analysis always uses the BEFORE snapshot, including while the After board is displayed. The opening board is the exception: it explicitly uses the board after the opening reveal to explain the information then available. If this snapshot contains exposed mines, no solver proofs are calculated from it. The replay solver assumes revealed cells are safe during deduction, so terminal loss outcomes must not be passed into that solver. The existing recorded-move explanation remains separate. Hiding deductions hides the square analysis; selection still works.

The traced solve is memoized per selected replay frame, not per selected square. No API, database, provider, grading, solver algorithm or gameplay changes. No external AI calls.

## Local verification required

- Practice Beginner, Intermediate and Expert; Ranked Intermediate. Check all four classifications and flags (proven, contradicted, unresolved).
- Choose a safe square other than the recorded move; verify the last proof step establishes that coordinate. Select another square and verify step navigation resets.
- Compare / Before / After: verify the same pre-move explanation, including after a loss. Opening: verify the explicitly labeled post-opening snapshot. Inspect a square revealed only later; do not mistake the outcome for earlier evidence.
- Toggle deductions, navigate moves, change game, use keyboard and mobile touch. Check existing recorded-move proof still works and no new horizontal page overflow.
- Run full tests, TypeScript, lint and build before staging. No deployment in this patch.

## Batch 28B.1 — Human-readable coaching

The selected square now leads with a local, up-to-5-by-5 crop of the same visible evidence snapshot used for its analysis. It preserves actual numbers, covered cells, flags and exposed outcomes; blue marks the inspected coordinate, purple marks numbered clues from the final derivation. The crop is not an alternate gameplay board. Distant supporting clues are named rather than squeezed into a misleading local view. The short explanation uses relative positions and the exact groups/counts of the final derivation; earlier proven facts are explicitly identified as prerequisites. The complete original proof chain remains expandable in chronological order and the existing technical detail preference is preserved. No new inferences, hidden board reads, API calls, or solver changes.

Manual checks: select a square whose proof uses distant clues, a multi-step chain, an unresolved flag and a revealed number. Verify the local crop matches the Before board (After only on the opening move), relative positions agree with the crop, the full proof opens and resets when selecting another square, and narrow mobile boards scroll without page overflow.
