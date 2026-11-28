import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RANK_POLICY_V4,
  RANK_TIERS_V4,
  competitiveRankV4,
  calculateRankPolicyV4,
} from "../lib/leaderboard/rank-policy-v4.ts";

const win = (rating) => calculateRankPolicyV4(rating, "won");
const loss = (rating) => calculateRankPolicyV4(rating, "lost");

test("every division promotes at exactly the next 100-point threshold", () => {
  for (const tier of RANK_TIERS_V4) {
    if (!tier.divisions) continue;
    for (let i = 0; i < tier.divisions; i++) {
      const floor = tier.min + i * 100;
      const numeral = ["I", "II", "III", "IV", "V"][tier.divisions - 1 - i];
      assert.equal(competitiveRankV4(floor).label, `${tier.name} ${numeral}`);
      assert.equal(competitiveRankV4(floor).progress, 0);
      assert.equal(competitiveRankV4(floor + 99).progress, 0.99);
      assert.equal(competitiveRankV4(floor + 99).eloToPromotion, 1);
      assert.notEqual(competitiveRankV4(floor + 100).label, `${tier.name} ${numeral}`);
    }
  }
  assert.equal(competitiveRankV4(RANK_POLICY_V4.starting).label, "Gold V");
  assert.equal(competitiveRankV4(3300).label, "Omniscient");
  assert.equal(competitiveRankV4(10000).nextThreshold, null);
});

test("Copper V allows negative ratings and does not protect zero", () => {
  for (const rating of [-10000, -101, -1, 0, 1, 99]) {
    const rank = competitiveRankV4(rating);
    assert.equal(rank.label, "Copper V");
    assert.equal(rank.protectedFloor, null);
    assert.equal(rank.eloToPromotion, 100 - rating);
    assert.equal(loss(rating).delta, -10);
  }
  assert.equal(competitiveRankV4(-50).progress, 0);
  assert.equal(loss(0).rating, -10);
  assert.equal(win(-50).rating, 110);
});

test("a crossing loss lands at zero progress then the next loss demotes", () => {
  for (let floor = 100; floor <= 3300; floor += 100) {
    const current = competitiveRankV4(floor + 1);
    assert.deepEqual(loss(floor + 1), {
      rating: floor,
      delta: -1,
      nominalDelta: -current.loss,
      demotionProtected: true,
    });
    assert.equal(loss(floor).rating, floor - current.loss);
    assert.equal(loss(floor).demotionProtected, false);
    assert.notEqual(competitiveRankV4(loss(floor).rating).label, current.label);
    assert.equal(loss(floor + current.loss).rating, floor);
    assert.equal(loss(floor + current.loss).demotionProtected, false);
  }
  assert.equal(loss(1505).rating, 1500);
  assert.equal(loss(1500).rating, 1488);
});

test("winning restores protection once above a floor; no hidden protection state", () => {
  const first = loss(1505);
  const recovered = win(first.rating);
  assert.equal(recovered.rating, 1610);
  const shield = loss(recovered.rating);
  assert.equal(shield.rating, 1600);
  assert.equal(shield.demotionProtected, true);
  assert.equal(loss(shield.rating).rating, 1588);
});

test("nominal reward schedule uses the starting tier, including multi-division wins", () => {
  const expected = [
    [160, 10],
    [140, 10],
    [120, 10],
    [110, 12],
    [100, 15],
    [85, 18],
    [70, 22],
    [50, 25],
  ];
  for (let i = 0; i < RANK_TIERS_V4.length; i++) {
    const tier = RANK_TIERS_V4[i];
    const rating = tier.min + 50;
    assert.equal(win(rating).nominalDelta, expected[i][0]);
    assert.equal(loss(rating).nominalDelta, -expected[i][1]);
    assert.equal(loss(rating).delta, -expected[i][1]);
  }
  assert.equal(win(499).rating, 659);
  assert.equal(win(9990).delta, 10);
  assert.equal(win(10000).delta, 0);
});

test("sweep validates bounds, protection, progress and receipt arithmetic", () => {
  for (let rating = -2000; rating <= 10000; rating++) {
    const rank = competitiveRankV4(rating);
    assert.ok(rank.progress === null || (rank.progress >= 0 && rank.progress < 1));
    for (const outcome of ["won", "lost"]) {
      const result = calculateRankPolicyV4(rating, outcome);
      assert.equal(result.rating, rating + result.delta);
      assert.ok(result.rating <= 10000);
      if (outcome === "lost") {
        assert.ok(result.delta < 0);
        assert.ok(result.delta <= -10 || result.demotionProtected);
      } else {
        assert.ok(result.delta >= 0);
        assert.equal(result.demotionProtected, false);
      }
    }
  }
});

test("reject invalid inputs; retain integer storage safety at extreme debt", () => {
  for (const bad of [NaN, Infinity, -Infinity, 1.5, "1500", 10001, -2147483649]) {
    assert.throws(() => competitiveRankV4(bad), RangeError);
  }
  assert.throws(() => calculateRankPolicyV4(1500, "abandoned"), RangeError);
  assert.throws(() => calculateRankPolicyV4(1500, "final-guess"), RangeError);
  assert.equal(loss(RANK_POLICY_V4.minimum).delta, 0);
  assert.equal(loss(RANK_POLICY_V4.minimum + 1).delta, -1);
});
