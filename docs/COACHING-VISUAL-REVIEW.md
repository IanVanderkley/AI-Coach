# Batch 13 — Visual-first Coaching (staging-only)

Baseline: master at `4affb7b7b65abedd1614e667b5282c56f2348384`.
This patch is a reviewable UI and personalization change. It does not change the
underlying deduction algorithm, database schema, Ranked gameplay, API permissions,
provider/model allowlist, or billing controls.

## What changes

- Latest available Practice recording opens automatically. Exact review handoffs and
  history selections remain supported. Legacy samples are still explicitly experimental.
- A full-width replay workspace comes first. Scrub the timeline, step forward or back,
  jump to the first/last move, play/pause manually, zoom, compare before and after, or
  toggle deductions. The default view is before the action. After boards show no proof
  overlays. No move is executed or changed by the replay.
- Solid outlines identify the selected cell; ✓ and ! identify provably safe and mined
  cells. A dashed outline marks an actionable proven-safe alternative only for an
  unnecessary guess. Uncertain is not automatically bad. Existing logical decisions,
  recorded outcomes and evidence remain unchanged.
- The report leads with one lesson. Saved coaching tone, explanation detail, experience,
  goals and competitiveness shape local presentation and prioritization. Goal matching
  reorders only existing verified moments, with mistakes first. Free-text custom goals
  are displayed as personal context only, not treated as game facts or executable
  instructions. Detailed evidence is still available in every mode. No longitudinal
  profile or invented skill grade is claimed.
- Review buttons jump back to the appropriate move. Optional AI focus and follow-up
  tools are collapsed. The AI focus button is available only when the existing API
  reports a configured enabled provider. The existing protected server endpoint remains
  the authority for authentication, quotas and accepted focus IDs.

## Verification

Run the installer dry-run and apply from a clean dedicated branch, then format and run
`npm run check`, `npm test`, and `git diff --check`. New tests cover preference influence,
proof-based recommendations, corrupt checkpoints/outcomes, and genuine Beginner 9x9/10,
Intermediate 16x16/40 and Expert 16x30/99 board shapes. The new cross-difficulty fixtures
are deterministic recorded losses; existing replay tests cover wins and other actions.
The tests are not a substitute for browser or two-account E2E checks.

Browser acceptance:

1. Open Coaching with no history; play a game; open the report from the result dialog.
2. Open Coaching normally with a saved game; confirm the latest game opens. Review a
   different retained game from Profile; confirm the exact selected recording opens.
3. Complete a win and a loss for each Practice difficulty. Verify the report matches the
   actual actions and board outcome; check a known mistake, a good move and uncertainty.
4. Scrub, step, play/pause, change view, zoom, and toggle deductions. Confirm no proof
   is displayed on the after board. Check the highlighted recommended cell against
   the visible-board evidence. Confirm a focus button selects the correct replay move.
5. Change style (direct/encouraging), detail (brief/detailed), experience and goals in
   Settings, then return to Coaching. Confirm the saved settings alter presentation
   without changing evidence/counts; no supported finding should disappear.
6. Verify signed-out use, signed-in use, missing/corrupt recordings, narrow phone widths,
   Expert scrolling, keyboard navigation, and reduced motion. Confirm no autoplay.
7. With paid AI disabled, ensure the optional AI button cannot send a paid request and
   local coaching remains available. Run the existing provider/quota tests.

## External provider evaluation — do not enable in this patch

The current provider-policy module explicitly supports OpenAI `gpt-4o-mini`, Anthropic
`claude-haiku-4-5`, and Gemini `gemini-2.5-flash`. These are the repository's approved
model identifiers, not claims about the vendors' current availability or prices.
The verified endpoint accepts only a grounded focus ID; the provider receives verified
finding summaries rather than the hidden mine layout. Existing guards require sign-in,
quota reservation and allowlisted model selection. Rule fallback is available.

Recommendation for the final demonstration: keep deterministic coaching as the primary
experience. Evaluate one approved provider in a separate protected staging trial only
if the team needs AI prioritization for the rubric. Compare accuracy of focus selection,
latency, invalid-response fallback and actual per-request cost on the same fixed games.
Verify current availability and official pricing, configure a hard project spending
limit, confirm distributed request limits, and rerun authenticated isolation and quota
tests. Use server-only credentials. Do not enable paid AI or publish to production
without a separate decision. No real provider request is made by this patch.
