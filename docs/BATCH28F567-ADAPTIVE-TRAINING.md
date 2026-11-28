# Batch 28F.5–7 — Adaptive training, browser progress and polish

## Scope

- Keep all six existing starter exercises and add three 4×4 advanced classification exercises, with safe, mine and uncertain solutions independently validated using the existing full-board exact enumeration and rule-proof checks. The advanced safe and mine examples require linked deductions.
- Offer a recommended exercise based on the latest answer for each distinct puzzle in the retained history. Recommend revisiting missed exercises; advance after two different correct answers without hints displayed during their visits or completing that level. Recommendations are optional: all difficulty levels remain available. Repeated boards are not a mastery assessment.
- Store at most the latest 60 valid general exercise answers in versioned browser storage: known catalog ID, correctness and number of progressive hints shown before submission (0–3). Retrying after a correct answer counts the already-displayed full explanation as level 3. Hint counts refer to the current visit, not knowledge gained on earlier visits. Recent attempts include retries; distinct solved counts deduplicate IDs. Show the ten latest entries and a confirmed reset action.
- This release deliberately uses browser-local progress, not account synchronization. It is shared by users of the same browser profile and is labeled accordingly. No account IDs, personalized replay identifiers, board states, answers, credentials, game records or competitive data are stored. Personalized review exercises retain their temporary state and do not write training history. Browser storage may be cleared or disabled; simultaneous tabs are not a transactional datastore.
- No server requests, migrations, AI provider usage, XP, Elo, leaderboard or gameplay mutations. Only valid answers advance the training history; navigation, invalid input and repeated clicks on an already submitted answer do not create entries.

## Verification

The new tests cover the exact advanced classifications, linked deductions, distinct-puzzle recommendations, progression and missed-puzzle review, navigation bounds, versioned persistence, invalid/private IDs and fields, bounded history, storage failure, explicit reset, and isolation of personalized review training. Core TypeScript validation uses the repository's ES2017 target. Full local application tests, TypeScript/build validation and a short browser acceptance check remain required before commit. Account-synced history is not implemented by this patch.
