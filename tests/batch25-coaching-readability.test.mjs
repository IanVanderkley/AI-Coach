import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const read = (file) => readFileSync(file, "utf8");
test("review starts with summary and collapsed replay and lessons; collapsed replay unmounts", () => {
  const ui = read("components/coach/coach-console.tsx");
  assert.match(ui, /\[replayExpanded, setReplayExpanded\] = useState\(false\)/);
  assert.match(ui, /aria-expanded=\{replayExpanded\}/);
  assert.match(ui, /hidden=\{!replayExpanded\}/);
  assert.match(ui, /\{replayExpanded && \(\s*<VerifiedReplayPanel/);
  assert.match(
    ui,
    /<details\s+className="coach-review-disclosure"\s+open=\{sections.lessons\}\s*>\s*<summary>Detailed lessons/,
  );
  assert.match(ui, /reviewTab === "coach"/);
});
test("key-move actions expand and focus the mounted replay; saved replay actions retain original IDs", () => {
  const ui = read("components/coach/coach-console.tsx");
  assert.match(ui, /setReplayFocus\(\(previous\)[\s\S]*?setReplayExpanded\(true\)/);
  assert.match(
    ui,
    /if\s*\(\s*!replayExpanded\s*\|\|\s*reviewTab !== "review"\s*\|\|\s*!replayScrollRequested.current\s*\)\s*return;[\s\S]*?getElementById\("coach-replay-workspace"\)/,
  );
  assert.match(ui, /openRankedGame\(gameRef, move, true\)/);
  assert.match(ui, /openGame\(gameRef, undefined, move, true\)/);
  assert.match(ui, /focusMoveNumber=\{replayFocus\?\.moveNumber\}/);
});
test("learning details remain discoverable without default text walls", () => {
  const ui = read("components/coach/personalized-coaching.tsx");
  assert.match(ui, /<summary>\s*Quick drill/);
  assert.match(ui, /<summary>\s*Your next three games/);
  assert.match(ui, /<summary>\s*Saved reports/);
  assert.match(ui, /data-correct=\{answer === lesson.answer\}/);
  assert.match(ui, /open=\{sections.drill\}/);
  assert.match(
    ui,
    /onReview\(\s*mode,\s*pattern.example!\.gameRef,\s*pattern.example!\.move,?\s*\)/,
  );
});
