import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = p => readFileSync(p, "utf8");
test("Practice result simplifies the header and retains its result controls", () => {
  const page = read("components/play/practice-result-dialog.tsx");
  assert.doesNotMatch(page, /PRACTICE COMPLETE|A mine ended this run/);
  assert.match(page, /\{result\.difficulty\} · Practice/);
  for (const action of ["Play Again", "Analyze Game", "Share result", "Copy result", "View board"]) assert.ok(page.includes(action));
  assert.match(page, /<MatchXpBar/);
  assert.match(page, /onClose=\{onDismiss\}/);
  assert.match(page, /className="sr-only" role="status"/);
  assert.match(page, /<summary>About this result<\/summary>/);
});
test("XP amount is displayed only from a matching receipt; missing XP is not zero", () => {
  const xp = read("components/play/match-xp-bar.tsx");
  assert.match(xp, /saved\.outcome === expectedOutcome/);
  assert.match(xp, /saved\.difficulty === expectedDifficulty/);
  assert.match(xp, /\{receipt && \(\s*<strong[\s\S]*?\+\{receipt\.amount\.toLocaleString\(\)\} XP/);
  assert.match(xp, /state\.kind === "ready" && !receipt/);
  assert.match(xp, /No saved Practice XP receipt/);
  assert.doesNotMatch(xp, /XP details|XP requirements not met|Daily XP limit reached|This game did not qualify|Practice XP counts toward/);
});
test("minimal styling loads after ceremony and remains Practice-only", () => {
  const layout = read("app/layout.tsx");
  assert.ok(layout.indexOf('import "../styles/practice-result-minimal.css";') > layout.indexOf('import "../styles/result-ceremony.css";'));
  const css = read("styles/practice-result-minimal.css");
  assert.match(css, /width: min\(94vw, 500px\)/);
  assert.doesNotMatch(css, /\.ranked-result-dialog|\.cell\b|pointer-events\s*:/);
  assert.match(css, /prefers-reduced-motion: no-preference/);
  assert.match(css, /:focus-visible/);
});
