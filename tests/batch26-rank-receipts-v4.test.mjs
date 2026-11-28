import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateRankPolicyV4,
  RANK_POLICY_V4,
} from "../lib/leaderboard/rank-policy-v4.ts";
import {
  calculateRankPolicyV2,
  calculateRankPolicyV3,
} from "../lib/leaderboard/rank-policy.ts";
import {
  parseRankedMatchRating,
  formatRatingDelta,
} from "../lib/leaderboard/match-rating.ts";

const receipt = (before, outcome, version, delta) => ({
  outcome,
  policyVersion: version,
  ratingBefore: before,
  ratingDelta: delta,
  ratingAfter: before + delta,
});

test("v4 receipts accept every ordinary policy outcome in the parity range", () => {
  const values = [
    RANK_POLICY_V4.minimum,
    RANK_POLICY_V4.minimum + 1,
    -1000000,
    ...Array.from({ length: 12001 }, (_, i) => i - 2000),
  ];
  for (const before of values)
    for (const outcome of ["won", "lost"]) {
      const r = receipt(before, outcome, 4, calculateRankPolicyV4(before, outcome).delta);
      assert.deepEqual(parseRankedMatchRating(r), r);
    }
});
test("v4 negative debt, protection, and large rewards are accepted", () => {
  for (const r of [
    receipt(-5, "lost", 4, -10),
    receipt(1505, "lost", 4, -5),
    receipt(1500, "lost", 4, -12),
    receipt(0, "won", 4, 160),
    receipt(10000, "won", 4, 0),
  ])
    assert.deepEqual(parseRankedMatchRating(r), r);
});
test("v4 forged or premature guess-compensation receipts are rejected", () => {
  for (const r of [
    receipt(1505, "lost", 4, -12),
    receipt(1500, "lost", 4, 0),
    receipt(1500, "lost", 4, 55),
    receipt(0, "won", 4, 159),
    receipt(0, "won", 4, 161),
    receipt(-2147483649, "won", 4, 160),
    receipt(10000, "won", 4, 1),
    receipt(1500, "won", 5, 110),
    { ...receipt(1500, "won", 4, 110), ratingAfter: 1609 },
  ])
    assert.throws(() => parseRankedMatchRating(r));
});
test("historical policy bounds and exact v2/v3 calculations stay strict", () => {
  for (const version of [2, 3])
    for (let before = 100; before <= 10000; before++)
      for (const outcome of ["won", "lost"]) {
        const delta = (version === 2 ? calculateRankPolicyV2 : calculateRankPolicyV3)(
          before,
          outcome,
        ).delta;
        const r = receipt(before, outcome, version, delta);
        assert.deepEqual(parseRankedMatchRating(r), r);
      }
  assert.deepEqual(
    parseRankedMatchRating(receipt(1000, "won", 1, 16)),
    receipt(1000, "won", 1, 16),
  );
  for (const version of [1, 2, 3]) {
    assert.throws(() => parseRankedMatchRating(receipt(-5, "won", version, 10)));
    assert.throws(() => parseRankedMatchRating(receipt(1000, "won", version, 160)));
  }
});
test("formatting only permits the expanded reward for explicit v4 receipts", () => {
  assert.equal(formatRatingDelta(160, 4), "+160");
  assert.equal(formatRatingDelta(-10, 4), "-10");
  assert.throws(() => formatRatingDelta(161, 4));
  assert.throws(() => formatRatingDelta(101));
});
