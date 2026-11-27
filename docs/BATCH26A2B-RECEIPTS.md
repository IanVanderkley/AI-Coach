# Batch 26A.2b.1 — Version-aware receipt compatibility

The owner-scoped receipt API already uses `parseRankedMatchRating`. This patch extends its parser to accept ordinary policy-v4 receipts only if the versioned reference calculation agrees exactly. It preserves v1–v3 bounds and validation. V4 supports signed PostgreSQL integer ratings and gains up to 160; the formatting helper accepts these larger values only when explicitly passed version 4. Positive Elo for losses is intentionally rejected until final-guess verification is implemented.

This is a compatibility step, not activation. Do not activate v4 settlement until the lobby, standings, result rank model and emblems, rating guide and write guard are ready. Existing award functions, schema, player balances and live behavior are unchanged. Run full tests and typecheck. The next step will coordinate the database switch and app readers together; no historical receipt rewriting.
