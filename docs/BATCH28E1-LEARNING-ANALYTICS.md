# Batch 28E.1 — Saved-review learning analytics

Pure adapter around the existing `summarizeLearning` and `SavedReview` contract. No production caller changes, database migrations, network calls, replay grade changes or extra replay work. Callers must use the existing account-scoped report fetch. Practice is player-recorded evidence; Ranked recordings have a separate provenance boundary. Only saved current-version reports for matching mode and difficulty are comparable. Ranked is currently Intermediate only.

- Select distinct newest saved reviews within the existing 10/25/50/100 windows. Exclude invalid analytic counters and dates, old versions, out-of-cohort rows and conflicting copies of the same game. Equivalent copies count once. Conflict count represents games; other exclusions count rows or distinct games as named.
- Decision accuracy = supported / (supported + verified mistakes). Uncertain actions are excluded. Evidence coverage = assessed / observed post-opening actions. Both retain numerator and denominator; zero denominator returns null. Coverage is solver assessment coverage, not player skill or flag correctness.
- Average board cleared uses the existing per-game rounded progress values. Mistake prevalence describes the share of selected saved games with a recorded mistake, not a technique-specific failure rate. Repeated mistakes within one game alone are not recurring across games.
- Existing rounded summary metrics and trend field remain unchanged for valid data; trend interpretation and minimum assessed-sample thresholds are a later stage. The new adapter is not used by the UI yet.
- Counter consistency is not recording verification or authorization. Do not pass arbitrary client-submitted reviews or mix accounts. Existing stored reports lack full action-specific denominators and exact deduction opportunities. Do not derive flag/chord/subset mastery percentages from top-five report moments. Additional verified evidence is needed in 28E.2.

Verification: `node --test tests/batch28e-learning-analytics.test.mjs`, `npm test`, `npx tsc --noEmit`. No deployment.
