import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const dir = "supabase/migrations";
const names = readdirSync(dir).filter((name) =>
  /^\d+_ranked_elo_policy_v2\.sql$/.test(name),
);
assert.equal(names.length, 1);
const sql = readFileSync(`${dir}/${names[0]}`, "utf8");
const original = readFileSync(
  `${dir}/20261124072607_ranked_elo_visibility.sql`,
  "utf8",
).replace(/\r\n/g, "\n");

test("v2 migration retains the original award function security and receipt logic", () => {
  const oldFunction = original.match(
    /create function ranked_internal\.apply_verified_match_rating\(p_match_id uuid\)[\s\S]*?\n\$\$;/,
  )[0];
  const newFunction = sql.match(
    /create or replace function ranked_internal\.apply_verified_match_rating\(p_match_id uuid\)[\s\S]*?\n\$\$;/,
  )[0];
  const normalize = (fn) =>
    fn
      .replace("create or replace function", "create function")
      .replace("  v_expected numeric;\n", "")
      .replace(
        /  -- Fixed 1000-point benchmark[\s\S]*?  v_change := v_after - v_rating;/,
        "CALC",
      )
      .replace(/  -- Policy v2 applies[\s\S]*?  v_after := v_rating \+ v_change;/, "CALC")
      .replace("rating_after, policy_version", "rating_after")
      .replace("v_change, v_after, 2", "v_change, v_after");
  assert.equal(normalize(newFunction), normalize(oldFunction));
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION ranked_internal\.rating_delta_v2\(integer,text\) FROM public, anon, authenticated, service_role/,
  );
});

test("v2 migration tags receipts and does not replay historical matches", () => {
  assert.match(sql, /ADD COLUMN policy_version smallint NOT NULL DEFAULT 1/);
  assert.match(sql, /v_change, v_after, 2/);
  assert.match(sql, /pg_catalog\.to_regprocedure/);
  assert.doesNotMatch(sql, /create trigger|drop trigger|drop table|truncate table/i);
  assert.match(sql, /1700 - p_rating/);
  assert.match(sql, /1900::numeric/);
  assert.match(sql, /90::numeric/);
  assert.match(sql, /45::numeric/);
});
