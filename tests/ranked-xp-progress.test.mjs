import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { calculateLevelProgress } from "../lib/levels/progression.ts";

const panel = readFileSync("components/ranked/ranked-xp-progress.tsx", "utf8");
const dialog = readFileSync("components/ranked/ranked-result-dialog.tsx", "utf8");
const css = readFileSync("styles/ranked-results.css", "utf8");
const repository = readFileSync("lib/levels/repository.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20261124002203_player_levels.sql",
  "utf8",
);

test("Ranked results load saved account XP, never calculate rewards from outcome", () => {
  assert.match(
    dialog,
    /<RankedXpProgress key=\{result\.matchId\} matchId=\{result\.matchId\}/,
  );
  assert.match(panel, /loadPlayerLevel\(\)/);
  assert.match(panel, /calculateLevelProgress\(account\.totalXp\)/);
  assert.doesNotMatch(panel, /insert\(|update\(|upsert\(|delete\(|\+125 XP|\+10 XP/);
  assert.doesNotMatch(dialog, /\+125 XP|\+10 XP|\+\d+ RP/);
});

test("XP lookup verifies current identity and RLS allows only owner reads", () => {
  assert.match(repository, /client\.auth\.getUser\(\)/);
  assert.match(repository, /\.from\("player_xp_profiles"\)/);
  assert.match(repository, /\.eq\("user_id", auth\.user\.id\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /using \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.match(
    migration,
    /grant select on table public\.player_xp_profiles to authenticated/,
  );
});

test("Progression thresholds remain exactly 1,000 XP per level", () => {
  assert.equal(calculateLevelProgress(0).level, 1);
  assert.equal(calculateLevelProgress(999).level, 1);
  assert.equal(calculateLevelProgress(1000).level, 2);
  assert.equal(calculateLevelProgress(2125).xpIntoLevel, 125);
});

test("Result progress loads again per match and handles errors without fake totals", () => {
  assert.match(panel, /\[matchId, revision\]/);
  assert.match(panel, /let active = true/);
  assert.match(panel, /if \(!active\) return/);
  assert.match(panel, /kind: "unavailable"/);
  assert.match(panel, /kind: "guest"/);
  assert.match(panel, /Retry saved XP/);
  assert.match(dialog, /saved lifetime total/);
  assert.doesNotMatch(panel, /setItem\(|localStorage|sessionStorage/);
});

test("XP progress is accessible and respects reduced motion", () => {
  assert.match(panel, /role="progressbar"/);
  assert.match(panel, /aria-valuenow=\{progress\.xpIntoLevel\}/);
  assert.match(panel, /role="status"/);
  assert.match(css, /AI_COACH_RANKED_ACCOUNT_XP_V1/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
