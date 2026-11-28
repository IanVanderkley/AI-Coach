# Batch 28H — Integration and release-readiness audit

Baseline: `a95e27e63833b4ff709fb88302f839a2b2a1bbcd` on `feature/batch-28f-training-exercises`.

## Findings and fixes

- Review owner changes invalidate pending review/sample requests, practice history and grades, ranked grades, coaching preferences and the selected completed game. Repeated sign-ins/token refreshes for the same owner do not interrupt the review. Refresh history for the new session without reopening an old deep link. Late history, preference and grade responses are discarded via a synchronous epoch guard. Remount ranked history at the account boundary.
- Probability/counterfactual wording is rejected consistently by the deterministic move-question classifier. The conversation now directs users to the separate replay probability inspector instead of implying the replay has no probability feature.
- Retain the existing local-only training and conversation boundaries. General exercise progress is intentionally browser-shared, not account-synchronized or a competitive rating. Personalized training is transient; ranked conversation threads are memory-only. Practice conversation references are tab-local. No change to gameplay, XP, Elo, provider billing or database schema.
- Reviewed saved-report GET/POST/DELETE ownership, verified claims/session checks, bounded history reads and quotas; reviewed completed ranked recording ownership/terminal checks. This is a targeted source audit, not a whole-application penetration test.
- Read-only staging inspection: `coaching_reviews` has RLS enabled; `anon` and `authenticated` lack SELECT/INSERT/UPDATE/DELETE/TRUNCATE; `service_role` has SELECT and lacks TRUNCATE. `ranked_session_is_active` and `reserve_coaching_review_save` are security-invoker and executable by service_role but not anon/authenticated. The staging review table contained zero rows at inspection, so representative saved-review payload and latency remain unmeasured. No remote mutation or deployment.

## Verification

- 11 new audit tests: owner transitions, stale-response guard wiring, unsupported questions, independent exhaustive layout counts for all nine starter/adaptive exercises (44 covered squares, 18 compatible layouts summed across exercises), flag independence, solver caps, local storage boundaries and report authorization wiring.
- Isolated regression run: 325 passed, including prior exhaustive small-board solver tests. One legacy shared-practice-analysis file was excluded because its dependencies are absent in the fixture. Full React/Next app dependencies and browser are not present in this fixture; pure TypeScript and TSX syntax checks passed. These results do not establish deployed end-to-end security or browser behavior.

## Release gate (run on full repository)

1. `npm test` (expected 1,269 passing), `npx tsc --noEmit`, `npm run build`, `git diff --check`.
2. Open a completed Practice review, inspect a square, and use training and a whole-game question. Verify replay navigation and coordinate labels.
3. Using two authorized staging test accounts, change/sign out while a review or history request is active. Confirm old game, grade, preferences and review details are absent, and the new owner's history reloads. Confirm unauthenticated/foreign completed recording access is rejected and own completed recording is available. Do not use active ranked matches for coaching.
4. Check saved report save/reload/remove with test records and verify owner isolation. Check representative history payload and latency if data is available.
5. Check keyboard/touch layouts and narrow screens. No need to repeat every previously verified interaction unless a regression appears.
6. Commit intended files only. Review aggregate PR against master. Deploy to staging only after release approval and the local gate passes; production deployment requires explicit approval.
