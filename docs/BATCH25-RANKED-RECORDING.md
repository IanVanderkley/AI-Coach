# Batch 25C.2 — Completed Ranked recording boundary

The new read-only `GET /api/ranked/coaching/recording?matchId=<uuid>` endpoint
retrieves a completed, server-owned Intermediate Ranked game for its owner.
This is a backend foundation, not the Ranked Coaching UI. The existing Ranked
history endpoint and its deliberately limited summary response are unchanged.
The history selector and Coaching workspace will be connected in later stages.

## Trust boundary

- Cryptographically verified Supabase claims identify the requester. The existing
  server-only `ranked_session_is_active` RPC rejects revoked or inactive sessions.
  The existing database-backed Ranked read limiter applies. Requests from other
  browser origins are rejected. Responses are private and not cached.
- The requested match must belong to the verified account and have a terminal
  `won` or `lost` status. An active, abandoned, absent or foreign match is treated
  as unavailable. The server does not read its mine layout or move log.
- Wins require a matching official result. Losses must not have a matching
  official victory record. Board dimensions, duration and terminal metadata are
  validated before reading the state. No Elo, rank, XP or account ID is returned.
- The state and move log come exclusively from service-side database queries.
  Move revisions must be contiguous, exact in count and valid. The query asks
  for the exact count as well as the ordered rows, so a truncated recording is
  not silently accepted. The first reveal must have its server-guaranteed safe
  neighborhood. Mine, flag and revealed position sets must be valid and unique.
- The existing deterministic replay must reproduce the stored terminal outcome,
  change the board on every move, and match the final safe-reveal and flag sets.
  On loss, the teaching replay shows mines, but the database retains only safe
  revealed positions. That display difference is normalized before comparison.
- Only the completed recording and minimal match metadata are returned. It is
  structurally compatible with the existing replay input, but `source` on a
  browser object is not proof of authenticity. Never accept a client-submitted
  recording or source label as a verified Ranked game in future server features.

The initial recording cap is 1,000 moves. Larger recordings are rejected rather
than partially reviewed. Server `received_at` values are validated as timestamps,
not used as elapsed move times: transaction timestamps need not be monotonic in
committed move order. The original match duration is retained, and move-level
timing is omitted until a reliable representation is available.

## Verification

Run formatting, `npm run check`, and `npm test`. The boundary tests use a controlled
store and replay fixture. Separate integration tests compare the real shared
replay with independently constructed Ranked win, reveal-loss and chord-loss
states, including a committed no-op rejection.

For local HTTP verification, sign in with a disposable local account and open
Ranked. In the browser Network panel, obtain the match ID from an active match's
current-board response. While the game is active, a request to the new route
must return 404 and no recording. Finish the same game, then retry: a valid
recording returns 200, has the correct terminal outcome and move count, and has
no Elo or account ID. Verify an invalid UUID returns 400; a valid ID from another
account returns 404; a signed-out request with a valid ID returns 401. Exercise
both wins and losses and a revoked session before release. Use only local test
accounts and avoid pasting cookies or full recordings into chat.

There are no database migrations, dependency changes, gameplay move-path
changes, provider requests, or production deployments in this patch. The next
stage is shared analysis integration, then the authenticated history selector
and review UI. Keep paid AI disabled. Full HTTP, authorization and performance
acceptance remain release gates.
