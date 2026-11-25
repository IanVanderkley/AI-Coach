# Ranked move revisions

Ranked reveal, flag and chord requests carry `expectedMoveCount`, the revision of the board the client observed. The new five-argument RPC overloads lock the owner-scoped active match and compare that count before delegating to the existing gameplay function in the same transaction. Stale or completed moves return HTTP 409; a missing/invalid revision on an authenticated request returns 400. No automatic mutation retry is performed. The client reloads the active board after an uncertain move, or directs the player to history if the match is no longer active. If recovery fails, the board is hidden until recovery succeeds. Recovery locks the match in share mode before reading state to avoid mixing board revisions. Rewards and rate limits are unchanged.

## Deployment order

Apply the additive migration to a local database and test first. Before a later approved hosted rollout, verify the deployed recovery function matches the baseline (except the new lock), apply the database migration before deploying the new server, and verify hosted performance. The old four-argument server-only RPCs are retained so the current deployed server keeps working; replay protection applies only to the new API. Older browser tabs on the new server must reload to send a revision. Never grant these functions to browser roles. No remote deployment is part of this patch.

## Verification

- Run the Node test suite and `npm run check`.
- Run `tests/sql/ranked-move-revisions.sql` against the local Supabase database with `psql -v ON_ERROR_STOP=1`; it rolls back the test data.
- Open the same signed-in account in two tabs. Start/resume one active match, refresh both tabs to the same board revision, then flag a hidden square in tab A and try another valid move from tab B without refreshing. Tab B should receive a 409 and refresh to the current board, without reversing the first flag. Intentionally unflag after refresh; only the new move should succeed. Repeat with reveal and chord where legal. Verify normal play, finish a game, check history, XP and Elo.
- A simultaneous-request database test with separate connections is still recommended; sequential replay tests alone are not a concurrency benchmark.
