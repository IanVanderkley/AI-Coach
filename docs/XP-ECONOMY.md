# Account XP economy

The level threshold stays at 1,000 XP. Newly completed verified Intermediate Ranked matches pay 210 XP for a win or 17 XP for a loss. Historical 125/10 XP receipts and saved balances remain unchanged. Only the existing verified Ranked triggers award Ranked XP; Elo is untouched. Beginner and Expert Ranked remain unavailable.

Account-recorded Practice wins/losses pay Beginner 25/5, Intermediate 50/10, Expert 75/15. A first complete recording with canonical dimensions, a reveal and recorded checkpoints qualifies; losses also need at least 15 recorded seconds and three distinct reveal/chord positions. Practice is client-recorded, so these checks are not proof of legitimate gameplay. The server awards at most 300 Practice XP per account per UTC day (no partial awards). No automatic backfill of already tracked games. Eligible unsynced recordings can earn when first synced. Existing guest-only recordings are not account XP until synced. A receipt survives recording deletion and the existing private dedup ledger prevents duplicate credit. Account deletion cascades. Practice cannot affect Elo.

## Deployment order

1. Test the new migration and UI locally, including both SQL scripts and the full app tests.
2. Deploy the compatible application code first (it understands both old and new Ranked rewards and tolerates the missing Practice receipt table). Verify the new staging build is live before applying the remote migration. Do not switch back to the old strict receipt parser after enabling the new economy.
3. Run `npx supabase db push --remote --dry-run`; verify only the new XP migration is pending for AI-Coach-Staging. Apply `npx supabase db push --remote` only after the live app is compatible.
4. Test a new Practice win/loss and a Ranked result on the live site, verify saved receipts and the navbar level ring. Existing XP remains intact. Do not run rollback-only tests against hosted data.

If the new UI must be rolled back after the migration, use a version which understands the old and new Ranked receipts. Do not delete ledger rows or reset balances to undo a reward.
