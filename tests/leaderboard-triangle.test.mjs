import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = (p) => readFileSync(p, "utf8");
const page = read("app/leaderboard/page.tsx");
const board = read("components/leaderboard/verified-leaderboard.tsx");
const css = read("styles/leaderboard-podium.css");
test("leaderboard uses a single difficulty heading, no redundant verification or decorative hero icon, and visible privacy controls", () => {
  assert.match(page, /Intermediate Ranked Leaderboard<span/);
  assert.doesNotMatch(
    page,
    /className="leaderboard-subtitle"|<Trophy|leaderboard-hero-icon/,
  );
  assert.doesNotMatch(board, /Server-verified results|<p>16 × 16 · 40 mines<\/p>/);
  assert.match(page, /Anonymous mode hides your name and results/);
  assert.match(page, /href="\/settings"/);
  assert.match(
    css,
    /\.leaderboard-page \.leaderboard-bottom-link\s*\{[^}]*text-align: left/,
  );
});
test("podium is first above second and third without creating fictional places", () => {
  assert.match(board, /standings\[tab\]\.slice\(0, 3\)/);
  assert.match(board, /leaders\.map/);
  assert.match(css, /\[data-place="1"\]\s*\{[^}]*grid-column: 1 \/ -1;[^}]*grid-row: 1/);
  assert.match(css, /\[data-place="2"\]\s*\{[^}]*grid-column: 1;\s*grid-row: 2/);
  assert.match(css, /\[data-place="3"\]\s*\{[^}]*grid-column: 2;\s*grid-row: 2/);
  assert.match(css, /@media \(max-width: 390px\)[\s\S]*?grid-row: auto/);
  assert.doesNotMatch(board, /\.sort\(|\.filter\(/);
});
