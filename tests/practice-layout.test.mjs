import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(path, "utf8");
const page = read("app/page.tsx");
const board = read("components/play/minesweeper-board.tsx");
const stats = read("components/play/game-stats.tsx");
const css = read("styles/practice-layout.css");

test("Practice difficulty cards use native radio inputs and retain persisted per-difficulty games", () => {
  assert.match(page, /type="radio"/);
  assert.match(page, /name="practice-difficulty"/);
  assert.match(page, /checked=\{difficulty === next\}/);
  assert.match(page, /savePracticeDifficulty\(window\.localStorage, next\)/);
  assert.match(page, /key=\{difficulty\}/);
  assert.match(page, /DIFFICULTY_SETTINGS\[next\]/);
});

test("Practice displays real timer, flag count, remaining mines and honest game state", () => {
  assert.match(board, /flaggedCount=\{flaggedCount\}/);
  assert.match(board, /minesRemaining=\{mines - flaggedCount\}/);
  assert.match(board, /elapsedTime=\{formatTime\(elapsedSeconds\)\}/);
  assert.match(stats, /Time elapsed/);
  assert.match(stats, /Flags placed/);
  assert.match(stats, /Mines left/);
  assert.match(stats, /role="status"/);
});

test("Reveal and flag stay separate from pause and restart with recovery guards", () => {
  assert.match(board, /aria-pressed=\{inputMode === "reveal"\}/);
  assert.match(board, /aria-pressed=\{inputMode === "flag"\}/);
  assert.match(board, /className="practice-actions"/);
  assert.match(board, /onClick=\{togglePause\}/);
  assert.match(board, /onClick=\{requestNewGame\}/);
  assert.match(
    board,
    /disabled=\{!recoveryReady \|\| pendingRecovery !== null \|\| replaceOpen\}/,
  );
  assert.match(board, /<PracticeRecoveryDialog/);
  assert.match(board, /<PracticeResultDialog/);
});

test("Wide boards scroll independently and paused board visibility is preserved", () => {
  assert.match(board, /className="practice-board-scroll"/);
  assert.match(board, /data-paused=\{paused && !gameOver\}/);
  assert.match(css, /\.practice-board-scroll\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /minmax\(32px, 1fr\)/);
  assert.match(css, /\[data-paused="true"\][^{]*\{[^}]*visibility:\s*hidden/s);
  assert.match(css, /data-difficulty="expert"/);
});

test("Practice presentation imports after shared UI and keeps keyboard focus and mobile sizing", () => {
  const layout = read("app/layout.tsx");
  assert.ok(
    layout.indexOf('import "../styles/ui-consistency.css"') <
      layout.indexOf('import "../styles/practice-layout.css"'),
  );
  assert.match(css, /focus-visible/);
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /--ui-control-height/);
  assert.doesNotMatch(css, /\.ranked-server-board\s*\{/);
});
