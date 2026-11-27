# Batch 26A.2b.2 — Version-aware rank presentation

V3 stays the default for API projections and the privileged write guard. The new models accept an explicit v4 response/receipt, preserving the historical v3 scale for earlier receipts. The lobby and profile select the same scale as their server response; public standings use a separate v4 rating-system identifier. V4 supports negative ratings, zero progress at negative Elo, real debt, 100-Elo promotion boundaries and verified demotion protection messaging. The public API still projects only public fields. No new database functions, permissions, writes, migration, or production change.

Next: activate v4 in the local award function and server policy header, coordinate the version guard, update API projection defaults and the rating guide, and test actual settlement. Do not deploy until the whole release is verified. Existing receipts/balances stay untouched. Final guess compensation remains out of scope for this step.
