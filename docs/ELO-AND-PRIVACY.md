# Ranked Elo-style ratings, usernames and anonymous mode — Batch 11

## Current scope

- Two public boards: **Elo-style Rating** (rating, wins, losses) and **Fastest Wins** (one best verified Intermediate victory per opted-in account).
- Every public row includes a chosen **public username**, never an email, user UUID or match ID.
- **Anonymous mode defaults ON**, including existing accounts. While on, **no public leaderboard entry exists** for the player. The filter runs in PostgreSQL before limiting to 50 rows, so hidden players cannot fill slots.
- Signed-in players can configure their public username and visibility in **Settings**. Public names are 3–20 ASCII letters, digits or underscores, unique case-insensitively **among public players**. A username on the private Profile page is not automatically published.
- Personal Ranked history and XP are unchanged by leaderboard visibility. Ratings are computed server-side from official completed matches, with one ledger entry per match.

## How the rating works (honest terminology)

This is **single-player Elo-style rating**, not competitive head-to-head Elo. Only the Intermediate server-hosted board is currently playable. Starting rating = 1000, benchmark = 1000, K = 32. For outcome `S` (1 win, 0 loss), expected score `E = 1 / (1 + 10^((1000 - currentRating) / 400))` and `ratingChange = round(32 * (S - E))`, bounded to ratings 100–10000. Thus a first win is +16, a first loss is -16, and later rewards depend on the current rating. This uses a fixed reference; do **not** claim it measures relative skill against a matched opponent.

The schema migration backfills historical server-recorded Intermediate losses and separately verified Intermediate wins chronologically, without changing XP. New results are processed by an `AFTER UPDATE` trigger on `ranked_matches`. The ledger's `match_id` primary key prevents duplicate applications, and per-user row locks serialize concurrent completions. No browser may write ratings or events directly.

## Security

- The authenticated Settings API identifies the user using `auth.getUser()` on the server, ignores caller-supplied IDs and accepts only `username` and `isAnonymous`.
- The public API reads two **privacy-filtered read-only database views**, and projects only the public fields. View access is `service_role` only and calls are server-side.
- The former anonymous `/api/ranked-results` endpoint must ALSO read from the filtered fastest-results view; it can no longer return private runs.
- Underlying rating and event tables have RLS. Browser roles cannot insert/update ratings, write event receipts or query public raw views. Only a signed-in owner may read their own rating row.
- Client input controls **display only**. Wins and losses come from the existing server-owned Ranked state machine. This patch does not add client score submission.

## Safe rollout

1. Apply Batch 11 application patch **over Batch 10** on `feature/ranked-result-experience-20261123`.
2. Run `npx prettier . --write`, `npm run check`, `npm test` and `git diff --check`. Do not deploy yet: the new API will fail closed until the migration exists.
3. Generate a migration filename with `npx supabase migration new ranked_elo_visibility` in the repo. Copy the reviewed `docs/LEADERBOARD-ELO-PRIVACY.sql` into that generated file. Do not invent a migration timestamp.
4. **Confirm the target is AI-Coach-Staging `bzjkmiwwrpcshumamkvq`, not MindSweeper or an unrelated DB.** Review the migration and staging backup options, then explicitly decide whether to apply it. Do not run `supabase db push` without checking its target and migration preview.
5. On staging, test server-created win/loss → 1016/984 starting from 1000, exactly one rating event per match, same account after refresh, historical records, and absence of client write grants.
6. Test opt-out using Accounts A and B: both hidden by default; enabling public visibility for A shows A; setting A anonymous removes BOTH A's speed result and rating, even after refresh, while A's private statistics and XP remain.
7. Only after the above passes should you deploy with `npx vercel deploy` (Preview, **not** `--prod`). Confirm both protected Preview links and data match.

Do not use production for the first rollout. Do not change the paid AI provider settings.
