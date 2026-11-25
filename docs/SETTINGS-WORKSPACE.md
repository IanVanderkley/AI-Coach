# Settings workspace

Settings has five categories: Coaching, Player preferences, Replay & interface, Privacy, and Account. The previous nested navigation is replaced by one category bar. Coaching is the initial category. Panels stay mounted when hidden so switching categories does not discard drafts.

## Saving and storage

- Coaching and player preferences keep their existing section and global save/reset/discard handlers. Global preference actions do not reset account, privacy or replay settings.
- Automatic history grades use the existing account preference (browser fallback for guests).
- Replay view and tooltips remain browser-local.
- Leaderboard visibility still uses the existing account endpoint and explicit save action.
- Account controls retain their existing authentication flows. The deletion flag remains server-controlled and must remain disabled pending staging verification.

## Acceptance checks

1. Open Settings. Only Coaching is visible. Change a style without saving, switch categories, then return. Verify the draft remains and Discard restores the saved choice.
2. Change coaching and player preferences, use Save all preferences, refresh, and verify both values. Verify per-section save/reset still works.
3. Test each replay control, refresh, and confirm persistence. Test signed-in automatic grade preference on a second browser.
4. Verify Privacy shows the saved public username and anonymity choice and can save changes. Check guest behavior.
5. Verify Account shows the correct email and status, and account actions expand without opening unrelated categories. Do not enable deletion for this UI patch.
6. Check a narrow viewport and keyboard navigation, including visible focus and switches.

No database migration, new dependencies or changes to auth endpoints are included. Live auth and cross-device testing from Batch 17 remain pending.
