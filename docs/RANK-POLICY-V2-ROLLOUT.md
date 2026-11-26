# Batch 23B — Server-owned rating policy v2

Local-only until the matching rank UI and API are ready. The current live application shares the hosted Supabase database. Do not push this migration remotely as part of Batch 23B.

The new migration adds a policy version to the existing receipt ledger (historical receipts default to version 1), then replaces only the calculation inside the existing verified-match award function. New receipts explicitly record version 2. The existing row lock, receipt primary key, verified-win gate, private function permissions, server-owned completion trigger, initial rating and profile totals remain in place. No historical match replay or rating reset occurs. The reference function remains private and is not an API for browser awards. The migration refuses unexpected drift in the original function body.

Batch 23G.3b updates the public API identifier to `solo-elo-benchmark-v2` and retires the legacy rank presentation. Deploy the matching application and database migrations together; historical v1 receipts remain valid. The rating economy is a provisional fixed-benchmark solo model, not competitive player-versus-player Elo. At 1000 the new awards are +63/-13; at 3400 they are +10/-40. Rounding eventually makes wins worth zero at very high ratings; assess that behavior and the actual player win-rate distribution in balancing tests before release.

## Verification

Use the Supabase CLI to create the migration filename, then run the installer dry run. Apply only to the local Docker database. Run the SQL fixture using the local database owner with ON_ERROR_STOP enabled. It checks the complete integer rating range, existing receipt preservation, actual server-controlled win/loss, and duplicate award prevention. It rolls back fixture data. Concurrent completion, actual historical snapshot comparison, and end-to-end API checks remain release gates. No hosted migration or deployment yet.
