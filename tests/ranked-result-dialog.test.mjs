import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildRankedResult, formatRankedDuration } from "../lib/ranked/result-summary.ts";

const active = {
  matchId: "df74c5a3-e836-4a59-b95d-1b60f8c22834",
  status: "active",
  moveCount: 4,
  flagCount: 2,
  rows: 16,
  columns: 16,
  mineCount: 40,
};

test("active and absent Ranked games cannot open the result dialog", () => {
  assert.equal(buildRankedResult(null, null), null);
  assert.equal(buildRankedResult(active, null), null);
});

test("a verified win shows server-owned time and match statistics", () => {
  assert.deepEqual(
    buildRankedResult({ ...active, status: "won", durationMs: 65501 }, null),
    {
      matchId: active.matchId,
      outcome: "won",
      moveCount: 4,
      flagCount: 2,
      rows: 16,
      columns: 16,
      mineCount: 40,
      durationMs: 65501,
    },
  );
});

test("loss is distinct and an absent duration is not invented", () => {
  const result = buildRankedResult({ ...active, status: "lost" }, null);
  assert.equal(result?.outcome, "lost");
  assert.equal(result?.durationMs, null);
});

test("dismissal applies to one match only", () => {
  const won = { ...active, status: "won", durationMs: 800 };
  assert.equal(buildRankedResult(won, active.matchId), null);
  assert.notEqual(
    buildRankedResult(
      { ...won, matchId: "12042aba-d597-4ee7-aa31-89fcff22f132" },
      active.matchId,
    ),
    null,
  );
});

test("format duration using server milliseconds without fabricating values", () => {
  assert.equal(formatRankedDuration(0), "00:00.00");
  assert.equal(formatRankedDuration(65501), "01:05.50");
  assert.equal(formatRankedDuration(null), "—");
  assert.equal(formatRankedDuration(-100), "—");
  assert.equal(formatRankedDuration(Number.NaN), "—");
});

test("the Ranked dialog uses confirmed outcomes and preserves dismiss / retry paths", () => {
  const dialog = readFileSync("components/ranked/ranked-result-dialog.tsx", "utf8");
  const page = readFileSync("app/ranked/page.tsx", "utf8");
  assert.match(dialog, /dialog\.showModal\(\)/);
  assert.match(dialog, /onClose=\{onDismiss\}/);
  assert.match(dialog, /onPlayAgain/);
  assert.match(dialog, /View finished board/);
  assert.match(page, /buildRankedResult\(board, dismissedResultMatchId\)/);
  assert.match(page, /durationMs: verifiedResult\.durationMs/);
  assert.match(page, /<RankedResultDialog/);
  assert.doesNotMatch(dialog, /\+125 XP|\+10 XP|\+\d+ RP/);
});
