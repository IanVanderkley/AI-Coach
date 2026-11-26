# Batch 23H.1 — Ranked victory limits (policy v3)

New verified completions use the existing fixed-benchmark formula with a win reward bounded to +5 through +100, then clamped to the 10,000 Elo ceiling. At 9,999 Elo the actual gain is +1; at the ceiling it is zero. Losses, starting Elo (1,600), rank thresholds, XP, privacy and eligibility do not change. The current curve naturally awards less than +100; the upper bound is explicit, not a promise of a +100 outcome. At high rating, the minimum makes the loss-to-win ratio about 9:1 rather than approaching infinity. Actual population balance still needs real data.

Version 3 is used for new receipts only. Version 1 and 2 receipts remain valid, including v2 zero-point wins. Historical migrations and existing profiles are not modified. The migration checks the existing reviewed function body, widens the receipt version constraint and installs a private pure wrapper around the v2 calculation; verification, row locking and idempotency are unchanged. The lobby and public standings identify policy v3. Coordinate matching app and database rollout; do not run against hosted until approved.

## Local verification

Run the full build and tests, apply the new migration locally and run `tests/sql/ranked-elo-policy-v3.sql` using the local Docker database owner and ON_ERROR_STOP. It rolls back all fixtures. The older `ranked-elo-policy-v2.sql` fixture is for pre-v3 databases only; v3 includes its historical and formula checks. Verify existing accounts, new account Gold V, Ranked loss/win receipts, leaderboard, profile and rating guide. Do not deploy until release gates pass.
