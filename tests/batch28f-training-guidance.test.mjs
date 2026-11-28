import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareStarterTraining } from "../lib/coach/training-catalog.ts";
import { prepareTrainingExercise } from "../lib/coach/training-exercise.ts";
import { explainTrainingAnswer, trainingGuidance, trainingPositionLabel, formatTrainingCoordinates } from "../lib/coach/training-guidance.ts";
import { prepareReviewTraining, MAX_REVIEW_TRAINING_CHECKS, MAX_REVIEW_TRAINING_EXERCISES } from "../lib/coach/training-from-review.ts";
import { preparePracticeAnalysis } from "../lib/coach/practice-analysis.ts";
const catalog = prepareStarterTraining();
const move = (row,col,action="reveal") => ({row,col,action});
const game = {game:"minesweeper",difficulty:"Beginner",rows:2,columns:3,mineCount:2,mines:[0,2],outcome:"loss",durationSeconds:5,moves:[move(1,0),move(1,1),move(1,2),move(0,0,"flag"),move(0,0,"unflag"),move(0,0)]};
const analysis = preparePracticeAnalysis(game);
const mistake = analysis.reviewed.at(-1);
const geometry = {rows:game.rows,columns:game.columns,mineCount:game.mineCount};
const read = file => readFileSync(file,"utf8");
test("incorrect action feedback identifies the actual chosen square and its proven status", () => {
  assert.match(explainTrainingAnswer(catalog[0],{index:2}),/Row 1, column 3 is guaranteed safe/);
  assert.match(explainTrainingAnswer(catalog[1],{index:1}),/Row 1, column 2 is guaranteed to contain a mine/);
  assert.equal(explainTrainingAnswer(catalog[0],{index:0}),null);
});
test("uncertain classification explains both compatible possibilities and does not claim even odds", () => {
  const feedback=explainTrainingAnswer(catalog[5],{classification:"mine"});
  assert.match(feedback,/uncertain.*compatible mine layouts/);assert.match(feedback,/does not mean a 50\/50 chance/);assert.match(feedback,/flag.*not a proof/);
});
test("progressive rule hints highlight only revealed clues and related covered squares", () => {
  const p=catalog[0], hint=trainingGuidance(p);assert.equal(hint.index,1);assert.ok(hint.locate.length);assert.match(hint.hint1,/covered neighbours/);assert.match(hint.hint2,/1 mine among 1 unresolved square/);assert.ok(hint.steps.length);assert.match(hint.conclusion,/guaranteed to contain a mine/);
  for(const i of hint.clues)assert.equal(typeof p.exercise.cells[i],"number");for(const i of hint.related)assert.notEqual(typeof p.exercise.cells[i],"number");
});
test("alternative correct answers show their own explanation rather than the first accepted square", () => {
  const p=catalog[3];assert.equal(trainingGuidance(p).index,3);assert.equal(trainingGuidance(p,{index:5}).index,5);assert.match(trainingGuidance(p,{index:5}).conclusion,/Row 2, column 3 is guaranteed safe/);assert.equal(trainingGuidance(p,{index:4}).index,3);
});
test("missing or cyclic proof falls back to exact layout conclusion without fabricating a trace", () => {
  const p=structuredClone(catalog[0]);const square=p.squares.find(s=>s.index===1);square.proof.derivation.dependencies=[1];const h=trainingGuidance(p);assert.deepEqual(h.steps,[]);assert.match(h.conclusion,/guaranteed to contain a mine/);delete square.proof;assert.deepEqual(trainingGuidance(p).steps,[]);
});
test("exact uncertainty has no invented deductive chain or safety guarantee", () => {const h=trainingGuidance(catalog[2]);assert.equal(h.classification,"uncertain");assert.deepEqual(h.steps,[]);assert.match(h.conclusion,/both|others in which it is safe/);});
test("a real completed replay creates a fully verified puzzle from its actual pre-move position", () => {
  const [p]=prepareReviewTraining(geometry,analysis.reviewed);assert.equal(p.exercise.id,"review-move-6");assert.deepEqual(p.solution,{kind:"classify-square",classification:"mine"});assert.deepEqual(p.exercise.cells,mistake.before.map(c=>c.revealed?c.adjacentMines:c.flagged?"flagged":"covered"));assert.deepEqual(Object.keys(p.exercise).sort(),["cells","columns","difficulty","id","mineCount","objective","rows","title","version"]);
});
test("later board and hidden layout cannot affect personalized exercise output", () => {
  const frame=structuredClone(mistake);frame.after=[];frame.deductions={safe:[],mines:[]};const a=prepareReviewTraining(geometry,[mistake]), b=prepareReviewTraining({...geometry,mines:[999]},[frame]);assert.deepEqual(a,b);
});
test("incompatible claimed mistake, terminal snapshots, good moves and opening moves are skipped", () => {
  assert.deepEqual(prepareReviewTraining(geometry,[{...mistake,decision:"good"},{...mistake,actionNumber:1},{...mistake,before:mistake.after},{...mistake,mistakeType:"flagged-known-safe",move:{...mistake.move,action:"flag"}}]),[]);
});
test("review exercises remain bounded and duplicate move numbers never inflate the catalog", () => {
  const frames=Array.from({length:20},(_,i)=>({...mistake,actionNumber:i+2}));assert.equal(prepareReviewTraining(geometry,frames).length,MAX_REVIEW_TRAINING_EXERCISES);assert.equal(prepareReviewTraining(geometry,Array(20).fill(mistake)).length,1);
  const invalid={...mistake,before:[]};assert.deepEqual(prepareReviewTraining(geometry,[...Array.from({length:MAX_REVIEW_TRAINING_CHECKS},(_,i)=>({...invalid,actionNumber:i+2})),{...mistake,actionNumber:99}]),[]);
});
test("full standard Expert geometry is accepted without cropping, oversized boards still fail", () => {
  const cells=Array(480).fill("covered");cells[0]=0;const raw={version:1,id:"full-board",title:"Full board",difficulty:"advanced",rows:16,columns:30,mineCount:0,cells,objective:{kind:"reveal-safe"}};const p=prepareTrainingExercise(raw);assert.equal(p.ok,true);assert.equal(p.prepared.exercise.cells.length,480);assert.equal(p.prepared.solution.indices.length,479);assert.equal(prepareTrainingExercise({...raw,rows:17,cells:[...cells,...Array(30).fill("covered")]}).ok,false);
});
test("limited exact solver skips a review snapshot rather than assigning a guessed answer", () => {
  const cells=Array.from({length:64},(_,i)=>(Math.floor(i/8)+i%8)%2===0?1:"covered");const before=cells.map(c=>({revealed:typeof c==="number",flagged:false,exploded:false,adjacentMines:typeof c==="number"?c:null}));assert.deepEqual(prepareReviewTraining({rows:8,columns:8,mineCount:8},[{...mistake,before,move:{row:0,col:1,action:"reveal"}}]),[]);
});
test("UI includes explicit opt-in personalized training and progressively disclosed hints", () => {
  const ui=read("components/coach/training-panel.tsx"), console=read("components/coach/coach-console.tsx");assert.match(console,/<ReviewTrainingPanel analysis=\{selection.analysis\}/);assert.match(ui,/onClick=\{\(\) => setCatalog\(prepareReviewTraining/);assert.match(ui,/visibleHint >= 1/);assert.match(ui,/visibleHint >= 2/);assert.match(ui,/visibleHint >= 3/);assert.match(ui,/setHintLevel\(0\)/);assert.match(ui,/explainTrainingAnswer\(prepared, attempt.answer\)/);assert.match(ui,/data-hint=\{hint\}/);assert.match(ui,/No supported exercise could be fully verified/);
});
test("training derivation and guidance are read-only and contain no server or competitive writes", () => {
  const source=read("lib/coach/training-from-review.ts")+read("lib/coach/training-guidance.ts");assert.doesNotMatch(source,/frame\.after|\.mines\b|fetch\(|localStorage|sessionStorage|supabase|\/api\/|replayRecordedGame\(/);assert.match(source,/frame.before/);
});

test("a later exact safe proof is never used to teach a reveal as an unnecessary guess", () => {
  const p=catalog[3].exercise;const before=p.cells.map(c=>({revealed:typeof c==="number",flagged:false,exploded:false,adjacentMines:typeof c==="number"?c:null}));
  assert.deepEqual(prepareReviewTraining({rows:p.rows,columns:p.columns,mineCount:p.mineCount},[{...mistake,before,mistakeType:"unnecessary-guess",move:{row:1,col:0,action:"reveal"}}]),[]);
});


test("training coordinates use plain one-based row and column names on rectangular boards", () => {
  assert.equal(trainingPositionLabel(0,30),"row 1, column 1");
  assert.equal(trainingPositionLabel(479,30),"row 16, column 30");
  assert.equal(formatTrainingCoordinates("Clue R1C2 and R16C30 (R2C3)."),"Clue row 1, column 2 and row 16, column 30 (row 2, column 3).");
});
test("every starter hint, answer and proof explanation uses plain coordinates without changing solver evidence", () => {
  for(const p of catalog) {
    const before=structuredClone(p);
    const h=trainingGuidance(p);
    const text=[h.hint1,h.hint2,h.conclusion,...h.steps.flatMap(step=>[step.title,step.text])].join(" ");
    assert.doesNotMatch(text,/\bR\d+C\d+\b/);
    if(p.exercise.objective.kind==="classify-square") {
      for(const classification of ["safe","mine","uncertain"]) assert.doesNotMatch(explainTrainingAnswer(p,{classification}),/\bR\d+C\d+\b/);
    } else for(const square of p.squares) if(p.exercise.cells[square.index]==="covered") assert.doesNotMatch(explainTrainingAnswer(p,{index:square.index}),/\bR\d+C\d+\b/);
    assert.deepEqual(p,before);
  }
});
test("board uses one shared grid for visible numbered axes and cells without changing answer indices", () => {
  const ui=read("components/coach/training-panel.tsx"), css=read("styles/batch28f-training.css");
  assert.match(ui,/gridTemplateColumns: `32px repeat\(\$\{columns\}/);
  assert.match(ui,/length: columns.*coach-training-column-number.*\{column \+ 1\}/);
  assert.match(ui,/index % columns === 0.*coach-training-row-number.*Math.floor\(index \/ columns\) \+ 1/);
  assert.match(ui,/Column numbers are above the board. Row numbers are on the left./);
  assert.match(ui,/trainingPositionLabel\(index, columns\)/);
  assert.match(ui,/submitCell\(index, "flag"\)/);
  assert.match(css,/coach-training-board-scroll[^}]*overflow-x: auto/);
});
