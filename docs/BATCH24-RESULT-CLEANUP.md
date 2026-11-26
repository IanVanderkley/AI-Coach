# Batch 24 — Ranked result cleanup

- Match XP, saved account XP, and Elo receipts already load automatically when the result opens. Keep their existing verified read paths and per-match keys.
- Remove manual refresh controls from successful results. Preserve retry for missing/unavailable match and rating receipts, and unavailable account XP.
- Only display the saved account balance badge when the balance was successfully retrieved.
- Remove duplicated account XP disclaimer from its card; the result dialog retains the explanation of match XP, lifetime XP, and Elo.
- No database, authentication, reward calculation, API, or gameplay changes. No polling or additional requests on successful loads.

## Local verification

Finish a Ranked match and confirm the saved receipt, lifetime XP, level progress, Elo, and navbar level all appear automatically. Close and reopen the result. Confirm neither success card displays a refresh button. Under a controlled local network failure, confirm an unavailable panel offers Retry and returns to the normal view after a successful retry. A missing historical receipt must not be fabricated.
