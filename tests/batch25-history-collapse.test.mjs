import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const ui = read("components/coach/coach-console.tsx");
test("Practice history starts expanded with an accessible toggle and stable heading link", () => {
  assert.match(ui, /const \[practiceExpanded, setPracticeExpanded\] = useState\(true\)/);
  assert.match(ui, /id="coach-history-title"/);
  assert.match(ui, /aria-expanded=\{practiceExpanded\}/);
  assert.match(ui, /aria-controls="coach-practice-history-body"/);
  assert.match(ui, /setPracticeExpanded\(\(current\) => !current\)/);
});
test("collapsing Practice hides the list without unmounting or hiding Ranked history", () => {
  const body = ui.indexOf('id="coach-practice-history-body"');
  const rows = ui.indexOf('className="coach-history-list"');
  const ranked = ui.indexOf('className="coach-ranked-history"');
  assert.ok(body >= 0 && body < rows && rows < ranked);
  assert.match(ui.slice(body, rows), /hidden=\{!practiceExpanded\}/);
  assert.match(ui.slice(body, ranked), /<\/div>\s*<\/div>\s*<div\s*$/);
  assert.doesNotMatch(ui, /practiceExpanded\s*&&\s*\(/);
  assert.match(ui.slice(ranked), /<RankedHistory onReviewMatch=\{openRankedGame\} \/>/);
});
test("Practice review links and automatic grading still use the same recordings", () => {
  assert.match(ui, /onClick=\{\(\) => void openGame\(game\.id\)\}/);
  assert.match(ui, /repository\.loadReview\(item\.id\)/);
  assert.match(ui, /scorePracticeReview\(recording\)/);
  assert.match(ui, /autoGrades \|\| reviewed\[game\.id\]/);
});
test("both history sections reuse the accessible collapsed styles", () => {
  const ranked = read("components/profile/ranked-history.tsx");
  assert.match(ranked, /aria-expanded=\{rankedExpanded\}/);
  assert.match(ranked, /hidden=\{!rankedExpanded\}/);
  const css = read("styles/profile-history-controls.css");
  assert.match(css, /\.profile-history-body\[hidden\]/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
