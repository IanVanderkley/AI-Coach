import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = (p) => readFileSync(p, "utf8");
test("Practice header removes redundant visual copy but retains the difficulty group name", () => {
  const page = read("app/page.tsx");
  assert.doesNotMatch(page, /Learn how to really play|className="session-info"/);
  assert.match(page, /<legend className="sr-only">Board difficulty<\/legend>/);
  assert.match(read("styles/base.css"), /\.sr-only\s*\{[\s\S]*?clip-path: inset\(50%\)/);
  assert.match(page, /<ModeSelector\s*\/>/);
  assert.match(page, /name="practice-difficulty"/);
  assert.match(page, /checked=\{difficulty === next\}/);
  assert.match(page, /savePracticeDifficulty\(window.localStorage, next\)/);
  assert.match(page, /option.rows/);
  assert.match(page, /option.mines/);
});
test("desktop mode controls align after removing the visible legend", () => {
  const css = read("styles/game-station-polish.css");
  assert.match(
    css,
    /Batch 27C\.1[\s\S]*?@media \(min-width: 1051px\)[\s\S]*?\.practice-page \.practice-setup-row\s*\{\s*align-items: center;/,
  );
});
