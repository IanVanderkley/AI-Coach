import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { TOOLTIP_DELAY_MS, tooltipPosition } from "../lib/ui/tooltip-position.ts";
const read = (p) => readFileSync(p, "utf8");

test("tooltips use a 200ms delay and prefer placement above the anchor", () => {
  assert.equal(TOOLTIP_DELAY_MS, 200);
  assert.deepEqual(
    tooltipPosition(
      { left: 100, right: 140, top: 100, bottom: 140 },
      { width: 100, height: 30 },
      { width: 400, height: 300 },
    ),
    { left: 70, top: 62 },
  );
});
test("tooltip positions clamp at left, right and top viewport edges", () => {
  const size = { width: 120, height: 40 };
  const viewport = { width: 320, height: 240 };
  assert.deepEqual(
    tooltipPosition({ left: 0, right: 20, top: 4, bottom: 24 }, size, viewport),
    { left: 8, top: 32 },
  );
  assert.deepEqual(
    tooltipPosition({ left: 300, right: 320, top: 200, bottom: 220 }, size, viewport),
    { left: 192, top: 152 },
  );
});
test("tooltip uses opted-in data attributes and dismisses without modifying gameplay", () => {
  const source = read("components/ui/site-tooltip.tsx");
  const replay = read("components/coach/verified-replay-panel.tsx");
  assert.match(source, /setTimeout\(renderTip, TOOLTIP_DELAY_MS\)/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /event\.pointerType === "touch"/);
  assert.match(source, /removeEventListener\("pointerover"/);
  assert.match(source, /aria-describedby/);
  assert.match(replay, /data-tip=\{\s*tooltips\s*\?/);
  assert.match(replay, /data-tip=\{tip\(/);
  assert.doesNotMatch(read("styles/coaching-teaching.css"), /transition-delay:\s*1\.2s/);
  assert.match(read("components/play/nav-player-level.tsx"), /data-tip=\{description\}/);
});
test("dashboard actions align without forcing collapsed cards to stretch", () => {
  const css = read("styles/ui-consistency.css");
  assert.match(
    read("components/profile/player-mode-card.tsx"),
    /className="player-mode-actions"/,
  );
  assert.match(css, /\.player-dashboard-mode-grid:has\(\.player-mode-body\[hidden\]\)/);
  assert.match(css, /\.player-mode-actions\s*\{[^}]*margin-top:\s*auto/s);
  assert.match(css, /\.player-mode-body\s*\{[^}]*flex:\s*1/s);
});
test("shared style loads after responsive styles and keeps board controls scoped", () => {
  const layout = read("app/layout.tsx");
  const css = read("styles/ui-consistency.css");
  assert.ok(
    layout.indexOf("styles/ui-consistency.css") > layout.indexOf("styles/responsive.css"),
  );
  assert.match(layout, /<SiteTooltip\s*\/>/);
  assert.match(css, /\.leaderboard-page\s*>\s*\.verified-board/);
  assert.match(css, /@media\s*\(max-width:\s*600px\)/);
  assert.match(css, /overflow-x:\s*auto/);
  assert.doesNotMatch(css, /\.verified-cell\s*\{|\.cell\s*\{|\nbutton\s*\{/);
});
