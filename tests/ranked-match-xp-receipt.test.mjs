import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const repo = readFileSync("lib/levels/repository.ts", "utf8");
const component = readFileSync("components/ranked/ranked-match-xp-receipt.tsx", "utf8");
const dialog = readFileSync("components/ranked/ranked-result-dialog.tsx", "utf8");
const css = readFileSync("styles/ranked-results.css", "utf8");

test("per-match XP is fetched from signed-in RLS-protected database rows", () => {
  assert.match(repo, /export async function loadRankedMatchXpReceipt\(/);
  assert.match(repo, /client\.auth\.getUser\(\)/);
  assert.match(repo, /\.from\("player_xp_match_receipts"\)/);
  assert.match(repo, /\.eq\("match_id", matchId\)/);
  assert.match(repo, /\.eq\("user_id", auth\.user\.id\)/);
  assert.match(repo, /\.maybeSingle\(\)/);
  assert.doesNotMatch(repo, /\.insert\(\s*\{.*amount/s);
});

test("only known exact database reward amounts are accepted", () => {
  assert.match(repo, /isRankedXpReward\(data\.outcome, data\.amount\)/);
  assert.match(repo, /return \{ state: "missing" \}/);
  assert.match(component, /result\.outcome === expectedOutcome/);
});

test("Ranked result shows receipt only after read-only lookup", () => {
  assert.match(dialog, /<RankedMatchXpReceipt/);
  assert.match(dialog, /expectedOutcome=\{result\.outcome\}/);
  assert.match(component, /state\.kind === "earned"/);
  assert.match(component, /\+\{state\.amount\.toLocaleString\(\)\} XP/);
  assert.match(component, /No saved XP receipt for this match/);
  assert.match(component, /Match XP could not be verified/);
  assert.match(component, /Retry match XP/);
  assert.match(css, /\.ranked-match-xp-receipt/);
  assert.doesNotMatch(dialog, /\+125 XP|\+10 XP|\+\d+ RP/);
});
