import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { prepareSquareAnalysis, explainSquare } from "../lib/coach/square-analysis.ts";
import { buildVisualLesson } from "../lib/coach/visual-deduction.ts";
const hidden = (flagged = false) => ({ revealed: false, flagged, adjacentMines: null, exploded: false });
const clue = n => ({ ...hidden(), revealed: true, adjacentMines: n });
const inspect = (board, rows, columns, count, index) => explainSquare(prepareSquareAnalysis(board, rows, columns, count), index);
const pattern = () => [clue(1),clue(2),clue(1),hidden(),hidden(),hidden()];

test("subset lesson progressively shows A, B and then the exact result", () => {
  const analysis = inspect(pattern(),2,3,2,3);
  const visual = analysis.explanation.steps.at(-1).visual;
  const lesson = buildVisualLesson(analysis,3);
  assert.equal(lesson.phases.length,3);
  const [a,b,final] = lesson.phases;
  for (const i of visual.groups[0].cells) assert.equal(a.marks.get(i),"group-a");
  for (const i of visual.result) {
    assert.equal(a.marks.has(i),false);
    assert.equal(b.marks.get(i),"extra");
    assert.equal(final.marks.get(i),"mine");
  }
  assert.match(final.equation,/2 − 1 = 1 mine/);
});
test("safe conclusion only marks the solver's actual result", () => {
  const result = inspect(pattern(),2,3,2,4);
  const lesson = buildVisualLesson(result,4);
  const final = lesson.phases.at(-1);
  assert.equal(final.marks.get(4),"safe");
  assert.deepEqual([...final.marks].filter(([,role])=>role==="safe").map(([i])=>i),result.explanation.steps.at(-1).visual.result);
  assert.ok(lesson.phases.slice(0,-1).every(p=>![...p.marks.values()].includes("safe")));
});
test("single-clue zero has two steps and no fake mine marks", () => {
  const result=inspect([clue(0),hidden(true),hidden(),hidden(),hidden(),hidden()],2,3,1,1);
  const lesson=buildVisualLesson(result,1);
  assert.equal(lesson.phases.length,2);
  assert.equal(lesson.phases[0].marks.get(1),"group-a");
  assert.equal(lesson.phases[1].marks.get(1),"safe");
  assert.ok(![...lesson.phases[1].marks.values()].includes("known-mine"));
});
test("direct mine conclusion marks only proven results", () => {
  const result=inspect([clue(1),hidden(),clue(1),clue(1)],2,2,1,1);
  const lesson=buildVisualLesson(result,1);
  assert.equal(lesson.phases.at(-1).marks.get(1),"mine");
  assert.match(lesson.phases.at(-1).text,/Your square is a mine/);
});
test("earlier proven mines are visually distinct from final results", () => {
  const result=inspect([clue(1),hidden(),hidden(),clue(1),clue(1),clue(1)],2,3,1,2);
  const lesson=buildVisualLesson(result,2);
  assert.ok(lesson.prerequisiteCount>0);
  assert.equal(lesson.phases[0].marks.get(1),"known-mine");
  assert.equal(lesson.phases.at(-1).marks.get(2),"safe");
});
test("unresolved flags and revealed squares have no guided proof", () => {
  const board=[clue(1),hidden(true),hidden(),hidden()];
  for (const i of [0,1,2,3]) assert.equal(buildVisualLesson(inspect(board,2,2,1,i),i),null);
});
test("terminal exposed mines have no guided proof", () => {
  const board=[clue(1),{...hidden(),revealed:true,exploded:true},hidden(),hidden()];
  assert.equal(buildVisualLesson(inspect(board,2,2,1,2),2),null);
});
test("a global proof expands the crop rather than silently hiding evidence", () => {
  const board=Array.from({length:30},()=>hidden());
  board[0]=clue(1); board[10]=clue(1); board[11]=clue(1);
  const result=inspect(board,3,10,1,29);
  const lesson=buildVisualLesson(result,29);
  assert.ok(lesson);
  assert.equal(lesson.bounds.left,0); assert.equal(lesson.bounds.right,9);
  for (const phase of lesson.phases) for (const i of phase.marks.keys()) {
    assert.ok(i%10>=lesson.bounds.left && i%10<=lesson.bounds.right);
    assert.ok(Math.floor(i/10)>=lesson.bounds.top && Math.floor(i/10)<=lesson.bounds.bottom);
  }
  assert.match(lesson.phases[0].text,/total mine count/);
});
for (const [rows,columns] of [[9,9],[16,16],[16,30]]) test(`guided evidence stays in bounds and does not mutate ${rows}x${columns} snapshot`,()=>{
  const board=Array.from({length:rows*columns},()=>hidden()); board[0]=clue(0);
  const snapshot=JSON.stringify(board);
  const result=inspect(board,rows,columns,10,1);
  const proof=JSON.stringify(result);
  const lesson=buildVisualLesson(result,1);
  assert.ok(lesson.bounds.left>=0 && lesson.bounds.right<columns && lesson.bounds.top>=0 && lesson.bounds.bottom<rows);
  assert.equal(JSON.stringify(board),snapshot); assert.equal(JSON.stringify(result),proof);
});
test("a mismatch in the recorded conclusion is not presented as a guided lesson",()=>{
  const result=inspect(pattern(),2,3,2,3);
  const altered=structuredClone(result);
  altered.explanation.steps.at(-1).visual.mineCount=0;
  assert.equal(buildVisualLesson(altered,3),null);
});
test("panel preserves real glyphs, synchronized local step marks, accessible controls and full proof",()=>{
  const ui=readFileSync(new URL("../components/coach/square-analysis-panel.tsx",import.meta.url),"utf8");
  assert.match(ui,/replayCellGlyph\(cell\)/);
  assert.match(ui,/data-lesson-role=\{mark\}/);
  assert.match(ui,/guided=\{\{ phase, bounds: lesson\.bounds \}\}/);
  assert.match(ui,/aria-live="polite"/);
  assert.match(ui,/Restart lesson/);
  assert.match(ui,/TeachingProof explanation=\{explanation\} expanded=\{false\}/);
  assert.doesNotMatch(ui,/current\.after|game\.mines|hiddenMines/);
});
