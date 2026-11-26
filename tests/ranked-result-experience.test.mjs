import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  buildRankedResult,
  formatRankedShareText,
} from "../lib/ranked/result-summary.ts";

const dialog = readFileSync("components/ranked/ranked-result-dialog.tsx", "utf8");
const css = readFileSync("styles/ranked-results.css", "utf8");
const motion = readFileSync("styles/practice-result-motion.css", "utf8");
const appStyles = readFileSync("app/globals.css", "utf8");

const confirmed = {
  matchId: "df74c5a3-e836-4a59-b95d-1b60f8c22834",
  status: "won",
  rows: 16,
  columns: 16,
  mineCount: 40,
  moveCount: 28,
  flagCount: 10,
  durationMs: 65501,
};

test("Ranked victory reuses the Practice trophy, ring, glint and burst", () => {
  assert.match(dialog, /practice-result-win/);
  for (const piece of [
    "practice-record-burst",
    "practice-victory-burst",
    "practice-win-ring",
    "practice-win-trophy",
    "practice-win-glint",
  ]) {
    assert.ok(dialog.includes(piece), `missing win animation: ${piece}`);
  }
  assert.match(dialog, /\{won && \(/);
  assert.match(css, /\.ranked-result-confetti/);
});

test("Ranked loss reuses the Practice mine-fuse explosion effects", () => {
  assert.match(dialog, /practice-result-loss/);
  for (const piece of [
    "practice-loss-logo",
    "practice-loss-fuse",
    "practice-loss-spark",
    "practice-loss-flash",
    "practice-loss-smoke",
  ]) {
    assert.ok(dialog.includes(piece), `missing mine animation: ${piece}`);
    assert.ok(motion.includes(`.${piece}`), `missing effect CSS: ${piece}`);
  }
});

test("shared motion styles are loaded and respect reduced-motion settings", () => {
  assert.match(appStyles, /practice-result-motion\.css/);
  assert.match(appStyles, /practice-results\.css/);
  assert.match(motion, /prefers-reduced-motion: reduce/);
  assert.match(motion, /\.practice-loss-flash/);
  assert.match(css, /\.ranked-result-content\s*\{\s*isolation: isolate/);
});

test("copy/share results include only server-confirmed statistics", () => {
  const result = buildRankedResult(confirmed, null);
  assert.ok(result);
  assert.equal(
    formatRankedShareText(result),
    "MindSweeper Ranked — Victory\n16 × 16 board · 40 mines\nTime: 01:05.50\nMoves: 28\nFlags on board: 10\nServer-confirmed Ranked match result",
  );
  const loss = buildRankedResult(
    { ...confirmed, status: "lost", durationMs: undefined },
    null,
  );
  assert.ok(loss);
  assert.match(formatRankedShareText(loss), /Game over/);
  assert.match(formatRankedShareText(loss), /Time: —/);
  assert.doesNotMatch(formatRankedShareText(result), /XP|RP|Elo|rating/i);
  assert.doesNotMatch(dialog, /\+125 XP|\+10 XP|\+\d+ RP/);
});

test("native share has a clipboard fallback and no unsupported reward claims", () => {
  assert.match(dialog, /navigator\.share/);
  assert.match(dialog, /navigator\.clipboard\.writeText/);
  assert.match(dialog, /onClick=\{\(\) => void shareResult\(\)\}/);
  assert.match(dialog, /onClick=\{\(\) => void copyResult\(\)\}/);
  assert.match(dialog, /onClose=\{onDismiss\}/);
  assert.match(dialog, /onPlayAgain/);
  assert.match(dialog, /role="status"/);
});
