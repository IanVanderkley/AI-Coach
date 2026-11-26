import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RANK_DEFINITIONS,
  RANK_POLICY,
  calculateRankPolicyV2,
  competitiveRank,
  expectedSoloScore,
} from "../lib/leaderboard/rank-policy.ts";

test("rank policy contains 34 milestones in the approved order", () => {
  assert.deepEqual(
    RANK_DEFINITIONS.map((rank) => [rank.name, rank.min, rank.divisions]),
    [
      ["Copper", 100, 5],
      ["Bronze", 600, 5],
      ["Silver", 1100, 5],
      ["Gold", 1600, 5],
      ["Platinum", 2100, 5],
      ["Emerald", 2600, 5],
      ["Diamond", 3100, 3],
      ["Omniscient", 3400, 0],
    ],
  );
  assert.equal(
    RANK_DEFINITIONS.reduce((sum, rank) => sum + rank.divisions, 1),
    34,
  );
});

test("all 33 divisions have exactly 100 rating points and correct Roman numerals", () => {
  const names = ["I", "II", "III", "IV", "V"];
  for (const rank of RANK_DEFINITIONS) {
    for (let i = 0; i < rank.divisions; i++) {
      const start = rank.min + 100 * i;
      const low = competitiveRank(start);
      const high = competitiveRank(start + 99);
      assert.equal(low.label, `${rank.name} ${names[rank.divisions - i - 1]}`);
      assert.equal(high.label, low.label);
      assert.equal(low.minimum, start);
      assert.equal(low.nextThreshold, start + 100);
      assert.equal(low.eloToPromotion, 100);
      assert.equal(high.eloToPromotion, 1);
      assert.equal(low.progress, 0);
      assert.equal(high.progress, 0.99);
      assert.notEqual(competitiveRank(start + 100).label, low.label);
    }
  }
});

test("starting rating is Bronze I and Omniscient has no division or promotion", () => {
  assert.equal(competitiveRank(RANK_POLICY.starting).label, "Bronze I");
  assert.equal(competitiveRank(3399).label, "Diamond I");
  for (const rating of [3400, 5000, 10000]) {
    const rank = competitiveRank(rating);
    assert.equal(rank.label, "Omniscient");
    assert.equal(rank.division, null);
    assert.equal(rank.nextThreshold, null);
    assert.equal(rank.eloToPromotion, null);
    assert.equal(rank.progress, null);
  }
});

test("invalid ratings and outcomes are rejected", () => {
  for (const rating of [99, 10001, 100.5, NaN, Infinity, "1000", null]) {
    assert.throws(() => competitiveRank(rating), RangeError);
    assert.throws(() => calculateRankPolicyV2(rating, "won"), RangeError);
  }
  assert.throws(() => calculateRankPolicyV2(1000, "abandoned"), RangeError);
});

test("candidate award samples preserve asymmetric win rewards", () => {
  for (const [rating, win, loss] of [
    [1000, 63, -13],
    [1600, 48, -21],
    [1700, 45, -23],
    [2100, 34, -28],
    [3400, 10, -40],
  ]) {
    assert.deepEqual(calculateRankPolicyV2(rating, "won"), {
      rating: rating + win,
      delta: win,
    });
    assert.deepEqual(calculateRankPolicyV2(rating, "lost"), {
      rating: rating + loss,
      delta: loss,
    });
  }
});

test("all legal ratings produce bounded integer awards and consistent progress", () => {
  const labels = new Set();
  for (let rating = 100; rating <= 10000; rating++) {
    const rank = competitiveRank(rating);
    labels.add(rank.label);
    const win = calculateRankPolicyV2(rating, "won");
    const loss = calculateRankPolicyV2(rating, "lost");
    assert.ok(Number.isInteger(win.delta) && win.delta >= 0);
    assert.ok(Number.isInteger(loss.delta) && loss.delta <= 0);
    assert.ok(win.rating <= 10000 && loss.rating >= 100);
    assert.equal(win.rating, rating + win.delta);
    assert.equal(loss.rating, rating + loss.delta);
  }
  assert.equal(labels.size, 34);
});

test("difficulty rises with rating and Gold matches the proposed average skill target", () => {
  function equilibrium(winRate) {
    return Math.round(1700 + 1900 * Math.log10((2 * winRate) / (1 - winRate)));
  }
  assert.equal(competitiveRank(equilibrium(0.35)).name, "Gold");
  assert.equal(competitiveRank(equilibrium(0.4)).name, "Gold");
  assert.equal(competitiveRank(equilibrium(0.45)).name, "Platinum");
  assert.equal(competitiveRank(equilibrium(0.75)).name, "Diamond");
  assert.equal(competitiveRank(equilibrium(0.8)).name, "Omniscient");
  assert.ok(expectedSoloScore(3400) > expectedSoloScore(1600));
});
