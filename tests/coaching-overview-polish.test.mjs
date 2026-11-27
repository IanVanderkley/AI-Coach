import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DEFAULT_COACHING_SECTIONS, normalizeCoachingSections } from "../lib/settings/coaching-section-preferences.ts";
const read = p => readFileSync(p, "utf8");
test("Coaching shell and completion meter use existing review data", () => {
  const page = read("app/coaching/page.tsx");
  const ui = read("components/coach/review-overview.tsx");
  assert.match(page, /page-shell coaching-page/);
  assert.doesNotMatch(page, /ANALYSE\. LEARN\. IMPROVE\.|AI optional|className="page-footer"/);
  assert.match(ui, /<progress[^>]+max=\{100\} value=\{review.progress\}/);
  assert.match(ui, /review.score === null/);
  assert.match(ui, /reviewToneSummary/);
  assert.match(ui, /onReviewMove/);
});
test("Replay opens by default without overriding explicit saved preferences", () => {
  assert.equal(DEFAULT_COACHING_SECTIONS.replay, true);
  assert.equal(normalizeCoachingSections({ replay: false }).replay, false);
  assert.equal(normalizeCoachingSections({}).replay, true);
  const ui = read("components/coach/coach-console.tsx");
  assert.equal((ui.match(/setReplayExpanded\(showReplay \|\| readCoachingSections\(\).replay\)/g) || []).length, 2);
  assert.match(ui, /className="coach-review-toolbar"/);
  assert.match(ui, /hidden=\{!replayExpanded\}/);
});
