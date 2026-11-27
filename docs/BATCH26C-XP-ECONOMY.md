# Batch 26C — XP economy v2

New verified Ranked wins: 350 XP. Verified losses: 50 XP when server duration is at least 15 seconds and there are at least three distinct recorded reveal/chord positions including the losing action. Flags do not count. A verified but ineligible loss receives a durable zero-XP receipt; Elo, win/loss stats and final-guess compensation are independent. This is a participation gate, not proof of human play.

New Practice awards: Beginner 50/10, Intermediate 100/20, Expert 150/30. UTC day cap 500, no partial awards. Existing eligibility rules, deduplication and privacy remain intact. Historical receipts keep exact original amounts; no backfill, no reset, no level threshold change. Old tests/sql/xp-economy.sql describes the earlier economy; run the two new v2 fixtures instead after this migration.

Local only until compatible app release. Old clients reject new reward amounts; do not roll back to them after activation. The existing Ranked write contract remains 5.
