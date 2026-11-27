# Batch 27I — Global footer and FAQ

Baseline: 02d5a750742f8e1bb591c20ea4ff1a0c1c1c2f8d (Batch 27H). UI and documentation only.

- Shared SiteFooter in root layout, normal document flow (not fixed over gameplay). Help links target the real FAQ page and section IDs. Privacy & history is informational, not a formal privacy policy.
- Remove duplicate Practice page footer. Ranked lobby rules link goes to FAQ; retain the existing `/ranked/rating-guide` route and link to it from FAQ for compatibility.
- Native expandable FAQ, responsive contents navigation and tables, no new data requests or dependencies. Rank tiers and level threshold are imported from current policy modules. XP copy follows migration `20261127075242_xp_economy_v2.sql`; final guess follows `20261127073716_ranked_final_guess_settlement.sql`; Practice scope follows `docs/PRACTICE-ACCOUNT-TRACKING.md`; coaching score and move assessment follow `docs/FAQ-COACHING-CONTENT.md`.
- No changes to awards, security, auth, database, replay, account preferences or paid AI. Preserve 27H and Batch 28 roadmap.

## Local verification

Run `npm test`, `npm run typecheck`, `npm run build`, `git diff --check`. Browser: visit Practice, Ranked lobby and active board, Profile and detail pages, Leaderboard, Coaching, Settings, sign-in and FAQ. Confirm exactly one global footer at the bottom of each page, no interference with board controls or overlays, all links resolve, and all FAQ questions can be expanded via keyboard. Check mobile and narrow viewport widths. Verify the rating table, current XP numbers, two moved coaching explanations, and Anonymous mode explanation. Test old rating-guide URL. No deployment until 27J review.
