# Batch 8 — Dedicated Statistics Pages and Compact Result XP

## Pages

`/profile/ranked` shows authenticated server-verified lifetime Intermediate stats using the existing read-only `/api/profile/ranked-lifetime` response and recent history from `/api/ranked/history`. It does not invent RP, Beginner/Expert ladders, or victories. Signed-out and server-error states remain separate.

`/profile/practice` shows the current user's saved Practice history. After cloud synchronization, it reads their owner-scoped `practice_account_totals` when available. The UI explicitly distinguishes **tracked account results** from **recent saved records** and allows filtering displayed match history by Beginner, Intermediate, or Expert without altering storage. The history list remains retention-limited even when tracked totals increase.

Both pages link back to `/profile`. The two summary cards on `/profile` gain links to their dedicated pages and retain their existing anchors into recent match history.

## Compact XP

The Practice result dialog shows the player's current level, XP within the level, and remaining XP using the existing read-only `loadPlayerLevel()` and `calculateLevelProgress()` utilities. No Practice XP is awarded or implied. Guests and unavailable account reads show an honest status instead of fabricated numbers.

Ranked continues to use its server-verified XP receipt and saved account progress, now with a smaller visual footprint in the result dialog. Existing server-only reward rules (+125 verified win / +10 legitimate terminal loss) are unchanged. Progress resets at every 1,000 XP as before.

No migrations, database writes, account XP grants, or new API endpoints are introduced in this patch.

## Verification

Run `npm run check`, `npm test`, and `git diff --check`. In a signed-in browser visit `/profile`, `/profile/ranked`, and `/profile/practice`; check navigation, lifetime vs tracked labels, Practice difficulty filtering, both modes' match lists, and compact account progression after finishing each game mode. Test a guest Practice result too. Never claim Practice XP earned.
