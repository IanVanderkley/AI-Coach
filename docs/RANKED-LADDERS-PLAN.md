# Ranked history and ladder readiness

## Implemented in this batch

- `GET /api/ranked/history` uses server-verified authentication (`getUser`) and owner-scoped queries against backend-only Ranked matches, verified wins, and the owner-readable XP receipt table. It returns **only the latest ten server-recorded completed Intermediate games**, excluding wins without a verified-win record. It never returns user IDs, match IDs, hidden mine locations, or other players' data.
- The Profile page shows a private recent-W/L summary and history with actual receipt-backed XP where available. These are **recent-match counts**, not lifetime statistics.
- The Ranked page displays three difficulty cards as a roadmap. **Only Intermediate (16×16/40)** is playable using the existing server RPCs. Beginner (9×9/10) and Expert (16×30/99) are explicitly marked planned rather than wired to incompatible functions.
- No migration, XP reward adjustment, RP award, or change to Ranked gameplay is made by this batch.

## Security and release review

The API must authenticate on every GET, perform all three database lookups with the verified user's ID, and return `Cache-Control: private, no-store`. Server data is checked before projection. Verified-win history requires a database verification row; an XP amount requires a matching receipt. A missing receipt is **unknown**, not `0 XP`. Browser input cannot submit history results.

Test signed-out requests (401), user A vs B isolation, empty history, historical outcomes without receipts, and unavailable staging database. `npm run check`, `npm test`, and browser review are required before merging.

## Still to decide before enabling RP

The current AI-Coach project has **no approved competitive RP formula, placements, rank tiers, or rating decay rules**. Do not borrow RP values from the separate CPRG303 MindSweeper project. Define a versioned server-owned policy first, including placement rules, win/loss changes, floor/demotion behavior, difficulty independence, anti-abuse checks, historical/backfill decisions, and ranked reset policy. Only then create a private per-match RP ledger, own-row RLS profiles, and server-triggered awards in a **staging-first migration**. No browser-local result may grant RP.

The Beginner and Expert server gameplay functions must also be implemented and verified with dimension-specific board generation, first-click safety, flag/chord/reveal validation, and authenticated recovery before their Ranked cards can be playable. This is not a cosmetic toggle.
