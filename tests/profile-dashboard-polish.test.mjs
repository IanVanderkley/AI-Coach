import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = p => readFileSync(p, "utf8");
test("profile dashboard polish retains verified totals and scope information", () => {
  const page = read("components/profile/practice-profile.tsx");
  assert.match(page, /trackedOverallStats \?\? overallStats/);
  assert.match(page, /<ProfileLevelCard compact/);
  assert.doesNotMatch(page, /<details className="dashboard-data-details">/);
  assert.match(page, /Lifetime recorded results/);
  assert.match(page, /Recent records only/);
  assert.doesNotMatch(page, /Your account progression, results and mode performance in one place/);
});
test("win-rate meters use available values only and retain accessible scope and history links", () => {
  const modes = read("components/profile/player-mode-card.tsx");
  const difficulty = read("components/profile/practice-difficulty-stats.tsx");
  assert.match(modes, /stats\?\.winRate != null &&/);
  assert.match(modes, /value=\{stats\.winRate\}/);
  assert.match(difficulty, /summary\?\.stats\.winRate != null &&/);
  assert.match(difficulty, /value=\{summary\.stats\.winRate\}/);
  assert.match(modes, /aria-expanded=\{expanded\}/);
  assert.match(modes, /href=\{historyHref\}/);
  assert.match(difficulty, /Practice statistics by difficulty/);
  assert.match(difficulty, /scope === "recent"/);
});
test("profile visual overrides are scoped with responsive layout and keyboard focus", () => {
  const css = read("styles/profile-dashboard-polish.css");
  assert.match(read("app/layout.tsx"), /profile-dashboard-polish\.css/);
  assert.match(css, /\.page-shell\.player-dashboard-page/);
  assert.match(css, /max-width: 1240px/);
  assert.match(css, /@media \(max-width: 800px\)/);
  assert.match(css, /summary:focus-visible/);
  assert.doesNotMatch(css, /animation\s*:|\.cell\b/);
});
