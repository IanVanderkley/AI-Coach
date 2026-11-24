# Batch 9 — AI-Coach preview deployment readiness

This is a **preview checklist**, not permission to deploy publicly. Do not run
`supabase db push`, migration repair, reset, or production SQL as part of this patch.

## Target and boundaries

- App: AI-Coach, not the separate MindSweeper mobile or Supabase project.
- Approved preview database: **AI-Coach-Staging**, `bzjkmiwwrpcshumamkvq`.
- Original MindSweeper project `squusumcekygqdkaabcm` must not be used.
- No Vercel deployment or database mutation is performed by this patch.
- Paid AI stays disabled: `COACH_PAID_AI_ENABLED=false`; leave provider keys unset unless separately approved.
- Ranked experimental claims mode must not be enabled: neither `RANKED_AUTH_MODE=claims` nor `RANKED_AUTH_PROBE=claims`.

## Preflight from the project root

Use Node 24 (see `.nvmrc`), then:

```bash
npm ci
npm run check
npm test
node --env-file=.env.local scripts/verify-deployment-config.mjs --target=staging
```

The final command checks **names and presence** of server-only and public Supabase
keys, the exact staging URL, release flags, and obvious secret exposure. It never
prints key values and makes no network requests. In an environment that already
supplies variables (e.g. a hosted preview build), omit `--env-file=.env.local`.
The older `scripts/verify-ranked-config.mjs` delegates to the same approved
staging validator. It no longer expects the unrelated MindSweeper database.

Only these browser variables are expected:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
Server-side Ranked routes additionally need `SUPABASE_SECRET_KEY`; **never** use
a `NEXT_PUBLIC_` prefix for it. Keep `.env.local` local and git-ignored.
A valid preflight does **not** prove that keys have correct database permissions.

## Local anonymous HTTP safety checks

Start the app using the staging configuration:

```bash
npm run dev
```

In a second terminal:

```bash
node scripts/check-ranked-http.mjs
```

The script accepts only localhost HTTP, sends no credentials, and does not submit
a valid Ranked result. Its checks include unauthenticated Ranked history and
lifetime statistics, plus server-side game creation, move validation, origin
protections and leaderboard shape. It must **never** be pointed at a preview or
public host. A failed check is a blocker for further release testing.

## Preview on Vercel (later, after review)

1. Create a **Preview** deployment from the feature branch, not a Production deploy.
   Verify project ownership, preview protection, and intended Git branch before connecting.
2. Set Preview-scoped `NEXT_PUBLIC_SUPABASE_URL` to the approved AI-Coach-Staging
   host, plus `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and server-only
   `SUPABASE_SECRET_KEY`. Do not copy secrets into client variables.
3. Keep `COACH_PAID_AI_ENABLED=false`; do not set experimental claims flags.
4. Run the preflight with the Preview environment variables and inspect the build logs.
5. Configure the preview origin in **Supabase Auth redirect allowlists** only after
   confirming the preview URL; do not use wildcard redirects for public hosts.
6. Test sign-in, refresh, sign-out, sign-in as another account, and account switching
   in a fresh browser profile. Confirm user B never sees user A's stats or matches.
7. Test signed-in Practice Beginner/Intermediate/Expert, account syncing, tracked
   totals after refresh, collapse/filter, and lost-connection recovery.
8. Test Ranked start/reveal/flag/chord/win/loss with a staging account, earned XP
   receipt, leaderboard, recent history and verified lifetime totals.
9. Check mobile widths (e.g. 390px and 768px), keyboard navigation, contrast,
   result dialog scrolling and reduced-motion preferences.
10. Check failure states: signed-out direct visits to private routes, wrong session,
    Supabase outage, malformed requests and restricted origin handling.
11. Verify deployment logs do not contain credentials or internal exception data.
    Review rate limits, traffic protection, backup/restore, monitoring and rollback.
12. Only after the preview is reviewed should a separate production deployment
    plan be created. This staging preflight explicitly rejects `VERCEL_ENV=production`.

**Important:** Next.js inlines `NEXT_PUBLIC_` environment variables into browser
bundles at build time. Configure the intended preview values **before** building.
References: https://nextjs.org/docs/app/guides/environment-variables and
https://vercel.com/docs/environment-variables .

## Existing known blockers (not changed in Batch 9)

- Auth leaked-password protection is disabled in AI-Coach-Staging; review the
  Supabase security advisor before any public release.
- Paid AI requires separate budget and provider security review.
- Competitive RP, placements and rank tiers are not yet implemented.
- Historical `docs/STAGING-MIGRATION-ALIGNMENT.md` reflects a pre-install state;
  consult current Supabase migration history instead of replaying old commands.
- The existing tests are mostly unit/contracts, not a full authenticated two-account
  browser E2E suite. Do not claim public-launch readiness from green unit tests.

## Release gate

Batch 9 is complete after project checks, staging preflight, anonymous localhost
smoke, and a human browser review pass. That is **preview preparation**, not a
production launch. Any failed gate blocks the preview until resolved.
