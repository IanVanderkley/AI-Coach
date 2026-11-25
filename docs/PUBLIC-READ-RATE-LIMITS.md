# Public leaderboard resource protection

Public GET endpoints remain anonymous, read-only and uncached. The existing
privacy-filtered views and row limits remain unchanged. The server reserves an
aggregate database-backed admission slot before querying either view.

| Endpoint              | Requests per fixed minute across all app instances |
| --------------------- | -------------------------------------------------: |
| `/api/leaderboard`    |                                                300 |
| `/api/ranked-results` |                                                120 |

The two counters are independent of each other, Ranked gameplay and Coaching.
Only the server role can execute the reservation RPC or access its table. The
table has at most two rows, no IP addresses, account identifiers or history.
Exhaustion returns 429 with Retry-After; database failure returns 503. No
read is attempted on an admission failure. Fixed windows can permit bursts at
minute boundaries. The caps are initial staging values, not per-client limits.

## Limitations and rollout

One additional database RPC is required per valid GET. Measure hosted latency
before release. A malicious caller can exhaust a shared quota and still invoke
the reservation RPC; the cap limits expensive reads, not inbound traffic.
Edge/WAF rate limiting is a separate production task. Do not cache identifiable
standings across privacy changes. The existing optional Coaching limiter and
the disabled direct submission POST endpoint are deliberately unchanged.

Apply and test the migration locally before starting the updated server. Before
hosted deployment, apply the migration to the intended database and validate
both endpoints anonymously, including privacy changes. Do not deploy against a
database missing the migration; it fails closed. Never run the SQL fixture on
the hosted database. The fixture rolls back and simulates quota boundaries.
