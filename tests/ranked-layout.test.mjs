import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const page = readFileSync("app/ranked/page.tsx", "utf8");
const css = readFileSync("app/ranked/ranked-layout.module.css", "utf8");

test("Ranked offers primary play and explicit resume without a new match request on resume", () => {
  assert.match(page, /PLAY INTERMEDIATE/);
  assert.match(page, /RESUME MATCH/);
  assert.doesNotMatch(page, /Ready to play\?/);
  assert.match(page, /if \(await loadBoard\(\)\) setResumeRequired\(false\)/);
  assert.match(page, /!resumeRequired \|\| board.status !== "active"/);
});
test("Ranked stats and controls retain server values and revision guards", () => {
  assert.match(page, /\{board.moveCount\}/);
  assert.match(page, /\{board.flagCount\}/);
  assert.match(page, /Flags remaining/);
  assert.doesNotMatch(page, /Flags remaining \(estimate\)/);
  assert.equal((page.match(/expectedMoveCount: board\.moveCount/g) ?? []).length, 3);
  assert.match(page, /aria-pressed=\{inputMode === "reveal"\}/);
  assert.match(page, /aria-pressed=\{inputMode === "flag"\}/);
  assert.match(page, /disabled=\{board.status !== "active" \|\| !board.firstMoveDone\}/);
});
test("Ranked launch and controls are responsive and keyboard accessible", () => {
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /max-width:\s*420px/);
});
