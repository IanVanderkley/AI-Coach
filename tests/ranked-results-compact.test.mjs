import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = (p) => readFileSync(p, "utf8");
test("results group verified Elo and XP before the action row", () => {
  const d = read("components/ranked/ranked-result-dialog.tsx");
  const i = [
    "ranked-result-header",
    "ranked-result-stats",
    "ranked-result-rewards",
    "<RankedMatchRating",
    "ranked-result-xp",
    "<RankedMatchXpReceipt",
    "<RankedXpProgress",
    "ranked-result-actions",
    "ranked-result-utilities",
  ].map((x) => d.indexOf(x));
  assert.ok(i.every((n, j) => n >= 0 && (j === 0 || n > i[j - 1])));
  assert.match(d, /onClose=\{onDismiss\}/);
  assert.match(d, /expectedOutcome=\{result.outcome\}/);
  assert.match(d, /onClick=\{onReturnLobby\}/);
});
test("compact layout allows scrolling, with responsive columns and longer opt-in motion", () => {
  const css = read("styles/ranked-results.css");
  assert.match(css, /overflow-y: auto/);
  assert.match(css, /width: min\(96vw, 940px\)/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(css, /ranked-loss-logo-recover 2800ms/);
  assert.match(css, /ranked-promotion-ceremony 2400ms/);
  assert.match(css, /@keyframes ranked-loss-logo-recover[\s\S]*?100%\s*\{\s*opacity: 1/);
});
