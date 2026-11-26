import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = (p) => readFileSync(p, "utf8");
test("Practice dismissal preserves the completed summary and save promise; new games clear it", () => {
  const b = read("components/play/minesweeper-board.tsx");
  assert.match(b, /result=\{gameOver && resultsOpen \? resultSummary : null\}/);
  assert.match(b, /onDismiss=\{\(\) => setResultsOpen\(false\)\}/);
  assert.match(b, /resultSummary && !resultsOpen &&/);
  assert.match(b, /onClick=\{\(\) => setResultsOpen\(true\)\}/);
  assert.equal((b.match(/setResultSummary\(null\)/g) ?? []).length, 2);
  assert.equal(
    (b.match(/setResultsOpen\(false\);\s*setResultSummary\(null\)/g) ?? []).length,
    2,
  );
  assert.equal((b.match(/onGameComplete\?\.\(session\)/g) ?? []).length, 1);
  assert.match(b, /if \(reportedRef.current\) return;/);
});
test("Ranked completed board reopens its existing verified result without starting a match", () => {
  const p = read("app/ranked/page.tsx");
  assert.match(p, /buildRankedResult\(board, dismissedResultMatchId\)/);
  assert.match(
    p,
    /board.status !== "active" &&[\s\S]*?onClick=\{\(\) => setDismissedResultMatchId\(null\)\}[\s\S]*?View results/,
  );
  assert.match(p, /onClick=\{returnToLobby\}/);
  assert.match(p, /if \(board\) setDismissedResultMatchId\(board.matchId\)/);
});
test("Practice compact layout preserves XP, actions, scrolling and reduced-motion support", () => {
  const d = read("components/play/practice-result-dialog.tsx");
  const css = read("styles/practice-results.css");
  const motion = read("styles/practice-result-motion.css");
  assert.match(
    d,
    /practice-result-details[\s\S]*?<MatchXpBar[\s\S]*?practice-result-actions/,
  );
  assert.match(d, /saveResult=\{result.xpSave\}/);
  assert.match(d, /onClose=\{onDismiss\}/);
  assert.match(d, /Analyze Game/);
  assert.match(css, /overflow-y: auto/);
  assert.match(css, /width: min\(96vw, 820px\)/);
  assert.match(motion, /prefers-reduced-motion: no-preference/);
  assert.match(motion, /practice-loss-logo-recover 2800ms/);
  assert.match(
    motion,
    /@keyframes practice-loss-logo-recover[\s\S]*?100%\s*\{\s*opacity: 1/,
  );
});
