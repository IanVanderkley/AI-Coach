# Batch 25C.3 — Shared completed-game analysis

The completed Ranked recording endpoint now adds a `review` object containing
`version`, `score` (the learning-score projection) and `report` (post-opening
rule evidence). Existing recording fields and source metadata remain unchanged.
The database reader retains its verified replay internally, so the server does
not replay the same recording a second time. The API never serializes the full
internal replay or its frame snapshots.

Practice still validates its own checkpoints and uses the same shared
post-opening projection. Both modes use the existing 60% board progress / 40%
proven decision quality formula. Unresolved actions do not invent a grade.
The opening reveal is excluded; raw recording move IDs stay stable. The
existing teaching proof and follow-up projection accepts the shared analysis.
Ranked source provenance comes from the authorized server endpoint, never a
client-supplied source label or a Practice checksum. Learning grades do not
change Elo, XP, placement progress or official results.

No migration, provider calls, dependencies or gameplay move-path changes.
There is not yet a Ranked history review button or report UI. Full cross-account
and revoked-session HTTP tests, browser review testing and performance checks
remain release gates. The existing 1,000-move cap remains in force.

After formatting, run `npm run check && npm test`. Reopen a completed local
match through the recording endpoint: HTTP 200 must include a review with
consistent action counts, a nullable grade and stable raw move IDs. An active
or foreign match must still return 404 with no recording or review. Compare a
Practice review before and after; grades and counts must not change.
