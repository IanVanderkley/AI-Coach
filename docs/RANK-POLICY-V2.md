# Batch 23 — Competitive rank policy (candidate v2)

Approved design direction: Copper, Bronze, Silver, Gold, Platinum, Emerald, Diamond, Omniscient. Copper through Emerald have V–I divisions, Diamond III–I, and Omniscient has no division. Each numbered division spans 100 rating points. Copper is reddish; Omniscient is sakura pink. The textured mine is centered in every emblem; the numeral is centered in the mine except at Omniscient. Complexity increases with rank.

## Candidate rating economy

- Starting rating for new profiles: 1600 (Gold V); floor: 100; ceiling: 10000.
- Rank entry ratings: 100, 600, 1100, 1600, 2100, 2600, 3100, 3400.
- Fixed reference rating: 1700; curve spread: 1900; K-factor: 45.
- Expected score E = 1 / (1 + 10^((1700 - rating) / 1900)).
- Victory: round(90 × (1 - E)); defeat: -round(45 × E).
- Clamp the resulting rating to the floor/ceiling and record the actual delta.
- At 1600: +48 / -21; at 1000: +63 / -13; at 3400: +10 / -40.
- The theoretical unrounded equilibrium for win rate p is 1700 + 1900 × log10(2p / (1 - p)). This targets Gold for assumed 35–40% win rates. It is not a measured distribution; verify real player data and board solvability before tuning.

## Rollout constraints

This first patch adds a pure reference implementation and tests. Existing live rating calculations, API, database, and UI remain unchanged. The server remains authoritative. Do not use this module to submit or award rating in the browser. The current system uses only verified Intermediate Ranked results; it is a fixed-benchmark solo rating, not head-to-head Elo.

Next: review the existing SQL award function and propose a versioned forward-only migration. Preserve historical receipts and account ratings unless a separate migration policy is explicitly approved. Retain match idempotency, per-account locking, verification, permissions and rating bounds. Test SQL parity, historical data, concurrent completion and duplicate outcomes locally before any hosted migration. Then integrate the rank display and eight individual emblem assets with dynamic Roman numerals. Do not release untested changes before the trade show.
