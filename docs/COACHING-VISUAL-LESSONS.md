# Visual coaching lessons

The selected-game area is now a compact summary with no nested metric tiles. The replay starts in Compare mode by default. Players can choose Before, After or Compare in Settings; this preference is browser-local. A manual change applies to the current review.

The traced visible-board solver records the exact unresolved groups, confirmed mines and safe cells used by each proof. The visual lesson crops the original before-move board to the relevant clues and groups. Shared unresolved cells are blue question marks, proven mines are orange M symbols, and proven safe cells have green check marks. Previously established deductions use dashed borders. Player flags alone do not prove mine locations. The written lesson describes the same arithmetic in plain language, followed by a reusable rule. Exact coordinates and full arithmetic remain available under expandable technical detail. No external AI request is needed for these explanations.

The opening reveal remains Move 0. Recorded IDs, game persistence, Ranked, and provider security are unchanged. No dependencies or database changes are required.

## Manual acceptance

- Open the Coaching page at desktop and narrow widths. The compact game summary must not overflow or show individual stat tiles.
- Check that Before and After appear by default. Change the default in Settings, revisit Coaching, and confirm the saved view. Change the view manually in the replay.
- Review a mistake involving overlapping clues. Confirm each cropped board matches the before-move state and that the conclusion highlights the actual additional squares. Compare the plain-language lesson with the technical details.
- Review correct flags, safe reveals and chords in all three difficulties. Confirm no hidden mine layout is used to teach the lesson.
- Confirm Brief retains expandable proof details, Standard shows the visual lesson and Detailed shows the full arithmetic.

## Recent-game-first coaching and compact feedback

Opening Coaching now lists recent Practice game metadata only. Opening a game explicitly loads its ordered moves and calculates the report in the browser; direct Review links from Play and Profile are still explicit review requests. No paid provider is called automatically. Signed-in players can select their latest 100 saved recordings and guests their tab-local recordings. The account adapter requests only the selected game's moves in pages, checking completeness and order. The score appears in the history tile after the game is reviewed, and lasts for the current page visit. Unopened games deliberately do not display an invented or precomputed grade.

The compact post-game feedback card above the replay uses a new, transparent learning score: 60% board completion and 40% proven decision quality after the opening reveal. Uncertain decisions do not count toward decision quality; when there is no provable post-opening decision, there is no grade. Grades use the previous S/A/B/C/D thresholds, but this is a different formula from the older experimental report. Scores are not Ranked ratings, and no score is written to the database. A key move action jumps to the exact replay. The original experimental report is still available on demand, separate from the new score.

Check that opening Coaching without query parameters does not select a game or analyze a recording; selecting a game shows the compact grade and visual lessons; switching games resets the replay and preserves already generated grades for the visit. Test a direct Play/Profile review link, a guest, a signed-in player, an empty history and a recording with more than 500 moves. Check no paid AI requests occur until an explicit optional request.
