# Batch 26A.1 — Rating policy reference and boundary tests

Candidate only. No production award, UI, database, existing receipts or version headers are changed. Version 3 remains active. The new module is isolated until SQL parity and coordinated rollout are verified.

## Rules

- New-account target: 1500 (Gold V). Preserve existing Elo balances and historical receipts.
- Copper V includes negative Elo through 99; Copper IV starts at 100. Bronze V starts at 500, Silver V 1000, Gold V 1500, Platinum V 2000, Emerald V 2500, Diamond III 3000, Omniscient 3300. Every numbered division promotes at its next 100-point boundary.
- Copper V progress is clamped to zero for negative Elo; promotion distance includes the debt. Keep existing 10000 ceiling and use the signed PostgreSQL integer minimum only as an implementation safety bound, not a gameplay floor.
- Candidate win/loss schedule: Copper +160/-10; Bronze +140/-10; Silver +120/-10; Gold +110/-12; Platinum +100/-15; Emerald +85/-18; Diamond +70/-22; Omniscient +50/-25. Nominal reward is based on pre-match rating. Ordinary wins can skip divisions; never discard overflow.
- First crossing loss from above a division floor stops at the floor. A loss starting exactly at the floor demotes, including a newly promoted player landing exactly at the threshold. A win that moves above a floor makes crossing-loss protection available again. No separate token or cooldown. Copper V has no protection; Omniscient protects its 3300 boundary. A protected loss may be less than 10 (the requested minimum applies to nominal ordinary losses). A loss that naturally lands exactly on a floor is not marked protected.
- Existing ratings are not re-based; rank labels may change when new thresholds activate. Final-guess compensation and XP are deliberately not implemented here. Positive defeat awards require a later independently verified server-only proof and receipt contract.

## Next integration gates

1. Inspect and migrate existing rating/event constraints, receipt parsers, public standings, lobby and historical views; retain policy versions 1–3. Verify new SQL function against this reference, including signed ratings, floors, duplicate/concurrent settlements, and new-account defaults.
2. Update the application/database compatibility guard for version 4; do not disable it to bypass mismatch. Coordinate local release maintenance and hosted rollout, with backwards-compatible readers or maintenance as appropriate. Existing active matches need a defined settlement policy before activating the new economy.
3. Simulate tier transitions and distribution, not only fixed-tier break-even. Monitor per-tier win rates before finalizing the provisional reward schedule. No production rollout until reviewed.
4. Batch 26B: final forced 50/50 proof; 26C: XP economy; 26D: Ranked history grades; 26E: release checks.

## Test

`node --experimental-strip-types --test tests/batch26-rank-policy-v4.test.mjs`

Then run `npm test` and `npm run typecheck` in the real repository. The isolated suite does not verify the database, API, browser, or full project.
