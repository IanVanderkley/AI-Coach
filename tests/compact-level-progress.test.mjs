import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { calculateLevelProgress } from "../lib/levels/progression.ts";
const read = (p) => readFileSync(p, "utf8");

test("level ring uses exact account progression, including level boundaries", () => {
  const nav = read("components/play/nav-player-level.tsx");
  assert.match(nav, /strokeDasharray=\{`\$\{progress\.percent\} 100`\}/);
  assert.match(nav, /pathLength=\{100\}/);
  assert.match(nav, /progress\.percent === 0 \? "hidden" : "visible"/);
  assert.match(nav, /loaded\.userId !== userId/);
  assert.match(read("lib/levels/repository.ts"), /auth\.user\.id !== expectedUserId/);
  assert.equal(calculateLevelProgress(100).percent, 10);
  assert.equal(calculateLevelProgress(1999).percent, 99.9);
  assert.equal(calculateLevelProgress(2000).percent, 0);
});

test("verified receipt refreshes navbar and compact profile progress without granting XP", () => {
  const nav = read("components/play/nav-player-level.tsx");
  const profile = read("components/profile/profile-level-card.tsx");
  const receipt = read("components/ranked/ranked-match-xp-receipt.tsx");
  assert.match(receipt, /result\.outcome === expectedOutcome\)\s*window\.dispatchEvent/);
  for (const source of [nav, profile]) {
    assert.match(source, /addEventListener\("ai-coach:xp-updated"/);
    assert.match(source, /removeEventListener\("ai-coach:xp-updated"/);
    assert.doesNotMatch(source, /\.insert\(|\.upsert\(|\.update\(|\.rpc\(/);
  }
  assert.match(profile, /role="progressbar"/);
  assert.match(profile, /aria-valuenow=\{progress\.xpIntoLevel\}/);
  assert.match(profile, /if \(!progress\) return null/);
});

test("play and resume are centered and the mines counter stays server-derived", () => {
  const css = read("app/ranked/ranked-layout.module.css");
  const page = read("app/ranked/page.tsx");
  assert.match(css, /\.launch\s*\{[^}]*margin:\s*24px auto;/);
  assert.match(page, /<dt>Mines left<\/dt>/);
  assert.match(page, /Math\.max\(0, board\.mineCount - board\.flagCount\)/);
  assert.doesNotMatch(page, /Mines left \(estimate\)/);
  assert.equal((page.match(/expectedMoveCount: board\.moveCount/g) ?? []).length, 3);
});
