# AI-Coach

AI-Coach is an AI-powered Minesweeper coaching platform designed to help players improve their skills through gameplay analysis, personalized feedback, and competitive play.

Built with Next.js, React, TypeScript, Tailwind CSS, and Supabase.

## Getting Started

Use Node.js 22 or newer.

Install dependencies:

```bash
npm ci
```

Start the development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Current Features

### Minesweeper Gameplay

- Beginner, Intermediate, and Expert difficulties
- First-click protection
- Revealing and flagging cells
- Chording functionality
- Game timer and mine counter
- New Game button
- Win and loss detection

### User Accounts

- Supabase email/password registration, sign-in and sign-out
- Player dashboard at `/profile` and dedicated `/profile/ranked` and `/profile/practice` pages
- Account progression from server-owned Ranked match XP receipts; compact result progress bars
- Account-scoped tracked Practice statistics, with client-recorded outcomes clearly labelled

### Practice History and Verified Replays

- Guests retain up to five finished Practice recordings in their current browser tab
- Signed-in players sync up to 100 recent complete recordings to their account
- Tracked account statistics persist after older Practice recordings are trimmed; historical games already deleted before tracking are not recoverable
- Practice statistics are account-recorded, not independently verified Ranked accomplishments
- Move-by-move verified Coaching replay is available for retained recordings

### AI Coaching

- Dedicated Coaching page with recorded sample games
- "Analyze my last game" action backed by browser storage
- Automatic post-game analysis under the board after every real game
- Game analysis using a rule-based engine
- Optional AI-generated explanations through an external provider
- Reports highlighting gameplay decisions and improvements
- Coaching API at `/api/coach`

The Coaching page keeps two recorded sample sessions so the analyser can be tried
without playing. Finished games from the Play page are sent to the same API
automatically and their report appears under the board. The API accepts real
games on any board up to 16 × 30 (Expert).

### Settings

- Coaching style preferences
- Explanation detail and experience settings
- Personal improvement goals
- Local browser storage for preferences

Coaching preferences are sent to `/api/coach` and shape the wording of a report.
Account-backed persistence still depends on the configured Supabase project.

### Ranked System

- Authenticated, server-controlled Intermediate (16 × 16, 40 mines) Ranked gameplay
- Server-verified victories, server-owned losses, verified result history and lifetime statistics
- Read-only official fastest-time leaderboard and owner-scoped account XP receipts
- Verified wins earn 125 XP; legitimate losses earn 10 XP; Practice currently earns no XP
- RP, rank tiers and placements are **not** implemented yet

## Project Structure

- `app/` - Website pages and API routes
- `components/play/` - Minesweeper and navigation components
- `components/account/` - Authentication components
- `components/coach/` - Coaching interface
- `components/settings/` - Settings interface
- `lib/coach/` - Coaching analysis engine
- `lib/supabase/` - Supabase connection helpers
- `lib/settings/` - Settings preferences and storage
- `docs/` - Project documentation
- `styles/` - Website styling

## Environment Variables

Create a `.env.local` file to configure Supabase authentication and optional AI providers.

Required for Supabase:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Optional AI provider configuration is documented in `.env.example`.

Never commit API keys or secret credentials.

## Development Status

AI-Coach is actively developed. The current staging backend supports account-backed
Practice recordings/statistics, server-owned Ranked results and XP. Public launch
is **not yet approved**; deployment prerequisites and known blockers are recorded
in [docs/DEPLOYMENT-READINESS.md](docs/DEPLOYMENT-READINESS.md).

## Testing

`npm run check` checks formatting, production build and TypeScript;
`npm test` runs regression and security-contract tests. Neither substitutes
for authenticated browser E2E testing.

For AI-Coach-Staging **preview preflight**, after configuring a private `.env.local`:

```bash
node --env-file=.env.local scripts/verify-deployment-config.mjs --target=staging
```

With a staging-configured local server running, `node scripts/check-ranked-http.mjs`
performs anonymous local-only API smoke checks. See the deployment runbook
before attempting any Vercel Preview deployment. Never run a remote smoke or
database migration as part of this check.

## Team Collaboration

Team members develop features in separate Git branches before merging into master. Shared features should be tested together before changes are considered complete.
