import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(p, "utf8");
const ui = read("components/ranked/ranked-match-rating.tsx");
const page = read("app/ranked/page.tsx");
const css = read("components/ui/feedback-notice.module.css");
const shared = read("components/ui/feedback-notice.tsx");
test("special rating notices reuse shared feedback and remain driven by the verified receipt", () => {
  assert.match(ui, /\{value\.finalGuessCompensated && \(\s*<FeedbackNotice\s+tone="reward"/);
  assert.match(ui, /\{model\.demotionProtected && \(\s*<FeedbackNotice\s+tone="protection"/);
  assert.ok(ui.indexOf('tone="reward"') > ui.indexOf('ranked-rating-summary'));
  assert.ok(ui.indexOf('tone="protection"') < ui.indexOf('className="ranked-rating-transition"'));
  assert.match(ui, /formatRatingDelta\(value.ratingDelta, value.policyVersion\), label: "Elo awarded"/);
  assert.match(ui, /value.ratingAfter === 10000/);
  assert.match(ui, /still counts as a defeat/);
  assert.match(ui, /rounded up/);
  assert.match(ui, /Another ordinary loss/);
  assert.doesNotMatch(ui, /<p role="status">Verified final 50\/50/);
});
test("all feedback tones use one charcoal background and nested actions share the theme", () => {
  assert.equal((css.match(/--notice-bg:/g) ?? []).length, 1);
  assert.match(css, /--notice-bg: #202020/);
  assert.match(css, /background: var\(--notice-bg\)/);
  assert.match(css, /\.action :is\(button, a\)\[data-primary="true"\]/);
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(shared, /tone === "error" \? "alert" : "status"/);
  assert.match(shared, /\{metric.value\}/);
});
test("completed match notice prioritizes opening the saved result without changing callbacks", () => {
  const panel = page.slice(page.indexOf("{/* Display results after a win or loss. */}"));
  assert.match(panel, /title=\{board.status === "won" \? "Ranked victory" : "Game over"\}/);
  assert.match(panel, /data-primary="true"\s+onClick=\{\(\) => setDismissedResultMatchId\(null\)\}/);
  assert.match(panel, /onClick=\{returnToLobby\}/);
  assert.match(panel, /View results/);
  assert.doesNotMatch(panel, /data-primary="true"\s+onClick=\{returnToLobby\}/);
});
