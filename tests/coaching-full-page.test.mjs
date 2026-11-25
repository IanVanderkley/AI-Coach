import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const ui = read("components/coach/coach-console.tsx");
const css = read("styles/coaching-lessons.css");
test("coaching history and report are exclusive full-width views without legacy sidebar classes", () => {
  assert.match(ui, /className="coach-visual-layout coach-full-page"/);
  assert.doesNotMatch(ui, /className="coach-layout\b|className="coach-controls"/);
  assert.match(ui, /\{!reviewing\s*\?\s*\(/);
  assert.match(ui, /className="coach-history-screen"/);
  assert.match(ui, /\)\s*:\s*\(\s*<section[^>]*className="coach-selected-review"/);
  assert.match(css, /\.coach-visual-layout\.coach-full-page\s*\{[^}]*display:\s*block/);
  assert.match(
    css,
    /\.coach-history-list\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  );
});
test("history uses one row per retained game and shows calculated review scores", () => {
  assert.match(ui, /games\.map\(\(game\)\s*=>/);
  assert.match(ui, /className="coach-history-row"/);
  assert.match(ui, /score\?\.grade\s*\?/);
  assert.match(ui, /data-grade=\{score\.grade\}/);
  assert.match(ui, /onClick=\{\(\) => void openGame\(game\.id\)\}/);
  assert.match(ui, /repository\s*\.\s*listReviewSummaries\(\)/);
  assert.match(ui, /repository\.loadReview\(id\)/);
});
test("return to history cancels outstanding reviews and clears deep link while retaining visit scores", () => {
  const back = ui.slice(
    ui.indexOf("function backToGames()"),
    ui.indexOf("const chooseReplayMove"),
  );
  assert.match(back, /\+\+request\.current/);
  assert.match(back, /\+\+demoRequest\.current/);
  assert.match(back, /setSelection\(null\)/);
  assert.match(back, /setPendingId\(null\)/);
  assert.match(back, /searchParams\.delete\("gameId"\)/);
  assert.match(back, /searchParams\.delete\("reviewId"\)/);
  assert.doesNotMatch(back, /setScores\(/);
  assert.match(ui, /onClick=\{backToGames\}/);
  assert.ok(ui.indexOf("<ReviewOverview") < ui.indexOf("<VerifiedReplayPanel"));
  assert.ok(ui.indexOf("<VerifiedReplayPanel") < ui.indexOf("<EvidenceCoachPanel"));
});
