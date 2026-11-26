import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import {
  RANK_POLICY,
  competitiveRank,
  calculateRankPolicyV2,
} from "../lib/leaderboard/rank-policy.ts";

const read = (path) => readFileSync(path, "utf8");

test("new Ranked profiles start at Gold V without changing historical rewards", () => {
  assert.equal(RANK_POLICY.starting, 1600);
  assert.equal(competitiveRank(RANK_POLICY.starting).label, "Gold V");
  assert.deepEqual(calculateRankPolicyV2(1600, "won"), { rating: 1648, delta: 48 });
  assert.deepEqual(calculateRankPolicyV2(1600, "lost"), { rating: 1579, delta: -21 });
  assert.deepEqual(calculateRankPolicyV2(1000, "lost"), { rating: 987, delta: -13 });
  const names = readdirSync("supabase/migrations").filter((name) =>
    /^\d+_ranked_gold_start\.sql$/.test(name),
  );
  assert.equal(names.length, 1);
  assert.ok(names[0] > "20261126044000_ranked_elo_policy_v2.sql");
  const sql = read(`supabase/migrations/${names[0]}`);
  assert.match(sql, /ALTER COLUMN rating SET DEFAULT 1600/);
  assert.doesNotMatch(sql, /\b(?:UPDATE|DELETE|INSERT|TRUNCATE|DROP)\b/i);
  const fixture = read("tests/sql/ranked-elo-policy-v2.sql");
  assert.match(fixture, /New confirmed account did not start at Gold V/);
  assert.match(fixture, /rating_before=1600 AND rating_delta=48 AND rating_after=1648/);
  assert.match(fixture, /rating_before=1000 AND rating_delta=-16 AND rating_after=984/);
});

test("local development uses existing fail-closed local launcher, not hosted env", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["dev:local"], "node scripts/run-local.mjs --dev");
  assert.equal(pkg.scripts.dev, "next dev");
  const launcher = read("scripts/run-local.mjs");
  assert.match(launcher, /http:\/\/127\.0\.0\.1:54321/);
  assert.match(launcher, /fields\.get\("API_URL"\) !== localUrl/);
  assert.match(launcher, /COACH_PAID_AI_ENABLED: "false"/);
  assert.match(launcher, /ACCOUNT_DELETION_ENABLED: "false"/);
  assert.match(launcher, /NEXT_PUBLIC_SUPABASE_URL: localUrl/);
  assert.match(launcher, /Local privileged API check failed/);
});
