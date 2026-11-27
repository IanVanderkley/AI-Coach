import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { ACTIVE_RANK_POLICY_VERSION } from "../lib/leaderboard/active-rank-policy.ts";
const read = path => readFileSync(path, "utf8");
const dir = "supabase/migrations";
const names = readdirSync(dir).filter(n => /^\d+_ranked_elo_policy_v4_settlement\.sql$/.test(n));
assert.equal(names.length, 1);
const sql = read(`${dir}/${names[0]}`);
test("v4 read projections and write header use the same active version", () => {
  assert.equal(ACTIVE_RANK_POLICY_VERSION, 4);
  assert.match(read("lib/supabase/admin.ts"), /String\(RANKED_WRITE_CONTRACT_VERSION\)/);
  assert.match(read("app/api/ranked/lobby-rating/route.ts"), /ACTIVE_RANK_POLICY_VERSION,\s*\)/);
  assert.match(read("app/api/leaderboard/route.ts"), /projectPublicStandings\(elo.data, speed.data, PUBLIC_RATING_SYSTEM_V4\)/);
});
test("settlement preserves locks, idempotency and verification", () => {
  const old = read(`${dir}/20261126061918_ranked_elo_policy_v3.sql`).replace(/\r\n/g,"\n");
  const extract = s => s.match(/create or replace function ranked_internal\.apply_verified_match_rating\(p_match_id uuid\)[\s\S]*?\n\$\$;/)[0];
  assert.equal(extract(sql).replace("Policy v4","Policy v3").replace("select r.rating_delta, r.rating_after into strict v_change, v_after\n  from ranked_internal.calculate_rating_v4(v_rating, v_match.status) r;","v_change := ranked_internal.rating_delta_v3(v_rating, v_match.status);\n  v_after := v_rating + v_change;").replace("v_change, v_after, 4","v_change, v_after, 3"),extract(old));
  assert.match(sql,/IS DISTINCT FROM \$reviewed\$/);
  assert.match(sql,/CHECK \(rating <= 10000\)/);
  assert.match(sql,/ALTER COLUMN rating SET DEFAULT 1500/);
  assert.match(sql,/required_policy_version = 4 WHERE singleton/);
  assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE|DELETE FROM/i);
});
test("rating guide reflects v4 thresholds and protection", () => {
  const guide=read("app/ranked/rating-guide/page.tsx");
  assert.match(guide,/RANK_TIERS_V4/);
  assert.match(guide,/Demotion protection/);
  assert.match(guide,/1,488/);
  assert.doesNotMatch(guide,/fixed-benchmark|3,400/);
});
