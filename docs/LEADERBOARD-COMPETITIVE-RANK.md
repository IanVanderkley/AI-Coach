# Batch 23G.2 — Competitive leaderboard rank presentation

The Elo board derives the rank name, division, color and emblem from each existing public saved rating using the shared competitive rank policy and original emblem component. Position remains the server-derived ordinal. All eight ranks are supported; Omniscient has no numeral. The Fastest Wins board, public response contract, read-only route, privacy-filtered views, and eligibility rules are unchanged. The old public formula copy is replaced with a link to the rating guide. Policy metadata, starting rating and legacy helpers are deferred to 23G.3 for coordinated rollout.

## Verification

- With local Supabase, compare a visible player's rank and Elo with their profile and lobby.
- Toggle Anonymous mode in Settings; refresh both public boards and verify the player is hidden. Restore the original setting after the test.
- Check position ordering, Fastest Wins, empty state and mobile table scrolling.
- Run the full build and tests before committing. No hosted deployment or migration in this patch.
