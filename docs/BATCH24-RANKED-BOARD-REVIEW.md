# Batch 24 — Completed Ranked board inspection

The existing reveal/chord RPCs send `minePositions` and `hitMine` on loss only. On a server-confirmed victory all 216 safe cells are revealed, so the complement of the complete visible board identifies the 40 mines. The client validates terminal status, matching ID, revision, board shape, positions, counts and visible numbers before constructing an inspection snapshot. Invalid or missing data keeps the original read-only visible board and displays an unavailable message.

No API, SQL, authorization, rate limit, game rules, rating or XP changes are required. The snapshot is memory-only and is never used for an active move or stored in browser storage. Historical inspection after refresh or navigation and full replay remain Batch 25 work.

## Local verification

- Lose by ordinary reveal and by a wrong-flag chord; choose View board and check hit mine, other mines, correct/incorrect flags and previously covered safe cells.
- Win a complete Ranked game and check the 40 remaining mines, including flags.
- Inspect the completed board and reopen results; confirm it is read-only and rewards do not change.
- Play again; check that no previous mines, flags or review data remain.
- Check the network response to successful active moves contains no hidden mine layout; do not share sensitive HAR data.
- Verify Practice, mobile horizontal scrolling, keyboard and reduced-motion behaviour.
