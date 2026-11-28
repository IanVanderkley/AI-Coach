import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(p, "utf8");
test("Ranked and Practice coaching histories share compact row and grade layout", () => {
  const ranked = read("components/profile/ranked-history.tsx");
  const practice = read("components/coach/coach-console.tsx");
  for (const source of [ranked, practice]) {
    for (const cls of [
      "coach-history-list",
      "coach-history-row",
      "coach-history-result",
      "coach-history-detail",
      "coach-history-score",
      "practice-review-link coach-history-action",
    ]) {
      assert.ok(source.includes(`className="${cls}"`), cls);
    }
    assert.match(source, /<Clock3 size=\{14\}/);
  }
  assert.match(
    ranked,
    /\)\s*:\s*onReviewMatch\s*\?\s*\(\s*<ul\s+className="coach-history-list"/,
  );
  assert.match(
    ranked,
    /disabled=\{\s*!game\.reviewAvailable\s*\|\|\s*!isRankedRecordingId\(game\.matchId\)\s*\}/,
  );
  assert.match(ranked, /<ol className="ranked-history-list">/);
  assert.match(
    ranked,
    /\{!onReviewMatch\s*&&\s*\(?\s*<div\s+className="ranked-history-summary"/,
  );
});
test("shared columns remain aligned with pending grades and narrow screens", () => {
  const css = read("styles/coaching-lessons.css");
  assert.match(css, /grid-template-columns: 9px minmax\(0, 1fr\) 80px 84px 76px 132px/);
  assert.match(css, /\.coach-history-score\s*\{[^}]*min-height: 60px/);
  assert.match(css, /@media \(max-width: 740px\)\s*\{\s*\.coach-history-row/);
  assert.match(css, /\.coach-history-action:disabled/);
});
