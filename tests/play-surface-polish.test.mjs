import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = (path) => readFileSync(path, "utf8");
test("Practice and Ranked share the same accessible board controls guide", () => {
  const practice = read("components/play/minesweeper-board.tsx");
  const ranked = read("app/ranked/page.tsx");
  const guide = read("components/play/board-controls-guide.tsx");
  assert.match(
    practice,
    /<BoardControlsGuide\s+mode="practice"\s+rows=\{rows\}\s+columns=\{columns\}\s+mines=\{mines\}\s*\/>/,
  );
  assert.match(
    ranked,
    /<BoardControlsGuide\s+mode="ranked"\s+rows=\{board\.rows\}\s+columns=\{board\.columns\}\s+mines=\{board\.mineCount\}\s*\/>/,
  );
  assert.match(guide, /aria-label="Board controls guide"/);
  for (const title of ["Reveal", "Flag", "Chord"])
    assert.ok(guide.includes(`<strong>${title}</strong>`));
  assert.match(guide, /!ranked && " Left \+ right click also works\."/);
  assert.match(guide, /ranked && \(/);
  assert.match(guide, /Time continues after your first reveal/);
  assert.doesNotMatch(guide, /onClick|onMouse|onKey|fetch\(|useEffect|useState/);
});
test("the new styling is scoped and loaded after existing surface styles", () => {
  const css = read("styles/play-surface-polish.css");
  const layout = read("app/layout.tsx");
  assert.ok(
    layout.indexOf('import "../styles/play-surface-polish.css"') >
      layout.indexOf('import "../styles/ranked-board-review.css"'),
  );
  assert.match(
    css,
    /\.ranked-result-dialog\s+:is\(\s*\.ranked-rating-receipt,\s*\.ranked-match-xp-receipt,\s*\.ranked-xp-panel\s*\),\s*\.practice-result-dialog\s+\.match-xp-compact\s*\{\s*background: #1d1d1d;/,
  );
  assert.match(
    css,
    /\.board-guide-grid\s*\{[\s\S]*?repeat\(auto-fit, minmax\(min\(100%, 160px\), 1fr\)\)/,
  );
  assert.match(css, /@media \(max-width: 420px\)/);
  assert.doesNotMatch(css, /\.cell\b|\.rating-gain\b|\.rating-loss\b|animation:/);
});
