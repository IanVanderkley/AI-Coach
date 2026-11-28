import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { finalGuessCompensation } from "../lib/leaderboard/final-guess-compensation.ts";
import { parseRankedMatchRating } from "../lib/leaderboard/match-rating.ts";
import { rankResultModel } from "../lib/leaderboard/rank-result.ts";
import {
  ACTIVE_RANK_POLICY_VERSION,
  RANKED_WRITE_CONTRACT_VERSION,
} from "../lib/leaderboard/active-rank-policy.ts";
const receipt = (rating, delta = finalGuessCompensation(rating)) => ({
  outcome: "lost",
  policyVersion: 4,
  ratingBefore: rating,
  ratingDelta: delta,
  ratingAfter: rating + delta,
  finalGuessCompensated: true,
});
test("final 50/50 awards half the nominal win reward, rounded up and capped", () => {
  for (const [r, d] of [
    [-2147483648, 80],
    [499, 80],
    [500, 70],
    [1000, 60],
    [1500, 55],
    [2000, 50],
    [2500, 43],
    [3000, 35],
    [3300, 25],
    [9999, 1],
    [10000, 0],
  ]) {
    assert.equal(finalGuessCompensation(r), d);
    assert.deepEqual(parseRankedMatchRating(receipt(r)), receipt(r));
  }
  for (let r = -2000; r <= 10000; r++)
    assert.deepEqual(parseRankedMatchRating(receipt(r)), receipt(r));
});
test("positive losses require an explicit v4 marker and exact award", () => {
  const good = receipt(1500);
  for (const invalid of [
    { ...good, finalGuessCompensated: undefined },
    { ...good, finalGuessCompensated: false },
    { ...good, finalGuessCompensated: "true" },
    { ...good, outcome: "won" },
    { ...good, policyVersion: 3 },
    receipt(1500, 54),
    receipt(1500, -12),
    receipt(10000, 1),
  ])
    assert.throws(() => parseRankedMatchRating(invalid));
});
test("compensated losses promote normally without a demotion-protected label", () => {
  const model = rankResultModel(parseRankedMatchRating(receipt(1490)));
  assert.equal(model.transition, "promotion");
  assert.equal(model.after.label, "Gold V");
  assert.equal(
    rankResultModel(parseRankedMatchRating(receipt(1505))).demotionProtected,
    false,
  );
});
test("read scale stays v4 while write contract requires final-guess-aware server", () => {
  assert.equal(ACTIVE_RANK_POLICY_VERSION, 4);
  assert.equal(RANKED_WRITE_CONTRACT_VERSION, 5);
  const read = (p) => readFileSync(p, "utf8");
  assert.match(read("lib/supabase/admin.ts"), /String\(RANKED_WRITE_CONTRACT_VERSION\)/);
  const route = read("app/api/leaderboard/match-rating/route.ts");
  assert.match(route, /final_guess_compensated/);
  assert.match(route, /\.eq\("user_id", user.id\)/);
  assert.match(route, /private, no-store/);
  assert.match(
    read("components/ranked/ranked-match-rating.tsx"),
    /Verified final 50\/50/,
  );
});
test("migration retains verified win and award idempotency, moves loss to terminal move insertion", () => {
  const dir = "supabase/migrations";
  const names = readdirSync(dir).filter((n) =>
    /^\d+_ranked_final_guess_settlement\.sql$/.test(n),
  );
  assert.equal(names.length, 1);
  const sql = readFileSync(`${dir}/${names[0]}`, "utf8");
  assert.match(sql, /AFTER INSERT ON public.ranked_match_moves/);
  assert.match(sql, /NEW.status = 'won'/);
  assert.match(sql, /m.status = 'lost' AND m.move_count = NEW.move_number/);
  assert.match(sql, /m.move_number = v_match.move_count[\s\S]*?m.action = 'reveal'/);
  assert.match(sql, /ranked_internal.prove_final_guess_loss_v1/);
  assert.match(sql, /on conflict \(match_id\) do nothing returning match_id/);
  assert.match(sql, /for update;/);
  assert.match(sql, /required_policy_version = 5 WHERE singleton/);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE TABLE|DELETE FROM/i);
});
