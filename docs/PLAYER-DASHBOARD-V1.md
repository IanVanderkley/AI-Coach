# Player Dashboard — first release slice

## Implemented

- Replaces the oversized Profile XP card with a compact, verified `LVL N` navbar badge. This uses the existing read-only player XP lookup and fixed 1,000-XP progression. Failed or signed-out lookups display **no invented level**. The indicator reloads on navigation or account switch.
- Reorganizes `/profile` with **overall performance first**, two independently collapsible Ranked and Practice summary cards below it, and the existing independently collapsible recent match histories after those cards. Previous match history behavior and server-owned rewards are unchanged.
- Shows recorded games, wins, losses, and win rate from the **currently available** recent records. All aggregates are display-only. Practice uses the same local/account repository as the history list; Ranked uses the already-authenticated `/api/ranked/history` response. No new endpoint, database permission, or reward mechanism is added.
- A missing Ranked response, missing sign-in, or failed Practice load makes the overall combined summary unavailable (`—`) instead of silently treating that mode as zero. A genuinely empty successfully loaded list counts as zero games, with win rate unavailable (`—`).

## Honest labels and limitations

This is **not lifetime player analytics**. Ranked history returns a maximum of ten latest completed Intermediate matches. Practice has its own retention policy (up to five browser-tab games or one hundred account games). Combining the two is a **recent-record snapshot**, not a lifetime win rate, account-wide win count, competitive rating, or cross-device guarantee. We do not backfill or manufacture records.

## Later work for deployment-quality analytics

- Introduce privacy-safe lifetime aggregates that account for historical Ranked games and Practice retention, and clarify guest-to-account migration and deletions before calling any number lifetime.
- Add dedicated `/profile/ranked` and `/profile/practice` breakdowns with difficulty-specific metrics, fastest verified wins, and trends. Do not display unsupported RP or simulated Elo.
- Add authenticated end-to-end browser tests for account switching, missing histories, navigation after winning, refresh, and responsive keyboard interaction.

## Local verification

Run `npm run check`, `npm test`, `git diff --check`, then verify `/profile` in an authenticated browser: top overview, summary card toggles, historical card toggles, nav level badge, and layout on mobile. Confirm a guest never sees another player's records.
