# Local API security and development

Batch 21.3B shares the existing streaming JSON boundary between Ranked, Coaching and leaderboard preferences. It rejects malformed origin headers and cross-origin Fetch Metadata (including sibling subdomains); browser leaderboard writes require an exact Origin. Ranked and Coaching preserve compatibility with clients that omit Origin and Fetch Metadata. These are browser-request protections, not authentication or rate limits. Existing authentication, RLS, feature flags, and quotas remain in force. The leaderboard preferences route still accepts only username and anonymity fields. Raw errors from selected Ranked route logs are replaced with fixed messages; do not log tokens, request bodies or provider errors.

## Local launcher

Start Docker Desktop and the existing local Supabase stack. Stop any running Next.js instance before building. From the repository root:

```bash
node scripts/run-local.mjs
```

The launcher reads local CLI status without printing credentials, checks that the API URL is exactly `http://127.0.0.1:54321`, checks the roles encoded in the locally issued legacy keys, and performs a read-only privileged API check. It launches an optimized local build on loopback port 3000, using only local credentials, with paid AI and account deletion disabled. It does not edit `.env.local`, link projects, push migrations, or deploy. Its build replaces the local `.next` output; rebuild with the intended environment for other uses. The JWT role check is a sanity check, not cryptographic verification; the actual API check confirms access. `--dev` is optional; use production mode if the development WebSocket issue returns.

Local Studio and Mailpit remain separate. Do not expose Docker ports or local default credentials publicly. Do not use real passwords or personal email addresses for local test accounts.

## Validation

Run the complete build and tests, then start the local launcher. Sign in with the local test account, save leaderboard settings, verify the persisted privacy toggle, play Ranked and recover a match, and request deterministic coaching. Inspect failed HTTP responses. No new database migration is included. Hosted smoke testing, abuse prevention and concurrency testing remain separate tasks.
