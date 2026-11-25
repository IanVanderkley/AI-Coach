# Ranked API admission control

The authenticated Ranked handlers reserve a request in PostgreSQL after existing request validation and authentication, but before match RPCs or history queries. The admission guard is enabled by default in this code; no additional environment variable is needed. Deploy the migration before the updated routes.

| Scope                                        | Requests per UTC minute per account |
| -------------------------------------------- | ----------------------------------: |
| Start or resume via POST /api/ranked/matches |                                  30 |
| Reveal, flag and chord (shared)              |                                 600 |
| Current match and history (shared)           |                                 120 |

These are initial fixed-window limits, not benchmarked throughput targets. A burst across a minute boundary can use two windows. One row per account and scope is updated atomically; counters are removed with the auth account. Database grants and RLS deny browser roles, and the RPC is service-role-only. Identity comes from the existing verified authentication, not the request body. A rejected reservation returns 429 with Retry-After: 60; an unavailable or malformed reservation returns 503 with Retry-After: 5. Both fail closed before game operations. Existing game ownership, validation and result checks remain unchanged.

This is not global, IP-based or pre-authentication abuse protection. The additional database round trip may affect move latency. Benchmark on the local stack and an isolated preview before merging into the public staging branch. Do not enable production claims mode as part of this patch. Existing frontend handling of 429/503 should be tested for recovery; no automatic mutation retries are introduced.

Local test (from Git Bash, with the AI-Coach local stack running):

```bash
npx supabase migration up --local
docker exec -i supabase_db_Ai-Coach psql -U postgres -d postgres -v ON_ERROR_STOP=1 < tests/sql/ranked-api-rate-limits.sql
```

The SQL integration test uses disposable accounts in a rollback transaction. Re-run if it crosses a minute boundary. Never run it on a remote database. The test does not simulate concurrent HTTP requests; concurrency and latency checks remain release gates.
