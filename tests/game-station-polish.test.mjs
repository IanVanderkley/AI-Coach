import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = p => readFileSync(p, "utf8");

test("game station stylesheet is loaded after the verified 27B surfaces", () => {
  const layout = read("app/layout.tsx");
  const after = layout.indexOf('import "../styles/game-station-polish.css";');
  assert.ok(after > layout.indexOf('import "../styles/play-surface-polish.css";'));
  assert.ok(after >= 0);
  const css = read("styles/game-station-polish.css");
  assert.match(css, /\.page-shell\.practice-page:not\(\[data-difficulty="expert"\]\)/);
  assert.match(css, /\.page-shell\.ranked-gameplay-page/);
  assert.match(css, /@media \(min-width: 1440px\)/);
});
test("station styling preserves individual cells, board dimensions and scroll behavior", () => {
  const css = read("styles/game-station-polish.css");
  assert.doesNotMatch(css, /\.cell\b|pointer-events\s*:|\boverflow\s*:|(?<![-\w])position\s*:|--board-columns\s*:|--board-rows\s*:/);
  const frame = css.match(/\.practice-page \.play-layout \.minesweeper-board,\s*\.ranked-gameplay-page \.ranked-server-board\s*\{([^}]+)\}/)[1];
  assert.doesNotMatch(frame, /\b(?:width|height|padding|gap|display|grid-template-columns)\s*:/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*?background-image: none/);
});
test("both HUDs use neutral surfaces and retain small-screen and Expert layout guards", () => {
  const css = read("styles/game-station-polish.css");
  const ranked = read("app/ranked/ranked-layout.module.css");
  const polish = ranked.split("/* Batch 27C:")[1];
  assert.ok(polish);
  assert.match(polish, /\.gameplayPage \.stats > div/);
  assert.match(polish, /@media \(min-width: 901px\)/);
  assert.doesNotMatch(polish, /\.lobbyPage|\.queuedCell|\.ranked-server-board|animation\s*:/);
  assert.match(css, /@media \(min-width: 601px\)/);
  assert.doesNotMatch(css, /animation\s*:/);
  assert.match(ranked, /minmax\(32px, 1fr\)/);
  assert.match(css, /:not\(\[data-difficulty="expert"\]\) \.play-layout \.board-area/);
});
