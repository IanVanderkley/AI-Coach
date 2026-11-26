# Batch 25A.1 — Shared recording integrity boundary

## Scope

- Both verified coaching endpoints share `prepareVerifiedAnalysis`: strict shape checks followed by deterministic replay and evidence generation.
- The legacy HTTP handler checks the original body whenever any move checkpoint is supplied. A malformed or partial checkpoint cannot silently become an unstamped legacy request. Validated checkpointed sessions retain their checked moves and normalized legacy preferences; errors are returned before the paid quota reservation.
- Reject non-string action values instead of coercing them to a string.
- Keep old unstamped sample/history clients and the legacy report format compatible. Unstamped recordings are not checkpoint-verified. Client-generated checksums validate replay consistency, not authenticity or Ranked eligibility.
- Add 56 distinct known mine layouts using the existing independent reference simulator and exhaustive visible-board oracle, plus seven HTTP/boundary regressions. These check proof soundness, not completeness of deductions; no claim of unavoidable guessing is made.

## Not yet implemented

Legacy report scoring and evidence presentation still use different analysis paths. This patch validates stamped recordings before the legacy report, but does not replace legacy scoring, change the AI provider contract, modify preferences presentation, implement Ranked coaching, or persist reports. Paid AI remains disabled in the existing environment; no environment or database changes are included. The next accuracy patch will unify classification and evidence output before changing the UI.

## Verification

Run `npm run check && npm test`. Then run the local application with `npm run dev:local` and verify a completed Practice report, the existing Coaching demo and a saved-game review still load. A valid stamped recording must pass; invalid, partial or mismatching checkpoints must return HTTP 400 or 422 before any paid work. Verify both verified endpoints using the existing smoke scripts as appropriate. Keep hosted services unchanged until the full Batch 25 release has been reviewed.
