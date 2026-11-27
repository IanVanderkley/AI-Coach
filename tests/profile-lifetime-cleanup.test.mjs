import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const read = p => readFileSync(p, 'utf8');
test('overview uses persistent account totals and labels recent fallback distinctly', () => {
  const page = read('components/profile/practice-profile.tsx');
  assert.match(page, /Overall Statistics/);
  assert.match(page, /trackedOverallStats \?\? overallStats/);
  assert.match(page, /trackedOverallStats \? "Lifetime recorded results" : "Recent records only"/);
  assert.match(page, /accountPracticeTracking\?\.overall \?\? practiceStats/);
  assert.match(page, /accountPracticeTracking\?\.breakdown \?\? practiceDifficulties/);
  assert.doesNotMatch(page, /Practice synced to your account|Your account progression, results and mode performance|dashboard-data-details|profile-disclaimer/);
});
test('Practice scope remains honest without repetitive copy, and Elo guide is in lobby', () => {
  const mode = read('components/profile/player-mode-card.tsx');
  const difficulty = read('components/profile/practice-difficulty-stats.tsx');
  assert.match(mode, /ACCOUNT-RECORDED LIFETIME/);
  assert.match(mode, /RECENT RECORDED RESULTS/);
  assert.match(difficulty, /Practice statistics by difficulty/);
  assert.match(difficulty, /scope === "recent"/);
  assert.match(difficulty, /Recent saved games/);
  assert.doesNotMatch(mode + difficulty, /dashboard-data-details/);
  assert.doesNotMatch(read('components/profile/competitive-rank-card.tsx'), /How Elo works/);
  assert.match(read("components/ranked/ranked-lobby.tsx"), /href="\/faq#ranked">Ranked rules/);
});
