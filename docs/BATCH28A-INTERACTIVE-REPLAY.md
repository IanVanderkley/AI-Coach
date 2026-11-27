# Batch 28A — Interactive replay boards

Inspection is local UI state, separate from the recorded action and assessment. Both snapshots share an inspected index. Explicit selection persists across move and view changes; reset follows the recorded move. Changing game resets inspection. Clicking or tapping, or navigating using arrow keys (Home/End for row boundaries), pauses playback. Each board has one tab stop for its square buttons; Enter/Space selects via native button behavior. Existing text alternatives remain available. Nearby positive revealed clues come from each displayed snapshot and are context only, never proof. Deduction toggle hides nearby context and existing proof overlays, not inspection. No changes to solver, APIs, data, paid AI, or grading.

## Manual verification (pending)

- Practice and Ranked: Beginner, Intermediate, Expert; opening, intermediate and final moves.
- Compare: click either board, check both selections and independent recorded-move markers. Switch modes and moves, reset, change games, inspect during playback.
- Keyboard: tab into each board, arrows, Home/End, Enter/Space; verify focus scrolls into view, no row wrap and no interference with timeline keys. Check screen reader labels.
- Narrow mobile: tap cells, scroll Expert, verify existing geometry, tooltips and proof overlays. Confirm no gameplay action is triggered.
- Toggle deductions off/on and verify no nearby clue is claimed as proof. Run full test, typecheck, lint and build before staging.
