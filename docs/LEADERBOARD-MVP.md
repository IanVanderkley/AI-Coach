# Batch 10 — Verified Ranked leaderboard MVP

This batch adds a read-only `/leaderboard` screen and navigation link. It does not
change Ranked gameplay, authentication, XP, database permissions, SQL, or any
existing API contract.

## What the page shows

- Up to 50 **server-verified Intermediate Ranked wins** (`16 × 16`, `40 mines`),
  sorted by fastest recorded time and completion date.
- A numbered position, verified elapsed time and completion date for each run.
- Explicit loading, empty, error and retry states; manual Refresh for new wins.
- Dark responsive design, keyboard-accessible controls, and a screen-reader
  table caption.

It intentionally **does not show usernames, match IDs, email addresses or RP**.
The existing public `/api/ranked-results` endpoint returns no trustworthy
player-display-name field, and the UI never guesses identities. Player names
require a separately reviewed privacy-safe public profile policy and API.

## Validation

From the project root after applying the patch:

```bash
npx prettier app/globals.css components/play/navbar.tsx app/leaderboard/page.tsx components/leaderboard/verified-leaderboard.tsx lib/leaderboard/verified-leaderboard.ts styles/leaderboard.css tests/leaderboard-mvp.test.mjs --write
node --experimental-strip-types --test tests/leaderboard-mvp.test.mjs
npm run check
npm test
```

Manually verify `/leaderboard` while signed in and signed out. When the staging
API has verified wins, check the ranked rows against its public API. Test a
refresh, narrow viewport, and empty/unavailable API conditions. A successful
`npm run check` alone is not a substitute for browser testing.

## Deployment boundary

Commit and push only after tests and browser review. `npx vercel deploy` from the
linked local project creates a **protected Preview** now that the initial
production deployment has already occurred. Do not use `--prod` for this batch;
paid AI stays disabled and the approved AI-Coach-Staging environment is reused.
