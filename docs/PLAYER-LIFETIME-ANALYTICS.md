# Player analytics — Batch 7A: verified Ranked lifetime and Practice difficulty

## What is now genuinely lifetime

`GET /api/profile/ranked-lifetime` is an authenticated, **read-only** route. It uses the trusted `getUser()` result, then private server credentials to count **all** matching official `ranked_verified_results` wins and server-owned `ranked_matches` losses (status `lost`). It uses exact PostgREST counts, not the ten-row recent-history limit. A verified win time can be read only from the official win table. This is currently **Intermediate only (16×16, 40 mines)** because that is the sole server-supported Ranked ladder. Active and abandoned matches never count. There is no RP calculation, XP award, result submission, cross-account query, client-supplied user ID, or database migration.

The new Ranked card shows the scope **SERVER-VERIFIED LIFETIME**, its win rate and fastest verified win. The existing main overall snapshot intentionally remains **recent saved records**, because it currently combines the latest ten Ranked results and saved Practice history.

## What is not lifetime

Practice history currently stores up to **100 account games** and **5 browser-tab games**. The retention cleanup deletes older recordings, so querying that table is not enough for historical lifetime totals. The new Practice difficulty panel therefore computes games, wins, losses, win rates, and fastest recorded wins **from the recordings currently available**, split into Beginner (9×9/10), Intermediate (16×16/40), and Expert (16×30/99). Practice results are _client-recorded_, not independently verified by the Ranked server. Invalid input causes the panel to show unavailable rather than silently omitting bad records.

If the signed-in Ranked endpoint is unavailable, the Ranked mode card displays an unavailable `—` state rather than manufacturing zero wins. This failure must not prevent viewing existing Practice recordings. The `Cache-Control: private, no-store` response and authenticated account filtering protect per-account data.

## Next prerequisite for true combined lifetime statistics

Design and stage-deploy an **owner-readable, trigger-owned Practice lifetime aggregate** with a counting policy that distinguishes initial inserts, retries/upserts, account deletions, retention pruning, guest-to-account imports, and mutable outcomes. Existing recordings can only give a lower bound if older records were already trimmed. Track the exact _start of coverage_ rather than falsely presenting incomplete historical Practice totals as complete. Only once that is verified should the main overview switch from recent to lifetime totals.

## Verification

Run the installer dry-run and apply, `npx prettier . --write`, `npm run check`, `npm test`, `git diff --check`; confirm `/profile` shows sensible totals and no anonymous/foreign account stats. Check the 16×16/40 Ranked count against an authorized staging read-only query. Confirm the existing collapsible history sections and navbar level badge remain working. Do not touch unrelated `.vscode/settings.json` or merge the feature branch before reviewing browser results.
