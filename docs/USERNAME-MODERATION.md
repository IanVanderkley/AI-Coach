# Batch 22D — Username moderation

Follow-up to username changes. No dependency changes. ASCII username format remains 3–20 letters, digits or underscores. English-language denylist checks strong terms as substrings and short, ambiguous terms as complete components, with normalization for uppercase, underscores, common digit substitutions and repeated letters. Numbers alone are not prohibited by moderation (the existing length requirement still applies). This is a baseline, not comprehensive hate-speech detection: false positives and novel bypasses are possible. Review and extend the lists together; parity tests detect list drift.

The signup form and Account settings display a clear content error; the owner-authenticated preferences API rejects blocked names before writing. A private database trigger rejects unacceptable canonical profile inserts and updates (including trusted API writes). If an external signup client bypasses the form, its raw Auth metadata may still contain offensive text, but the confirmed account receives a clean, unique alias instead; that metadata is never the canonical profile name. The migration replaces existing blocked profile names with neutral aliases, resets the cooldown only for those profiles, and preserves account IDs, rating, XP, match records and anonymity. It does not modify the existing username migration or Auth metadata. Old sessions should reload after deployment.

## Install locally

From AI-Coach root on the current username feature branch:

```
npx supabase migration new username_moderation
node ./ai-coach-batch22d-moderation/apply-username-moderation.mjs --dry-run
node ./ai-coach-batch22d-moderation/apply-username-moderation.mjs --apply
```

Move the extracted package outside the repo before formatting. Run npm run format, npm run check, npm test and git diff --check. Apply locally with npx supabase migration up --local; run tests/sql/username-moderation.sql, tests/sql/username-changes.sql and tests/sql/ranked-move-revisions.sql via local psql. Test registration, an offensive rename, a clean rename, cooldown and anonymity. Remote release remains pending local validation; apply username changes and moderation together in the planned release window, then verify the hosted app.
