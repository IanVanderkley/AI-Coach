# Ranked lobby — Batch 23E

The lobby, active gameplay and post-match result are separate UI phases within the existing `/ranked` route. Starting and resuming use the original server match flow. The progression timeline is mounted only after successful recovery confirms either no active match or a saved match requiring explicit resume. It unmounts when play begins. Existing board controls, move queue, server verification and result dialog are retained. Returning to the lobby performs fresh recovery, rather than creating a new match or trusting local state.

The read-only `/api/ranked/lobby-rating` endpoint verifies the account, uses the existing Ranked read rate limit, selects only that owner's profile and maximum historical rating before/after, and returns a strict projected response with private no-store caching. Highest recorded rating is calculated from the existing receipt history and current rating; it is not an independent permanent achievement ledger. The policy-version column must exist before v2 estimates are shown. The v2 migration and UI must be released together after verification. The UI displays estimates only; the verified SQL receipt remains authoritative.

All eight original WebP emblems appear on the timeline; the current and highest rank show dynamic divisions. The marker interpolates between tier thresholds, and division progress uses the exact next 100-point milestone. No preview slider, editable rating or client award exists. Smaller screens may scroll the timeline horizontally. A failed rating request never blocks valid match controls or fabricates a score.

## Local manual checks

- Fresh signed-in account: Bronze I at 1000, +63 / -13 estimates; all eight milestones visible.
- Start a match: lobby disappears, board and existing controls remain. Refresh while active: resume prompt and lobby return; Resume restores the same match and hides the lobby.
- Finish a match: existing result dialog opens. Return to lobby reloads verified account rating; Play again starts through existing flow. Closing the dialog still allows viewing the finished board.
- Signed-out account: sign-in notice, no fake rating or Start action. Failed rating endpoint: retry details and no invented rating.
- Narrow screen: timeline scrolls, no page-wide overflow. Verify actual WebP appearance and division position.
- Check existing verified Elo/XP receipt and SQL tests. Do not push the hosted migration or deploy this branch yet.
