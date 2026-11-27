import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = path => readFileSync(path, "utf8");
test("result ceremony loads after prior surface styles", () => {
  const layout = read("app/layout.tsx");
  const index = layout.indexOf('import "../styles/result-ceremony.css";');
  assert.ok(index > layout.indexOf('import "../styles/game-station-polish.css";'));
  assert.ok(index >= 0);
  const css = read("styles/result-ceremony.css");
  assert.match(css, /\.practice-result-dialog/);
  assert.match(css, /\.ranked-result-dialog/);
  assert.doesNotMatch(css, /\.gameplayPage|\.ranked-server-board|\.cell\b|pointer-events\s*:/);
});
test("compact rank presentation preserves separate verified special events", () => {
  const css = read("styles/result-ceremony.css");
  for (const transition of ["unchanged", "promotion", "demotion"]) assert.ok(css.includes(`data-transition="${transition}"`));
  for (const tone of ["reward", "protection"]) assert.ok(css.includes(`data-feedback-tone="${tone}"`));
  assert.match(read("components/ui/feedback-notice.tsx"), /data-feedback-tone=\{tone\}/);
  const rating = read("components/ranked/ranked-match-rating.tsx");
  assert.match(rating, /value\.finalGuessCompensated &&/);
  assert.match(rating, /model\.demotionProtected &&/);
  assert.match(rating, /data-transition=\{model\.transition\}/);
});
test("new ceremony animations are finite and opt in to motion", () => {
  const css = read("styles/result-ceremony.css");
  const start = css.indexOf("@media (prefers-reduced-motion: no-preference)");
  const end = css.indexOf("@keyframes result-reward-arrive", start);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(css.slice(0,start) + css.slice(end), /\banimation\s*:/);
  assert.doesNotMatch(css, /\binfinite\b/);
  assert.match(css, /@media \(max-width: 390px\)/);
});
