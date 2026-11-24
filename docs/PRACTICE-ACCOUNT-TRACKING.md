# Batch 7B — Tracked Practice account statistics

## Scope and limitations

Signed-in Practice statistics now accumulate a **recorded account history** that survives the 100-record `practice_games` retention cap. This is **not** server-verified gameplay: the browser supplies the Practice board, actions, outcome, and duration. Ranked wins and losses remain separately server-verified and the XP ledger is unchanged. Guest games remain session-only until successfully imported after sign-in.

At migration time the database backfills only **complete** retained Practice recordings (header with all numbered moves). Previously trimmed games are permanently absent and **not recovered**. The dashboard calls this **tracked Practice**, not guaranteed complete historical lifetime; the combined overview similarly calls its account totals **tracked results**, not an all-time career record. Do not claim full historical Practice coverage. This migration does not retroactively replay or certify Practice recordings.

## Database design

- `practice_stats_internal.recorded_games` is a private, non-exposed dedup ledger keyed `(user_id, client_record_id)`, with no client grants. It survives deletion of stored gameplay history but cascades if the account is deleted.
- `public.practice_account_totals` exposes only `SELECT` to `authenticated`, with strict user-owner RLS. It is keyed `(user_id, difficulty)` and has no client INSERT, UPDATE, DELETE, TRUNCATE or RPC.
- An internal `SECURITY DEFINER` **trigger** (no client EXECUTE grant; fixed empty `search_path`) acts only after a Practice move INSERT or UPDATE, checks the current authenticated owner, confirms that all `move_count` unique move numbers exist from `1` through `move_count`, and atomically inserts a dedup key and updates counts/best time. Incomplete uploads don't count.
- Upserting the same game, refreshing, cloud sync retries, deleting or trimming match recordings cannot count the game twice. If a saved game changes after its first complete upload, the tracked totals retain that first captured outcome. Concurrent updates use the dedup unique key and atomic `ON CONFLICT DO UPDATE` counter increment.
- Auth account deletion cascades the ledger and totals. These are tracked records, not an anti-cheat system: creating fabricated, distinct client-recorded Practice games can still inflate statistics. NEVER mix them into verified Ranked leaderboards or XP.

## Deployment sequence

1. On `feature/ranked-result-experience-20261123`, create the migration filename using **`npx supabase migration new practice_account_tracking`** (run once).
2. Extract Batch 7B and run the guarded installer `--dry-run`, then `--apply`. It fills the newly generated empty migration with the included reviewed SQL and installs UI/test changes. **Do not run database pushes automatically.**
3. Run `npx prettier . --write`, `npm run check`, `npm test`, `git diff --check`. Confirm new tests, inspect migration diff, keep `.vscode/settings.json` unstaged.
4. Run the included **rollback-only SQL probe** against the designated **AI-Coach-Staging** project (`bzjkmiwwrpcshumamkvq`) before applying a migration permanently. Confirm no schema artifacts remain after rollback.
5. Only after the probe succeeds, apply the migration to this staging project via its vetted Supabase migration workflow. Recheck RLS, complete-upload behavior, retry idempotence, and browser dashboard. Never use MindSweeper or the other Supabase projects.

## Browser test

- Signed in: top overview switches to **TRACKED ACCOUNT RESULTS** only when both lifetime Ranked and tracked Practice totals load successfully. Practice card says **ACCOUNT-RECORDED TRACKED**, difficulty cards say **Tracked account games**. Recent history and Coaching links remain unchanged.
- Guest: recent, browser-only Practice counts; no private tracked statistics are visible.
- Missing/unapplied migration: account tracking read fails closed, while the existing recent snapshot and gameplay remain available.
- Sync a new completed Practice game with moves: tracked counters increase once; reloading should not increment again. The 100-game retention limit still applies to detailed replay only.
