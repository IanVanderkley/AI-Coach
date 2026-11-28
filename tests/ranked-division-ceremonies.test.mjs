import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  rankResultModel,
  rankTransitionSteps,
  RANK_PROMOTION_STEP_MS,
  RANK_DEMOTION_STEP_MS,
} from "../lib/leaderboard/rank-result.ts";
import { calculateRankPolicyV4 } from "../lib/leaderboard/rank-policy-v4.ts";
import { displayRank } from "../lib/leaderboard/rank-display.ts";
import { parseRankedMatchRating } from "../lib/leaderboard/match-rating.ts";
const receipt = (before, outcome) => {
  const change = calculateRankPolicyV4(before, outcome);
  return parseRankedMatchRating({
    policyVersion: 4,
    outcome,
    ratingBefore: before,
    ratingAfter: change.rating,
    ratingDelta: change.delta,
  });
};
const labels = (r) => rankTransitionSteps(r).map((s) => [s.from.label, s.to.label]);
test("double promotion reveals both crossed divisions in order and preserves exact final progress", () => {
  const r = receipt(1595, "won");
  assert.equal(r.ratingAfter, 1705);
  assert.deepEqual(labels(r), [
    ["Gold V", "Gold IV"],
    ["Gold IV", "Gold III"],
  ]);
  const steps = rankTransitionSteps(r);
  assert.equal(steps[0].toRating, 1600);
  assert.equal(steps[1].toRating, 1705);
  assert.equal(rankResultModel(r).nextRank, "Gold II");
  assert.equal(rankResultModel(r).after.eloToPromotion, 95);
});
test("Platinum V to IV with 5 Elo remaining is a single promotion, not a double", () => {
  const r = receipt(2095, "won");
  assert.deepEqual(labels(r), [["Platinum V", "Platinum IV"]]);
  assert.equal(rankResultModel(r).after.eloToPromotion, 5);
  assert.equal(rankResultModel(r).nextRank, "Platinum III");
});
test("a two-division jump can cross a tier boundary", () => {
  const r = receipt(1495, "won");
  assert.deepEqual(labels(r), [
    ["Silver I", "Gold V"],
    ["Gold V", "Gold IV"],
  ]);
});
test("demotion crosses the actual floor, protected loss has no ceremony", () => {
  assert.deepEqual(labels(receipt(1500, "lost")), [["Gold V", "Silver I"]]);
  assert.deepEqual(labels(receipt(1505, "lost")), []);
  assert.equal(rankResultModel(receipt(1505, "lost")).demotionProtected, true);
});
test("debt, first division, top rank and historical v1 are handled without false transitions", () => {
  assert.deepEqual(labels(receipt(-1000, "won")), []);
  assert.deepEqual(labels(receipt(-5, "won")), [["Copper V", "Copper IV"]]);
  assert.deepEqual(labels(receipt(3295, "won")), [["Diamond I", "Omniscient"]]);
  assert.deepEqual(labels(receipt(10000, "won")), []);
  assert.deepEqual(
    labels({
      policyVersion: 1,
      outcome: "won",
      ratingBefore: 1090,
      ratingAfter: 1102,
      ratingDelta: 12,
    }),
    [],
  );
});
test("every legal v4 rating near all division boundaries produces exactly its crossed steps", () => {
  for (let before = -200; before <= 10000; before++)
    for (const outcome of ["won", "lost"]) {
      const r = receipt(before, outcome);
      const expected = [];
      const sign = Math.sign(r.ratingAfter - before);
      let last = displayRank(before, 4).label;
      for (
        let rating = before + sign;
        sign !== 0 && (sign > 0 ? rating <= r.ratingAfter : rating >= r.ratingAfter);
        rating += sign
      ) {
        const next = displayRank(rating, 4).label;
        if (next !== last) {
          expected.push([last, next]);
          last = next;
        }
      }
      const steps = rankTransitionSteps(r);
      assert.deepEqual(labels(r), expected);
      if (steps.length) {
        assert.equal(steps[0].fromRating, before);
        assert.equal(steps.at(-1).toRating, r.ratingAfter);
        assert.ok(
          steps.every((s) => s.direction === (sign > 0 ? "promotion" : "demotion")),
        );
      }
    }
});
test("ceremony uses Elo completion, cancellable per-step timers, reduced motion, and non-animated final values", () => {
  const ui = readFileSync("components/ranked/ranked-match-rating.tsx", "utf8");
  const elo = readFileSync("components/ranked/ranked-elo-reveal.tsx", "utf8");
  const css = readFileSync("styles/ranked-result-reveal.css", "utf8");
  assert.match(ui, /onSettled=\{onEloSettled\}/);
  assert.match(elo, /if \(frame.done\) onSettled\?\.\(\)/);
  assert.match(ui, /key=\{phase\}/);
  assert.match(ui, /clearTimeout\(timer\)/);
  assert.match(ui, /prefers-reduced-motion: reduce/);
  assert.match(ui, /data-rank-phase="settled"/);
  assert.match(ui, /model\.after\.eloToPromotion/);
  assert.match(css, new RegExp(`rank-division-rise ${RANK_PROMOTION_STEP_MS}ms`));
  assert.match(css, new RegExp(`rank-division-fall ${RANK_DEMOTION_STEP_MS}ms`));
  assert.match(css, /prefers-reduced-motion: reduce/);
});
