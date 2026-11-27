import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { eloRevealFrame, ELO_REVEAL_MS } from "../lib/leaderboard/elo-reveal.ts";
const read = p => readFileSync(p, "utf8");
test("Elo count is monotonic, bounded, and ends exactly on verified values", () => {
  for (const [before, after] of [[1380,1370],[1400,1390],[1490,1610],[0,-10],[9990,10000],[-20,-30],[1500,1500]]) {
    let previous = before;
    for (let t=0; t<=ELO_REVEAL_MS; t+=10) {
      const frame=eloRevealFrame(before,after,t);
      assert.ok(frame.rating >= Math.min(before,after) && frame.rating <= Math.max(before,after));
      assert.ok(after >= before ? frame.rating >= previous : frame.rating <= previous);
      previous=frame.rating;
    }
    assert.deepEqual(eloRevealFrame(before,after,ELO_REVEAL_MS), {rating:after,done:true});
    assert.deepEqual(eloRevealFrame(before,after,ELO_REVEAL_MS+500), {rating:after,done:true});
  }
});
test("reveal uses only receipt values, cancels frames and honors reduced motion", () => {
  const ui=read("components/ranked/ranked-match-rating.tsx");
  const animation=read("components/ranked/ranked-elo-reveal.tsx");
  assert.match(ui,/before=\{value.ratingBefore\}/);
  assert.match(ui,/after=\{value.ratingAfter\}/);
  assert.match(ui,/deltaLabel=\{formatRatingDelta\(value.ratingDelta, value.policyVersion\)\}/);
  assert.match(animation,/cancelAnimationFrame/);
  assert.match(animation,/prefers-reduced-motion: reduce/);
  assert.match(animation,/aria-hidden="true"/);
  assert.match(animation,/role="status"/);
  assert.match(animation,/data-settled=\{frame.done\}/);
});
test("new navigation and full width XP stay Ranked-only, with no educational links", () => {
  const d=read("components/ranked/ranked-result-dialog.tsx");
  const r=read("components/ranked/ranked-match-rating.tsx");
  const css=read("styles/ranked-result-reveal.css");
  assert.doesNotMatch(r,/How Elo works|href="\/leaderboard"/);
  assert.match(d,/ranked-result-navigation[\s\S]*?onClick=\{onReturnLobby\}[\s\S]*?onClick=\{onDismiss\}/);
  assert.match(d,/aria-label="View profile"/);
  assert.match(css,/ranked-xp-progress-track \{ grid-column: 1 \/ -1/);
  assert.match(css,/data-settled="true"/);
  assert.doesNotMatch(css,/\.practice-result-dialog|\.cell/);
  assert.match(r,/value\.finalGuessCompensated &&/);
  assert.match(r,/model\.demotionProtected &&/);
  assert.match(r,/Retry/);
});
