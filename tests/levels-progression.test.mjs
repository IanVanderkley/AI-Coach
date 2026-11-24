import assert from "node:assert/strict";
import test from "node:test";

import {
  XP_PER_LEVEL,
  calculateLevelProgress,
  parseAccountTotalXp,
} from "../lib/levels/progression.ts";

test("each level always requires exactly 1,000 XP", () => {
  assert.equal(XP_PER_LEVEL, 1000);
  for (const n of [0, 1, 2, 9, 99, 1000]) {
    const progress = calculateLevelProgress(n * XP_PER_LEVEL);
    assert.equal(progress.level, n + 1);
    assert.equal(progress.xpIntoLevel, 0);
    assert.equal(progress.xpToNextLevel, XP_PER_LEVEL);
  }
});

test("Level 1 starts at zero XP", () => {
  assert.deepEqual(calculateLevelProgress(0), {
    level: 1,
    totalXp: 0,
    xpIntoLevel: 0,
    xpToNextLevel: 1000,
    xpPerLevel: 1000,
    percent: 0,
  });
});

test("999 XP remains level 1", () => {
  const p = calculateLevelProgress(999);
  assert.equal(p.level, 1);
  assert.equal(p.xpToNextLevel, 1);
  assert.equal(p.percent, 99.9);
});

test("1,000 XP is exactly level 2", () => {
  const p = calculateLevelProgress(1000);
  assert.equal(p.level, 2);
  assert.equal(p.xpIntoLevel, 0);
});

test("3,500 XP is level 4 with 500 XP to go", () => {
  const p = calculateLevelProgress(3500);
  assert.equal(p.level, 4);
  assert.equal(p.xpIntoLevel, 500);
  assert.equal(p.xpToNextLevel, 500);
  assert.equal(p.percent, 50);
});

test("progress always stays in [0,100)", () => {
  for (const amount of [1, 17, 500, 999, 1001, 456789]) {
    const p = calculateLevelProgress(amount);
    assert.ok(p.percent >= 0 && p.percent < 100);
    assert.equal(p.xpIntoLevel + p.xpToNextLevel, 1000);
  }
});

test("rejects negative and noninteger XP", () => {
  for (const bad of [-1, 0.1, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => calculateLevelProgress(bad), RangeError);
  }
});

test("accepts safely encoded bigint totals from PostgREST", () => {
  assert.equal(parseAccountTotalXp("1250"), 1250);
  assert.equal(parseAccountTotalXp(2500), 2500);
});

test("rejects malformed XP totals", () => {
  for (const bad of ["-1", "5.5", "1e3", null, {}, [], 3.25, -100]) {
    assert.throws(() => parseAccountTotalXp(bad), TypeError);
  }
});
