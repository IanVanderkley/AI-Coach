import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const read = p => readFileSync(p, 'utf8');
test('overview cards share the same content and fastest ranked win remains in detailed statistics', () => {
  const mode = read('components/profile/player-mode-card.tsx');
  const detail = read('components/profile/ranked-stats-page.tsx');
  assert.doesNotMatch(mode, /fastestWinMs|player-mode-fastest/);
  assert.match(mode, /player-mode-actions/);
  assert.match(mode, /hidden=\{!expanded\}/);
  assert.match(detail, /formatRankedDuration\(stats\.fastestWinMs\)/);
});
test('missing rates reserve a slot without fabricating a zero percent meter', () => {
  const mode = read('components/profile/player-mode-card.tsx');
  const difficulty = read('components/profile/practice-difficulty-stats.tsx');
  assert.match(mode, /dashboard-meter-slot[\s\S]*?stats\?\.winRate != null &&/);
  assert.match(difficulty, /dashboard-meter-slot[\s\S]*?summary\?\.stats\.winRate != null &&/);
  assert.match(difficulty, /Practice statistics by difficulty/);
  assert.doesNotMatch(difficulty, /Lifetime recorded games/);
  assert.match(difficulty, /scope === "recent"/);
});
test('profile buttons align and fastest-win surface is charcoal', () => {
  const css = read('styles/profile-dashboard-polish.css');
  assert.match(css, /\.player-mode-actions \{[\s\S]*?margin-top: auto/);
  assert.match(css, /\.profile-detail-page \.profile-detail-best \{\s*background: #202020/);
  assert.match(css, /\.dashboard-meter-slot \{\s*min-height: 12px/);
  assert.match(css, /@media \(max-width: 480px\)/);
});
