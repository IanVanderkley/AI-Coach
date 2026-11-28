import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const read = p => readFileSync(p,"utf8");
test("learning meters use only available real metrics and preserve missing evidence", () => {
  const ui=read("components/coach/personalized-coaching.tsx");
  assert.match(ui,/learning\.metrics\.accuracy !== null &&/);
  assert.match(ui,/value=\{learning\.metrics\.accuracy\}/);
  assert.match(ui,/learning\.metrics\.score !== null &&/);
  assert.match(ui,/value=\{learning\.metrics\.score\}/);
  assert.match(ui,/learning\.selected\.length < 10/);
  // 28E.5a uses the stricter trend comparison on the validated review cohort.
  assert.match(ui,/const accuracyChange = trends\.comparison\.accuracyChange;/);
  assert.match(ui,/data-direction=\{accuracyChange === null \? "unknown"/);
  assert.match(ui,/\{formatLearningChange\(accuracyChange\)\}/);
  assert.match(ui,/buildLearningDashboard\(reports, mode, actualDifficulty, windowSize\)/);
  assert.match(ui,/trendAvailability\(trends\.comparison\)/);
  const dashboard=read("lib/coach/learning-dashboard.ts");
  assert.match(dashboard,/analyzeLearningReviews\(reports, mode, difficulty, windowSize\)/);
  assert.match(dashboard,/buildLearningTrends\(learning\.selected, mode, difficulty, windowSize\)/);
  assert.match(dashboard,/if \(value === null\) return "Not enough data";/);
  assert.match(dashboard,/accuracy: learning\.evidence\.decisionAccuracy\.percent/);
});
test("saved report grades and learning styling use existing data and responsive layout", () => {
  const ui=read("components/coach/personalized-coaching.tsx");
  assert.match(ui,/data-grade=\{item\.review\.score\.grade \?\? "none"\}/);
  assert.match(ui,/item\.review\.score\.score !== null/);
  assert.match(ui,/open=\{sections\.saved\}/);
  assert.match(ui,/onReview\(item\.mode, item\.gameRef\)/);
  assert.match(read("app/coaching/page.tsx"),/coaching-learning-polish\.css/);
  assert.match(read("styles/coaching-learning-polish.css"),/@media \(max-width: 650px\)/);
});
