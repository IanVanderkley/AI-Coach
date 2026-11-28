# Batch 28E.5a — Learning dashboard

Integrate validated saved-review analytics, historical comparison and deterministic recommendations in the existing PersonalizedCoaching component. Keep existing account-scoped fetch, mode/difficulty/window filters, saved-review links, section preferences and quick drill. This stage does not fetch raw games or run replays or external AI. It does not change authentication, API routes, persistence or competitive results.

- Evidence coverage is assessed / observed post-opening actions; accuracy is supported / assessed. Missing rates are not zero.
- Display mean board clearance and games with verified mistakes; compare equal historical periods using the stricter 28E.3 thresholds (five assessed games and 20 assessed actions per period). Show rolling five-game lines and an accessible exact table; leave null points absent. Trends are observations of saved reports, not mastery or statistical significance.
- Use 28E.4 focus, exact replay references and practice objectives. General quick drills are not individualized diagnoses when no focus exists.
- Individual skill evidence is intentionally unavailable: the supplied SavedReview contract has no skill evidence. 28E.5b needs the current saved-report endpoint and storage schema before changing that contract. Existing reports remain eligible for overall analytics.
- Manual acceptance: sign in, save some reviews, return to history, change mode/difficulty/window, verify accuracy and coverage, expand trends and compare table values, test recommended lesson/replay and drill, check no-data behavior, narrow viewport and keyboard, sign out. Never treat unavailable data as poor performance. Full repository tests and typecheck required.

### Compatibility follow-up

The existing accuracy meter retains its original binding and null guard. The dashboard view model supplies the precise validated accuracy instead of the legacy rounded value; no missing value is converted to zero. Existing regression tests remain unchanged.

The visible accuracy-change hint explicitly distinguishes fewer than ten comparable reviews from additional trend-engine requirements. At ten reviews or more, the engine remains authoritative for the message and the accuracy change.
