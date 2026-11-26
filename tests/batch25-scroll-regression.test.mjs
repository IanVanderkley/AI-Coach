import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gameViewportScrollDelta } from "../lib/game-viewport-scroll.ts";
import { latestFollowUpScrollTop } from "../lib/coach/follow-up-thread.ts";

const delta = (panelTop, boardTop, boardBottom) =>
  gameViewportScrollDelta({
    panelTop,
    boardTop,
    boardBottom,
    viewportTop: 80,
    viewportBottom: 780,
  });

test("already visible boards do not move the page", () => {
  assert.equal(delta(100, 240, 740), 0);
});
test("scroll only the missing distance when controls and board fit", () => {
  assert.equal(delta(250, 400, 900), 120);
  assert.equal(delta(20, 180, 680), -60);
});
test("prioritize the whole board when controls and board cannot both fit", () => {
  assert.equal(delta(100, 400, 1000), 220);
});
test("oversize boards align their top without changing cell size", () => {
  assert.equal(delta(100, 400, 1250), 320);
});
test("a short latest answer scrolls to the bottom; a long answer shows its start", () => {
  assert.equal(latestFollowUpScrollTop(950, 1100, 480), 620);
  assert.equal(latestFollowUpScrollTop(600, 1400, 480), 600);
  assert.equal(latestFollowUpScrollTop(0, 200, 480), 0);
});

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
test("board scrolling is keyed to entry, not move or clock changes", () => {
  const hook = source("../components/play/use-game-viewport-scroll.ts");
  assert.match(hook, /handledEntry\.current === entryKey/);
  assert.match(hook, /\[entryKey, panelRef\]/);
  assert.match(hook, /behavior: "instant"/);
  assert.doesNotMatch(hook, /fetch\(/);
  const practice = source("../components/play/minesweeper-board.tsx");
  assert.match(practice, /settings\.rows > 9 &&/);
  assert.match(practice, /String\(gameViewRevision\)/);
  const ranked = source("../app/ranked/page.tsx");
  assert.match(ranked, /board\?\.status === "active"/);
  assert.match(ranked, /board\.matchId}:\$\{gameViewRevision}/);
});
test("new follow-up answers reveal inside the answer pane and retain in-memory state", () => {
  const ui = source("../components/coach/verified-follow-up.tsx");
  assert.match(ui, /appendThreadAnswer\(threadRef\.current, result\.answer\)/);
  assert.match(ui, /revealLatestRef\.current = true/);
  assert.match(ui, /panel\.scrollTop = latestFollowUpScrollTop\(/);
  assert.match(ui, /serializeFollowUpThread\(threadRef\.current\)/);
  assert.doesNotMatch(ui, /scrollIntoView|window\.scroll|fetch\(/);
});
