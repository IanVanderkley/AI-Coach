# Coaching — teaching and replay refinement

The Batch 14 review workspace keeps original Practice recording action IDs for server requests, checkpoints and persisted history. Move 0 represents the initial reveal, including any earlier setup flags in that snapshot. The coaching UI omits the opening and setup actions from assessment totals; subsequent display numbers start at 1. The legacy API contract remains unchanged. Follow-up labels and replay links translate between display and original numbers.

## Replay experience

- Fixed 36-pixel square cells with visible row and column numbers. Scroll large boards rather than shrinking or stretching cells.
- Fractional scrubber; the board changes at the halfway point between moves. Arrow keys and previous/next move by one action. Playback uses animation frames; play/pause and skip controls use familiar icons. Opening defaults to the board after the reveal.
- Red previous/next controls, centered grouped toolbar, delayed tooltips. Settings > Interface preferences > Replay tooltips controls hover hints for this browser. This preference is not account-synced; no database migration is needed.
- Compact game card uses a single column at narrow widths and a wider card on desktop.

## Evidence walkthrough

The deterministic deduction engine optionally records a derivation when a proof is made. Ordinary replay and provider endpoints still use the original non-tracing path. Teaching explanations recompute only from the before-board, dimensions and public mine count. Each derivation records the exact count arithmetic and dependencies on previously proven cells. The UI follows those dependencies in order, highlights supporting numbered clues in blue, and recommends a proven safe square when possible. A player's flag is not itself proof. No arbitrary LLM reasoning or hidden mines are used for a recommendation.

Rules covered: zero remaining mines; every remaining square is a mine; overlapping/subset constraints; total mine count. In overlapping groups, subtract the smaller group's mine count from the larger group's count, then apply the safe/all-mines rule to their difference. Long lists of squares are abbreviated with an explicit remaining count; the board and target coordinate identify the specific lesson. Brief detail keeps steps collapsed; standard expands the focused lesson; detailed expands all lessons. The replay shows the selected decision's proof by default. If the solver cannot prove a decision, no pattern is invented.

## Acceptance checks

Run `npm run check && npm test && git diff --check`. Then review one game on each difficulty. Confirm opening Move 0, report counts and follow-up links; scrub slowly across each midpoint; play/pause, first/last and keyboard navigation; inspect clue arithmetic, suggested square and fixed geometry in before/after/compare modes. Check Expert horizontal scrolling and narrow mobile widths. Hover over controls for at least 1.2 seconds and turn tooltips off in Settings, then reopen Coaching. Change detail preferences and verify the proof remains available. Paid AI is unchanged and remains disabled in staging. No Supabase or Vercel changes are part of this patch.
