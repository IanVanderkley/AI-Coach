import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { blocksRankedFlagPlacement, isRankedFlagLimitReached } from "../lib/ranked/flag-limit.ts";

const flags = Array.from({ length: 40 }, (_, i) => ({ row: Math.floor(i / 16), column: i % 16 }));
const full = { status: "active", flagCount: 40, mineCount: 40, flaggedCells: flags };

test("the 40th flag is allowed but a new flag at the cap is blocked", () => {
  assert.equal(blocksRankedFlagPlacement({ ...full, flagCount: 39, flaggedCells: flags.slice(0, 39) }, 2, 7), false);
  assert.equal(isRankedFlagLimitReached(full), true);
  assert.equal(blocksRankedFlagPlacement(full, 15, 15), true);
});
test("existing flags can always be removed at the cap and the warning clears after unflagging", () => {
  for (const { row, column } of flags) assert.equal(blocksRankedFlagPlacement(full, row, column), false);
  const after = { ...full, flagCount: 39, flaggedCells: flags.slice(1) };
  assert.equal(isRankedFlagLimitReached(after), false);
  assert.equal(blocksRankedFlagPlacement(after, 15, 15), false);
  for (const status of ["won", "lost"]) assert.equal(isRankedFlagLimitReached({ ...full, status }), false);
});
test("the immediate and queued dispatch path blocks excess flags before pending revision or RPC, with recovery unchanged", () => {
  const source = readFileSync("app/ranked/page.tsx", "utf8");
  const toggle = source.split("async function toggleFlag(")[1].split("async function chordCell(")[0];
  const guard = toggle.indexOf("if (blocksRankedFlagPlacement(board, row, column)) return;");
  assert.ok(guard >= 0 && guard < toggle.indexOf("moveInFlight.current = true;"));
  assert.ok(guard < toggle.indexOf("sentRevisionRef.current ="));
  assert.ok(guard < toggle.indexOf('fetch("/api/ranked/matches/flag"'));
  assert.match(toggle, /const recovered = await loadBoard\(\);/);
  assert.match(source, /if \(intent.action === "flag"\) void toggleFlag\(intent.row, intent.column\)/);
  assert.match(source, /if \(next\) dispatchIntent\(next\)/);
});
test("flag-cap feedback is visible in the existing live status and does not depend on hidden board information", () => {
  const source = readFileSync("app/ranked/page.tsx", "utf8");
  assert.match(source, /aria-live="polite">\s*\{isRankedFlagLimitReached\(board\)/);
  assert.match(source, /Flag limit reached\. Remove a flag to place another\./);
  assert.match(source, /<dt>Flags remaining<\/dt>/);
  assert.doesNotMatch(readFileSync("lib/ranked/flag-limit.ts", "utf8"), /minePositions|mine_positions|fetch\(/);
});
