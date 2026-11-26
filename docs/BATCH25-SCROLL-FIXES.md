# Batch 25B.6 — Board and coaching conversation scrolling

Practice Intermediate and Expert position the controls and board on initial entry, new game, difficulty change and saved-game resume. Ranked positions its active board after entering a match. A fully visible board does not move; if space is limited, the board is prioritized without reducing cell sizes. The positioning is immediate, respects reduced motion, and is not repeated on gameplay actions or timer updates.

The follow-up pane reveals the newest accepted answer within its own scroll container, including after reopening a saved conversation. A long answer starts at its beginning. Recomputed evidence revalidates the current in-memory thread instead of replacing it from storage. No new network requests, quotas, database migrations or changes to gameplay authority.

## Manual acceptance

- Practice: Beginner does not auto-scroll. Intermediate and Expert scroll only when needed on entry, New Game, difficulty change and saved-game resume. Verify controls and board at normal and short desktop heights and phone widths. Scroll manually and reveal, flag, chord and wait for the timer; no automatic repositioning occurs.
- Ranked: start and resume a match, confirm the visible board is positioned, then reveal, flag and chord without viewport jumps. Test returning to the lobby and entering another match.
- Coaching: submit three supported questions consecutively, then continue to 12 and a 13th. The newest answer should be visible immediately; older retained entries remain scrollable. Test a long answer, unsupported questions, preference changes, reopening a report, clearing and asking again, and a different game. Verify replay links still work and the page does not jump to the replay.
- Test with reduced motion, keyboard navigation and blocked session storage where practical. Run the full checks before committing. Browser acceptance remains required; helper/source tests alone do not prove actual browser layout.
