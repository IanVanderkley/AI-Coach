# AI-Coach Batch 12 — last development batch (staging-first)

## Included

- New Ranked profiles appear on the public rating and fastest-win boards by default.
  The user's registered username is used where available and unclaimed; a neutral
  public alias is assigned otherwise. The player can edit the public name in Settings.
- Existing accounts and their saved Anonymous mode selections are **unchanged**.
  Current users who opted out remain private until they choose otherwise.
- Both leaderboards remain filtered **inside PostgreSQL**, before limiting rows.
  No email address, auth user ID or match ID is publicly returned.
- Leaderboard hero and standings cards share a single container width, predictable
  padding, and aligned empty states. The Settings visibility card aligns with the
  other settings content rather than drifting under the sidebar.
- Top-three placement medals and cosmetic rating milestones (Bronze, Silver,
  Gold, Platinum, Diamond) are presentation labels only. No competitive RP,
  matchmaking, placements or promotion mechanics are promised.
- Ranked result dialog shows an actual owner-scoped, saved rating-event receipt:
  previous rating, +/- delta, new rating, cosmetic milestone, and leaderboard link.
  Receipt lookup is read-only, auth-guarded, and filtered on **both** match ID and
  verified owner. Missing data is reported as missing; never fabricate an award.
- XP rewards and the existing outcome flow are unchanged.

## Local install and verification (Git Bash from project root)

```
node ai-coach-final-batch12/apply-batch12.mjs --dry-run
node ai-coach-final-batch12/apply-batch12.mjs --apply
mv ai-coach-final-batch12 ../ai-coach-final-batch12-package
npx prettier . --write
npm run check
npm test
git diff --check
```

**Before database push:** Create a new migration with the Supabase CLI (do not
replace or edit the already-applied Batch 11 migration):

```
npx supabase migration new ranked_public_default
migration_file=$(ls -t supabase/migrations/*_ranked_public_default.sql | head -n 1)
cp docs/LEADERBOARD-PUBLIC-DEFAULT.sql "$migration_file"
cat supabase/.temp/project-ref
npx supabase db push --dry-run --remote
```

The project ref **must be** `bzjkmiwwrpcshumamkvq`, and only the newly generated
`ranked_public_default` migration must appear in the dry run. After confirming
both, explicitly run `npx supabase db push --remote` to apply it to **staging**.
DO NOT run `--prod`, migrations, or database resets against another project.

## Staging acceptance checks

1. Login as the previously-hidden account: its Anonymous mode must stay enabled
   and both public leaderboards must remain free of its entries.
2. Use a NEW test account that has not played Ranked. Its visibility switch
   should default **off** (public). Complete one server-verified Ranked game.
   Confirm the new profile appears in rating standings with the registered
   username (or a generated alias if the registered username is taken/invalid).
3. Toggle Anonymous mode on for the new account and refresh both boards. Its
   entries must disappear, while private profile history, XP and rating persist.
   Toggle it off; public standings should return.
4. Finish a Ranked win or loss with a signed-in account. Check the result shows
   exactly the saved before/delta/after event, including zero when bounded.
   Refresh/reopen the result: no duplicate event or extra rating is granted.
5. Sign into a separate browser profile as Account B. B must not view A's
   private rating receipt, and vice versa. Signed-out access to the receipt API
   must return 401 for a syntactically valid match ID.
6. Verify mobile at 390px and 768px, desktop, tabs, refresh, keyboard focus,
   dialog scrolling, and reduced motion. Recheck no horizontal layout overflow.
7. Run existing staging preflight and localhost-only HTTP checks:

```
node --env-file=.env.local scripts/verify-deployment-config.mjs --target=staging
# In another terminal after npm run dev:
node scripts/check-ranked-http.mjs
```

If the local checks and staging tests pass, commit only the feature files,
including BOTH migration files and documentation, not `.vscode/settings.json`
or `.env*`. Deploy a new protected **Preview** with `npx vercel deploy`
(without `--prod`), then repeat smoke checks and inspect the Vercel logs.

## Production readiness evaluation — BLOCKED for public release

As checked on 2026-11-24:

- Vercel project `ai-coach-staging` still has Vercel Authentication on **all**
  deployments. The first automatic Production-target deployment is protected;
  do not confuse it with a tested production launch.
- Four required Supabase environment variables are Preview-scoped only.
  Production credentials and a separate production database/release plan
  have **not** been reviewed or configured.
- Supabase Auth leaked-password protection remains disabled according to the
  security advisor. Review: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Current tests are not a complete authenticated two-account end-to-end suite.
- Competitive RP and real placement tiers remain unimplemented. The cosmetic
  milestones in this patch are NOT competitive ranks.
- Paid AI remains disabled (`COACH_PAID_AI_ENABLED=false`).

**Outcome:** Staging development is viable after all checks pass; PUBLIC
PRODUCTION RELEASE IS NOT APPROVED or performed by this patch.
