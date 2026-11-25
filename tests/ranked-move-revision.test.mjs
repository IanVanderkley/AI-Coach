import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { isRankedMoveRevision } from "../lib/ranked/move-revision.ts";

const read = (path) => readFileSync(path, "utf8");
const migrations = readdirSync("supabase/migrations").filter((name) =>
  /^\d+_ranked_move_revisions\.sql$/.test(name),
);
assert.equal(migrations.length, 1);
const sql = read(`supabase/migrations/${migrations[0]}`);

test("board revision accepts only nonnegative PostgreSQL integer values", () => {
  for (const value of [0, 1, 2147483647]) assert.equal(isRankedMoveRevision(value), true);
  for (const value of [
    undefined,
    null,
    "0",
    -1,
    0.5,
    NaN,
    Infinity,
    2147483648,
    {},
    true,
  ]) {
    assert.equal(isRankedMoveRevision(value), false);
  }
});

test("every revision overload locks the owner-scoped active match before delegating", () => {
  for (const fn of [
    "reveal_first_ranked_cell",
    "reveal_ranked_cell",
    "toggle_ranked_flag",
    "chord_ranked_cell",
  ]) {
    const body = sql.split(`CREATE FUNCTION public.${fn}(`)[1].split("$function$;")[0];
    assert.match(body, /SECURITY INVOKER/);
    assert.match(body, /SET search_path = ''/);
    assert.match(
      body,
      /WHERE id = p_match_id AND user_id = p_user_id AND status = 'active'/,
    );
    assert.ok(
      body.indexOf("FOR UPDATE") <
        body.indexOf("v_move_count IS DISTINCT FROM p_expected_move_count"),
    );
    assert.ok(body.indexOf("ERRCODE = 'PT409'") < body.indexOf(`RETURN public.${fn}(`));
    assert.match(body, /p_expected_move_count IS NULL/);
    const signature = `public.${fn}(uuid, uuid, integer, integer, integer)`;
    assert.ok(
      sql.includes(
        `REVOKE ALL ON FUNCTION ${signature}\n  FROM PUBLIC, anon, authenticated, service_role;`,
      ),
    );
    assert.ok(sql.includes(`GRANT EXECUTE ON FUNCTION ${signature}\n  TO service_role;`));
  }
});

test("all move routes require a revision and keep the authenticated rate limiter", () => {
  for (const action of ["reveal", "flag", "chord"]) {
    const route = read(`app/api/ranked/matches/${action}/route.ts`);
    const validation = route.indexOf("if (!isRankedMoveRevision(expectedMoveCount))");
    const rateLimit = route.indexOf(
      'guardRankedRateLimit(admin, verifiedUserId, "move")',
    );
    assert.ok(validation > route.indexOf("status: 401"));
    assert.ok(rateLimit > validation);
    assert.ok(route.indexOf("p_expected_move_count: expectedMoveCount") > rateLimit);
    assert.match(route, /\.code === "PT409"/);
  }
});

test("Ranked client sends the observed revision and recovers instead of replaying failed moves", () => {
  const page = read("app/ranked/page.tsx");
  assert.equal((page.match(/expectedMoveCount: board\.moveCount/g) ?? []).length, 3);
  assert.equal((page.match(/moveCount !== board\.moveCount \+ 1/g) ?? []).length, 3);
  assert.equal((page.match(/const recovered = await loadBoard\(\);/g) ?? []).length, 3);
  assert.match(page, /Refresh Ranked board/);
  assert.match(page, /catch \{\s+setBoard\(null\);\s+setNoMatch\(false\);/);
});

test("recovery holds a shared match lock before reading visible board state", () => {
  const fn = sql.split("CREATE OR REPLACE FUNCTION public.get_ranked_visible_board(")[1];
  assert.match(fn, /AND user_id = p_user_id\s+AND status = 'active'\s+FOR SHARE;/);
  assert.ok(fn.indexOf("FOR SHARE") < fn.indexOf("FROM public.ranked_match_state"));
});
