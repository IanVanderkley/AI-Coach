import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const route = readFileSync("app/api/ranked/matches/reveal/route.ts", "utf8");
const page = readFileSync("app/ranked/page.tsx", "utf8");
const sql = readFileSync(
  "supabase/migrations/202610280001_ranked_gameplay_baseline.sql",
  "utf8",
);

test("Ranked reveal sends an optional first-move routing hint", () => {
  assert.match(page, /firstMoveDone: board\.firstMoveDone/);
  assert.match(route, /typeof firstMoveDone === "boolean"/);
  assert.match(
    route,
    /firstMoveDone !== undefined && typeof firstMoveDone !== "boolean"/,
  );
});

test("Ranked optimized reveal still uses the server-owned gameplay RPCs", () => {
  assert.match(route, /AI_COACH_RANKED_FAST_REVEAL_HINT_V1/);
  assert.match(route, /admin\.rpc\(functionName,/);
  assert.match(route, /"reveal_ranked_cell" : "reveal_first_ranked_cell"/);
  assert.match(route, /Promise\.all\(\[/); // Old clients have a validated fallback.
  assert.match(route, /supabase\.auth\.getUser\(\)/);
});

test("Both SQL reveal RPCs independently reject wrong users and invalid first-move states", () => {
  const first = sql
    .split("CREATE OR REPLACE FUNCTION public.reveal_first_ranked_cell(")[1]
    ?.split("CREATE OR REPLACE FUNCTION public.reveal_ranked_cell(")[0];
  const later = sql
    .split("CREATE OR REPLACE FUNCTION public.reveal_ranked_cell(")[1]
    ?.split("CREATE OR REPLACE FUNCTION public.toggle_ranked_flag(")[0];
  assert.ok(first && later);
  for (const fn of [first, later]) {
    assert.match(fn, /v_match\.user_id IS DISTINCT FROM p_user_id/);
    assert.match(fn, /v_match\.status <> 'active'/);
    assert.match(fn, /FOR UPDATE/);
  }
  assert.match(first, /v_state\.first_move_done THEN/);
  assert.match(later, /NOT v_state\.first_move_done/);
});
