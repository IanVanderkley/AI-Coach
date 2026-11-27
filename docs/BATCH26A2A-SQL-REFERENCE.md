# Batch 26A.2a — Private SQL reference

The migration introduces only `ranked_internal.calculate_rating_v4(integer,text)` (immutable, SECURITY INVOKER, no public/browser/service EXECUTE). It returns the actual rating, actual delta, nominal delta and demotion protection indicator. Existing v3 award triggers, profile defaults, constraints, receipt parsers and version guard are unchanged. Do not apply remotely yet.

Run the local migration and the rollback-only parity generator. The generator tests 24,008 inputs (all integers from -2000 to 10000, plus three additional negative values, for both outcomes). It checks exactly one row per input, expected deltas and protection, error handling, function grants and active v3 award function. It writes only a temporary fixture table in a transaction; it does not insert matches or change player data.

The function does not accept a final-guess outcome, pending separate server-side verification. This is an inactive foundation, not a complete economy rollout. Next steps: version-aware receipts and UI, new profile bounds/defaults, guarded switch of award function and compatibility header. Keep historical v1–v3 calculation and receipts intact.
