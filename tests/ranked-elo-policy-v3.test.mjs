import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import {
  RANK_POLICY,
  calculateRankPolicyV2,
  calculateRankPolicyV3,
} from "../lib/leaderboard/rank-policy.ts";
import {
  parseRankedMatchRating,
  formatRatingDelta,
} from "../lib/leaderboard/match-rating.ts";
import {
  projectRankedLobbyRating,
  parseRankedLobbyRating,
  rankedLobbyModel,
} from "../lib/leaderboard/rank-lobby.ts";

const receipt = (rating, outcome, version, delta) => ({
  policyVersion: version,
  outcome,
  ratingBefore: rating,
  ratingDelta: delta,
  ratingAfter: rating + delta,
});

test("v3 clamps wins across every rating, without changing losses or historical v2 rewards", () => {
  assert.equal(RANK_POLICY.version, 3);
  assert.equal(RANK_POLICY.minimumWin, 5);
  assert.equal(RANK_POLICY.maximumWin, 100);
  for (let rating = 100; rating <= 10000; rating++) {
    const expected = 1 / (1 + 10 ** ((1700 - rating) / 1900));
    const win = calculateRankPolicyV3(rating, "won");
    const loss = calculateRankPolicyV3(rating, "lost");
    assert.equal(
      win.delta,
      Math.min(
        10000 - rating,
        Math.max(5, Math.min(100, Math.round(90 * (1 - expected)))),
      ),
    );
    assert.equal(loss.delta, -Math.min(rating - 100, Math.round(45 * expected)) || 0);
    assert.deepEqual(loss, calculateRankPolicyV2(rating, "lost"));
    assert.deepEqual(
      parseRankedMatchRating(receipt(rating, "won", 3, win.delta)),
      receipt(rating, "won", 3, win.delta),
    );
    assert.deepEqual(
      parseRankedMatchRating(receipt(rating, "lost", 3, loss.delta)),
      receipt(rating, "lost", 3, loss.delta),
    );
  }
});
test("Gold V stays +48/-21; high Elo wins earn five until the ceiling", () => {
  assert.deepEqual(calculateRankPolicyV3(1600, "won"), { rating: 1648, delta: 48 });
  assert.deepEqual(calculateRankPolicyV3(1600, "lost"), { rating: 1579, delta: -21 });
  for (const rating of [5000, 6000, 8000, 9995])
    assert.equal(calculateRankPolicyV3(rating, "won").delta, 5);
  for (const rating of [9996, 9999, 10000])
    assert.equal(calculateRankPolicyV3(rating, "won").delta, 10000 - rating);
  assert.equal(calculateRankPolicyV2(8000, "won").delta, 0);
  assert.throws(() => calculateRankPolicyV3(99, "won"));
  assert.throws(() => calculateRankPolicyV3(1600, "abandoned"));
});
test("v1 and v2 receipts remain valid and forged v3 awards are rejected", () => {
  for (const historical of [
    receipt(1000, "won", 1, 16),
    receipt(8000, "won", 2, 0),
    receipt(5000, "won", 2, 2),
  ])
    assert.deepEqual(parseRankedMatchRating(historical), historical);
  for (const invalid of [
    receipt(8000, "won", 3, 0),
    receipt(8000, "won", 2, 5),
    receipt(8000, "won", 3, 100),
    receipt(1600, "won", 3, 101),
    receipt(9999, "won", 3, 5),
    receipt(1600, "lost", 3, -20),
    receipt(1600, "won", 4, 48),
  ])
    assert.throws(() => parseRankedMatchRating(invalid));
  assert.equal(formatRatingDelta(100), "+100");
  assert.throws(() => formatRatingDelta(101));
});
test("lobby uses the active award policy and still projects saved history", () => {
  const saved = projectRankedLobbyRating(8000, 8100, 8050);
  assert.deepEqual(saved, { rating: 8000, highestRating: 8100, policyVersion: 3 });
  assert.deepEqual(parseRankedLobbyRating(saved), saved);
  assert.equal(rankedLobbyModel(saved).win, 5);
  assert.throws(() => parseRankedLobbyRating({ ...saved, policyVersion: 2 }));
});
test("v3 migration retains the reviewed award function, changes only formula and receipt version", () => {
  const dir = "supabase/migrations";
  const names = readdirSync(dir).filter((name) =>
    /^\d+_ranked_elo_policy_v3\.sql$/.test(name),
  );
  assert.equal(names.length, 1);
  assert.ok(names[0] > "20261126060617_ranked_gold_start.sql");
  const sql = readFileSync(`${dir}/${names[0]}`, "utf8");
  const old = readFileSync(
    `${dir}/20261126044000_ranked_elo_policy_v2.sql`,
    "utf8",
  ).replace(/\r\n/g, "\n");
  const get = (s) =>
    s.match(
      /create or replace function ranked_internal\.apply_verified_match_rating\(p_match_id uuid\)[\s\S]*?\n\$\$;/,
    )[0];
  assert.equal(
    get(sql)
      .replace("Policy v3", "Policy v2")
      .replace("rating_delta_v3(v_rating", "rating_delta_v2(v_rating")
      .replace("v_change, v_after, 3", "v_change, v_after, 2"),
    get(old),
  );
  assert.match(sql, /CHECK \(policy_version IN \(1, 2, 3\)\)/);
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION ranked_internal\.rating_delta_v3\(integer,text\) FROM public, anon, authenticated, service_role/,
  );
  assert.match(sql, /least\(10000 - p_rating, greatest\(5, least\(100, prior\)\)\)/);
  assert.doesNotMatch(sql, /CREATE TRIGGER|DROP TRIGGER|TRUNCATE TABLE|DROP TABLE/i);
});
