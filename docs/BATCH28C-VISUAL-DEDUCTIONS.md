# Batch 28C — Guided visual deductions

The square analysis presents the final verified deduction in two or three short steps. It uses the same visible evidence snapshot as 28B, not the live mine layout. The main Before/After boards retain their existing recorded-move overlays; the progressive overlays are in the actual replay crop within Square analysis. The crop expands to include all cells from the final proof, with scrolling for global deductions.

A/B markers distinguish shared and extra covered squares. Earlier proven mines/safe cells are explicitly labeled and never inferred from flags. The final step highlights exactly the solver's result. The original flags/numbers remain visible; markers are explanatory, not game actions. The full dependency chain remains available in the existing proof disclosure. Selecting another square or move remounts the lesson through the existing panel key. Unresolved/revealed squares retain the previous presentation.

No changes to the solver, APIs, database, grading or provider policy.

Manual checks: compare subset, direct and global deductions; navigate forward/back/restart; inspect another square and move; toggle deductions; compare Before/After and terminal/opening snapshots; verify all Practice difficulties and Intermediate Ranked; keyboard, narrow mobile layout and wide scrollable crop; full proof remains accessible. Run full tests, typecheck, lint/build before staging.
