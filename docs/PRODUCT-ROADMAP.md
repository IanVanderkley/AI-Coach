# AI-Coach — Product Roadmap

_Last reviewed: November 23, 2026. This document records agreed priorities; a feature is not complete until tested and merged._

## Current checkpoint — Practice results and usability

- [x] Practice Win/Loss dialog with game statistics and personal-best celebration.
- [x] Animated mine-logo loss and victory reveal; reduced-motion support.
- [x] Result sharing with copy fallback.
- [x] Analyze Game passes the completed game into Coaching, including its replay.
- [x] Centered outcome message above the board.
- [x] Remember chosen Practice difficulty when visiting another page.
- [x] Improve basic Coaching navigation and explanations.
- [ ] Verify that the regular board-header New Game button uses the red site accent. (Included in checkpoint polish patch.)
- [ ] Commit and merge the Practice results feature branch after browser verification.

## Next — Resume unfinished Practice games

**Goal:** A player can leave Play for Coaching or another page, then return to the same unfinished game, including their progress.

- [ ] Define a versioned, validated local Practice snapshot with board, mine positions, revealed cells, flags, elapsed active time, selected difficulty, mode, and recording moves/checkpoints.
- [ ] Restore snapshots after navigation and refresh without starting a second recording or changing the original mine layout.
- [ ] Persist safely after meaningful actions; pause/hide the board when appropriate; avoid an active timer running while the player is away.
- [ ] Give clear **Resume game** and **Start new game** options, including a confirmation before discarding an unfinished game.
- [ ] Clear an obsolete snapshot when the match ends or a new game is confirmed.
- [ ] Handle corrupt/outdated snapshots gracefully; never allow a Practice snapshot to count as a verified Ranked result.
- [ ] Add unit tests and browser tests (difficulty changes, refresh, leave/return, paused timer, game completion).

## After that — Profile level and XP

**Fixed progression requirement:** Exactly **1,000 XP for every level**. The XP threshold does not grow.

- Level starts at **1** with 0 total XP.
- `level = floor(totalXp / 1000) + 1`; `xpIntoLevel = totalXp % 1000`.
- Examples: 999 XP = level 1; 1,000 XP = level 2; 3,500 XP = level 4 (500/1,000 XP toward level 5).
- [ ] Decide earning rules for Beginner, Intermediate, Expert, Coaching, and Ranked; example rewards from design discussion are _proposals_, not final decisions.
- [ ] Show level, badge, current XP, and next-level progress on the signed-in profile; potentially show level beside the username.
- [ ] Add a restrained level-up animation/celebration.
- [ ] Persist account XP and create a server-controlled, idempotent reward ledger so the same game cannot pay XP twice.
- [ ] Do not treat browser-only Practice results as server-verified; decide an honest policy for Practice XP and guests before implementing rewards.
- [ ] Test concurrent rewards, duplicate submissions, signed-out behavior, and level thresholds.

## Following feature — Visual-first Coaching redesign

- [ ] Put a visual game summary, interactive replay board, and highlighted decisions near the top.
- [ ] Use approachable colored diagrams for proven-safe moves, mistakes, and insufficient evidence; always explain the colors with text/icons.
- [ ] Make the most useful next lesson immediately understandable.
- [ ] Move detailed reasoning, experimental reports, and advanced AI controls into lower/expandable sections.
- [ ] Preserve accessible keyboard navigation and reduced-motion support.
- [ ] Keep verified board analysis clearly separate from optional AI suggestions and provider usage/costs.

## Later — Ranked and account hardening, production release

- [ ] Continue verified Ranked flow and progression, account integration, database validation, security review, deployment checks, and real-user testing.
- [ ] Consider public, privacy-safe result links or share cards; copied summaries are not permanent public replay URLs.

## Working process

1. Start a focused feature branch after the previous feature is committed or merged.
2. Apply a reviewable installer patch with `--dry-run` first.
3. Format, run `npm test`, `npm run check`, and `git diff --check`.
4. Test critical user interactions in the browser.
5. Stage only intended files, commit, push, and open a pull request. Keep unrelated local editor settings out of commits.
