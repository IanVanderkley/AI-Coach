# Batch 27H.2a — Responsive comparison boards

Beginner and Intermediate compare side by side whenever the replay pane is at least 800 CSS pixels wide. Wider boards (including Expert) always stack. Smaller replay panes stack every difficulty. The board cells scale to the scroll region's width, stay square, and retain existing deduction marks and keyboard/text access. A 14px minimum preserves a horizontal scrolling fallback for exceptionally narrow viewports, especially Expert on mobile. No artificial vertical scroll limit. Single-board views remain full width. The print comparison stacks as well.

Score and assessment disclosures move to docs/FAQ-COACHING-CONTENT.md for publication in 27I; score disclosure is hidden from Settings while saved preference schema stays compatible. No changes to game logic, grades, database or paid AI.

Local QA: compare Beginner, Intermediate and Expert recordings on desktop and narrow browser widths; inspect full board, row/column labels, deduction highlights, first and final moves, single board view, text alternative and playback. Confirm score and assessment disclosures are absent and the score setting no longer appears.
