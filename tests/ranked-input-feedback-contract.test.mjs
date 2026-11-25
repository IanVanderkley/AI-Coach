import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync("app/ranked/page.tsx", "utf8");
const css = readFileSync("styles/ranked-input-feedback.css", "utf8");

test("Ranked input feedback is scoped to Ranked board and per-cell actions", () => {
  assert.match(source, /AI_COACH_RANKED_INPUT_FEEDBACK_V1/);
  assert.match(source, /ranked-server-board/);
  assert.match(source, /aria-busy=\{isPending \|\| isQueued\}/);
  assert.match(css, /\.ranked-server-board \.cell\.ranked-input-pending/);
});

test("reveal, flag and chord clear visual feedback after their requests", () => {
  for (const action of ["reveal", "flag", "chord"]) {
    assert.match(
      source,
      new RegExp('setPendingCell\\(\\{ row, column, action: "' + action + '" \}\\)'),
    );
  }
  assert.equal((source.match(/setPendingCell\(null\);/g) ?? []).length, 3);
  assert.equal((source.match(/moveInFlight\.current = true;/g) ?? []).length, 3);
  assert.equal((source.match(/moveInFlight\.current = false;/g) ?? []).length, 3);
});

test("flags are shown optimistically, but stored board flags remain server-confirmed", () => {
  assert.match(source, /isVisuallyFlagged\s*=\s*isPending/);
  assert.match(source, /\? !isFlagged/);
  assert.match(source, /\{isVisuallyFlagged \? \(/);
  assert.match(source, /flaggedCells: result\.flagged/);
});

test("pending styling respects reduced motion", () => {
  assert.match(css, /prefers-reduced-motion: reduce/);
});
