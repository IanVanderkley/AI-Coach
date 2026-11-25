# Ranked combined move endpoint

Reveal, flag and chord authenticate the player using the existing authentication path and call the service-role-only `execute_ranked_move` RPC. Admission and the revision-checked move run in one database request. The server chooses first versus subsequent reveal using locked database state; the old optional browser hint is accepted for compatibility but is not used. Existing start/read rate limits are unchanged. The SQL migration must be applied before deploying these routes. Old routes remain compatible with the additive migration.

Admission is outside the move exception subtransaction; rejected moves still consume quota. A missing RPC or unexpected result returns 503; no fallback or automatic replay occurs. The client retains its existing recovery path. HTTP 429 includes Retry-After, conflicts and rejected moves return 409, and responses are non-cacheable. Authentication mode is unchanged. The successful response is the original move result, not the private envelope.

Validate using the local combined move SQL probe, existing move revision and rate-limit probes, full automated tests, and signed-in browser smoke tests. Re-measure hosted latency using the same browser and action mix. This change does not queue player inputs or switch authentication modes.
