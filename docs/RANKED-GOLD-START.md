# Batch 23G.3a — Gold V starting Elo and local development

New Ranked profiles start at 1,600 Elo (Gold V). Existing profiles, including profiles with zero games, keep their saved ratings. The database column default is the single source for account creation and the fallback profile insert in the server-owned match award function. There is no reset or historical receipt rewrite. The policy v2 formula and receipt version are unchanged. At 1,600, the first win awards 48 Elo and the first loss deducts 21 Elo.

## Local verification

Use the Supabase CLI to create the named migration before applying the installer. Apply pending migrations to the local stack only. Run the existing `tests/sql/ranked-elo-policy-v2.sql` rollback fixture with `ON_ERROR_STOP=1`. It checks confirmed-account initialization, legacy receipt preservation, duplicate guard and a real win from 1,600 Elo. Run all application tests and build. Existing accounts are not expected to change rank after applying this migration.

Start local development with `npm run dev:local`. This reuses the existing launcher, which requires the local API URL and valid local credentials, checks local privileged API access, disables paid AI and account deletion, and binds Next.js to loopback. No changes to `.env.local` are needed. Stop the development server before running a production build. If the launcher refuses startup, verify the local Docker stack is running; do not fall back to hosted credentials.

No hosted migration or release is approved by this patch. Public API metadata and remaining legacy presentation cleanup are separate from initialization.
