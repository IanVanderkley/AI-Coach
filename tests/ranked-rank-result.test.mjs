import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  parseRankedMatchRating,
  formatRatingDelta,
} from "../lib/leaderboard/match-rating.ts";
import { calculateRankPolicyV2 } from "../lib/leaderboard/rank-policy.ts";
import { rankResultModel } from "../lib/leaderboard/rank-result.ts";

const receipt = (before, outcome) => {
  const change = calculateRankPolicyV2(before, outcome);
  return {
    policyVersion: 2,
    outcome,
    ratingBefore: before,
    ratingDelta: change.delta,
    ratingAfter: change.rating,
  };
};
test("every legal v2 award is accepted, including gains over 32", () => {
  for (let r = 100; r <= 10000; r++) {
    for (const outcome of ["won", "lost"]) {
      const value = receipt(r, outcome);
      assert.deepEqual(parseRankedMatchRating(value), value);
      assert.doesNotThrow(() => formatRatingDelta(value.ratingDelta));
    }
  }
  assert.equal(formatRatingDelta(receipt(1000, "won").ratingDelta), "+63");
});
test("historical v1 awards are preserved and never interpreted as v2 promotions", () => {
  const value = {
    policyVersion: 1,
    outcome: "won",
    ratingBefore: 1090,
    ratingDelta: 12,
    ratingAfter: 1102,
  };
  assert.deepEqual(parseRankedMatchRating(value), value);
  assert.equal(rankResultModel(value).transition, "unchanged");
});
test("rejects malformed, forged or incorrectly versioned receipts", () => {
  const value = receipt(1000, "won");
  for (const bad of [
    { ...value, policyVersion: 1 },
    { ...value, policyVersion: 4 },
    { ...value, policyVersion: undefined },
    { ...value, ratingDelta: 62, ratingAfter: 1062 },
    { ...value, outcome: "lost" },
    { ...value, ratingAfter: 1064 },
  ])
    assert.throws(() => parseRankedMatchRating(bad));
  assert.throws(() => formatRatingDelta(101));
  assert.deepEqual(parseRankedMatchRating({ ...value, userId: "private" }), value);
});
test("rank transitions use only before and after, including division and tier changes", () => {
  assert.equal(rankResultModel(receipt(995, "won")).transition, "promotion");
  assert.equal(rankResultModel(receipt(1090, "won")).after.label, "Silver V");
  assert.equal(rankResultModel(receipt(1100, "lost")).transition, "demotion");
  assert.equal(rankResultModel(receipt(1000, "won")).transition, "unchanged");
  assert.equal(rankResultModel(receipt(3399, "won")).nextRank, null);
  assert.equal(rankResultModel(receipt(100, "lost")).transition, "unchanged");
});
test("owner receipt route and result UI retain security and no lobby controls in gameplay", () => {
  const route = readFileSync("app/api/leaderboard/match-rating/route.ts", "utf8");
  const ui = readFileSync("components/ranked/ranked-match-rating.tsx", "utf8");
  const page = readFileSync("app/ranked/page.tsx", "utf8");
  const css = readFileSync("styles/ranked-rating.css", "utf8");
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /\.eq\("user_id", user.id\)/);
  assert.match(route, /policyVersion: data.policy_version/);
  assert.match(route, /private, no-store/);
  assert.match(ui, /RankEmblem rating=\{value.ratingAfter\}/);
  assert.match(ui, /value.outcome === expectedOutcome/);
  assert.match(page, /showLobby && <RankedLobby \/>/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(ui, /calculateRankPolicyV2|type="range"|method:\s*"POST"/);
});
