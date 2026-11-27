import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = p => readFileSync(p, "utf8");
test("player history excludes experimental cards and duplicate explanatory text", () => {
  const ui = read("components/coach/coach-console.tsx");
  assert.match(ui, /useState\(false\);\s*useEffect\(\(\) => \{\s*if \(process.env.NODE_ENV === "development"\)/);
  assert.match(ui, /\{showDevSamples && \(\s*<details className="coach-demo-tests"/);
  assert.doesNotMatch(ui, /How accurate is this review\?|Showing your saved Practice recordings/);
  assert.match(ui, /<PersonalizedCoaching/);
  assert.match(read("components/settings/replay-tooltip-setting.tsx"), /key !== "samples" && key !== "accuracy"/);
});
test("Ranked Coaching refresh is in the collapsible body and Profile retains its controls", () => {
  const ui = read("components/profile/ranked-history.tsx");
  assert.match(ui, /\{!onReviewMatch && \(\s*<button\s+type="button"\s+onClick=\{\(\) => setRevision/);
  const body = ui.slice(ui.indexOf('id="ranked-history-body"'));
  assert.match(body, /hidden=\{!rankedExpanded\}/);
  assert.match(body, /onReviewMatch && state.kind !== "guest"/);
  assert.match(body, /className="coach-ranked-history-footer"[\s\S]*?setRevision[\s\S]*?Refresh matches/);
  assert.match(body, /\{!onReviewMatch && \(\s*<p className="ranked-history-footnote">/);
  assert.doesNotMatch(body, /Refresh to retry unavailable grades/);
});
