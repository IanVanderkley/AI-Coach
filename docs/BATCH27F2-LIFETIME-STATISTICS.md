# Batch 27F.2 — Lifetime statistics and copy cleanup

The existing Practice account tracking migration preserves totals and fastest wins independently of retained coaching recordings. The last 100 recordings are not a cap on statistics. Complete successfully synced games count once. Games pruned before tracking activation are unrecoverable; account deletion removes owned data. Guest or unavailable lifetime lookups still show explicitly labeled recent-only data. Practice is account-recorded, not server-verified. Preserve these distinctions in the future FAQ. No database or reward changes.
