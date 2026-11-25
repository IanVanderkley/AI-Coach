# Batch 22F — Practice layout

Practice stays immediately playable: revealing the first cell starts the existing game. Native radio difficulty cards use the existing saved difficulty and independent recovery slots. The status and metric cards reflect current Practice state, elapsed active time, placed flags and the existing mines-minus-flags counter. Reveal/Flag are a segmented control; Pause/Resume and New Game remain separate actions and use the existing handlers and recovery confirmation.

Expert uses a full-width game area; the board scrolls horizontally inside its own container at narrow widths, keeping 32px minimum cells. The pause mask remains outside the scrolling area and the grid is hidden while paused. The same board input, timing, recovery, completion, repository, XP and coaching behavior remains in place. No database migrations or dependency changes.

Manual validation: select each difficulty; check dimensions and saved selection; reveal/flag/chord with mouse and keyboard; pause/resume and background a tab; verify scroll and pause mask on a phone-width Expert board; cancel and confirm restart; reload a saved match; finish a game and confirm its history, coaching report and XP receipt. Check Ranked remains unchanged. Run `npm run format`, `npm run check && npm test && git diff --check` before committing.
