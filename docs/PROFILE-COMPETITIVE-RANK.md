# Competitive rank on the player profile

Batch 23G.1 adds a shared rank card to the dashboard and Ranked Statistics page. Both use the existing authenticated, owner-scoped `/api/ranked/lobby-rating` endpoint and the same rank model and artwork as the Ranked lobby. The highest recorded rating is the maximum of the current rating and saved before/after receipt values, including historical v1 receipts. This is not a separate historical rank ledger.

Account XP and existing match statistics are unchanged. Guest, loading and unavailable states do not invent ratings. The card requires the existing Batch 23B database schema and is not intended for release before that migration. No new migration or server-side award changes are included.

## Local verification

- Compare `/profile`, `/profile/ranked` and `/ranked` on the same signed-in account using local Supabase.
- Check rank, Elo, historical high, division progress and all links. Check mobile stacking and signed-out behavior.
- Finish a Ranked game and revisit the profile; saved values should match the lobby and receipt.
- Run `npm run check && npm test && git diff --check` before committing.
