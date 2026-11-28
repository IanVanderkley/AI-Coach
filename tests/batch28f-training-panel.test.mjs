import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareStarterTraining, newTrainingSession, trainingCellAnswer, updateTrainingSession } from "../lib/coach/training-catalog.ts";
import { assessTrainingAnswer } from "../lib/coach/training-exercise.ts";
const catalog = prepareStarterTraining();
const run = (s, action) => updateTrainingSession(s, catalog, action);
const answer = (s, a) => run(s, { kind: "answer", answer: a });
const next = s => run(s, { kind: "next" });
const read = file => readFileSync(file, "utf8");
test("starter catalog contains six uniquely identified, exactly verified exercises", () => {
  assert.ok(catalog); assert.equal(catalog.length, 6); assert.equal(new Set(catalog.map(p=>p.exercise.id)).size, 6);
  assert.deepEqual(catalog.map(p=>p.exercise.objective.kind), ["flag-mine","reveal-safe","classify-square","reveal-safe","classify-square","classify-square"]);
  assert.deepEqual(catalog.map(p=>p.solution), [{kind:"select-square",indices:[1]},{kind:"select-square",indices:[2]},{kind:"classify-square",classification:"uncertain"},{kind:"select-square",indices:[3,5]},{kind:"classify-square",classification:"mine"},{kind:"classify-square",classification:"uncertain"}]);
  for (const p of catalog) { assert.ok(BigInt(p.totalLayouts)>0n); assert.ok(!("mines" in p.exercise)); }
});
test("all valid alternative safe squares are accepted and other squares rejected", () => {
  const p = catalog[3]; for (const index of [3,5]) assert.equal(assessTrainingAnswer(p,{index}).status,"correct"); assert.equal(assessTrainingAnswer(p,{index:4}).status,"incorrect");
});
test("existing flagged target remains uncertain, not a proven mine", () => {
  const p=catalog[5]; assert.equal(p.exercise.cells[1],"flagged"); assert.equal(assessTrainingAnswer(p,{classification:"mine"}).status,"incorrect"); assert.equal(assessTrainingAnswer(p,{classification:"uncertain"}).status,"correct");
});
test("session records one valid attempt and freezes further answers until retry", () => {
  const start=newTrainingSession(), wrong=answer(start,{index:2}); assert.equal(wrong.attempt.status,"incorrect"); assert.equal(answer(wrong,{index:1}),wrong);
  const retry=run(wrong,{kind:"retry"}); assert.equal(retry.attempt,null); const correct=answer(retry,{index:1}); assert.equal(correct.attempt.status,"correct"); assert.equal(answer(correct,{index:2}),correct); assert.equal(start.attempt,null);
});
test("invalid and mismatched answers do not count as attempts", () => {
  const s=newTrainingSession(); for(const a of [{index:0},{index:999},{classification:"mine"},{index:1,correct:true}]) assert.equal(answer(s,a),s); const c=next(next(s)); assert.equal(answer(c,{index:1}),c); assert.equal(answer(c,{classification:"uncertain"}).attempt.status,"correct");
});
test("navigation resets feedback and remains bounded at both ends", () => {
  const start=newTrainingSession(); assert.equal(run(start,{kind:"previous"}),start); const first=answer(start,{index:1}), second=next(first); assert.deepEqual(second,{position:1,attempt:null}); assert.deepEqual(run(answer(second,{index:2}),{kind:"previous"}),start); let s=start; for(let i=1;i<catalog.length;i++) s=next(s); assert.equal(s.position,5); assert.equal(next(s),s);
});
test("catalog preparation and session changes do not mutate exercise snapshots", () => {
  const before=structuredClone(catalog); const a={index:1}; const s=answer(newTrainingSession(),a); a.index=2; assert.equal(s.attempt.answer.index,1); assert.deepEqual(catalog,before); assert.deepEqual(prepareStarterTraining(),before);
});
test("training is a separate collapsed history-screen panel with lazy initialization", () => {
  const ui=read("components/coach/training-panel.tsx"), console=read("components/coach/coach-console.tsx"); assert.match(ui,/const \[expanded, setExpanded\] = useState\(false\)/); assert.match(ui,/hidden=\{!expanded\}\>\{started && <TrainingWorkspace \/>\}/); assert.match(ui,/useState\(prepareAdaptiveTraining\)/); assert.ok(console.indexOf("<PersonalizedCoaching")<console.indexOf("<TrainingPanel />")); assert.ok(console.indexOf("<TrainingPanel />")<console.indexOf('className="coach-practice-card"'));
});
test("board and classification controls are native keyboard controls with textual feedback", () => {
  const ui=read("components/coach/training-panel.tsx"); assert.match(ui,/target === null && cell === "covered"/); assert.match(ui,/type="button" className="coach-training-cell"/); assert.match(ui,/aria-label=\{`\$\{label\}/); assert.match(ui,/data-target=\{target === index/); assert.match(ui,/aria-pressed=\{selectedClass === choice\}/); assert.match(ui,/aria-disabled=\{attempt !== null\}/); assert.match(ui,/role="status" aria-atomic="true"/); assert.match(ui,/Correct!/); assert.match(ui,/Not quite\./); assert.match(ui,/updateTrainingSession\(current, catalog, action\)/);
});
test("training has scoped responsive styling and no gameplay or account side effects", () => {
  const ui=read("components/coach/training-panel.tsx"), core=read("lib/coach/training-catalog.ts"), css=read("styles/batch28f-training.css"); assert.match(read("app/coaching/page.tsx"),/batch28f-training\.css/); assert.match(css,/aspect-ratio: 1/); assert.match(css,/focus-visible/); assert.match(css,/@media \(max-width: 600px\)/); assert.match(css,/min-height: 44px/); assert.doesNotMatch(ui+core,/fetch\(|sessionStorage|supabase|\/api\/|replayRecordedGame\(/); assert.match(ui,/Personalized review attempts are temporary and are not saved/); assert.match(ui,/General exercise history stays on this browser, not your account/);
});

test("desktop reveal and flag actions match the requested exercise", () => {
  const flag = catalog[0].exercise.objective, reveal = catalog[1].exercise.objective;
  assert.deepEqual(trainingCellAnswer(flag,1,"flag"),{index:1}); assert.equal(trainingCellAnswer(flag,1,"reveal"),null);
  assert.deepEqual(trainingCellAnswer(reveal,2,"reveal"),{index:2}); assert.equal(trainingCellAnswer(reveal,2,"flag"),null);
});
test("touch and keyboard activation support either action without changing classification", () => {
  for (const p of catalog) {
    const objective = p.exercise.objective;
    if (objective.kind === "classify-square") for (const input of ["activate","flag","reveal"]) assert.equal(trainingCellAnswer(objective,1,input),null);
    else assert.deepEqual(trainingCellAnswer(objective,1,"activate"),{index:1});
  }
});
test("mouse action routing preserves exact grading and attempt freeze", () => {
  const s = newTrainingSession(), objective = catalog[0].exercise.objective;
  assert.equal(trainingCellAnswer(objective,1,"reveal"),null);
  const incorrect = answer(s,trainingCellAnswer(objective,2,"flag")); assert.equal(incorrect.attempt.status,"incorrect");
  assert.equal(answer(incorrect,trainingCellAnswer(objective,1,"flag")),incorrect);
  assert.equal(answer(run(incorrect,{kind:"retry"}),trainingCellAnswer(objective,1,"flag")).attempt.status,"correct");
  const reveal=next(s); assert.equal(answer(reveal,trainingCellAnswer(catalog[1].exercise.objective,2,"reveal")).attempt.status,"correct");
});
test("cell input cannot turn invalid or revealed positions into valid answers", () => {
  const objective=catalog[0].exercise.objective;
  for (const index of [-1,1.5,NaN]) assert.equal(trainingCellAnswer(objective,index,"flag"),null);
  const s=newTrainingSession(); for (const index of [0,999]) assert.equal(answer(s,trainingCellAnswer(objective,index,"flag")),s);
});
test("board uses primary click and scoped context-menu flagging, retaining native activation", () => {
  const ui=read("components/coach/training-panel.tsx");
  assert.match(ui,/onContextMenu=\{event => \{\s*event\.preventDefault\(\);[\s\S]*?submitCell\(index, "flag"\)/);
  assert.match(ui,/event\.button === 0\) submitCell\(index, activate \? "activate" : "reveal"\)/);
  assert.match(ui,/event\.detail === 0/); assert.match(ui,/event\.pointerType === "touch"/); assert.match(ui,/onPointerCancel/);
  assert.match(ui,/Right-click/); assert.match(ui,/Left-click/); assert.match(ui,/Enter or Space/);
  assert.match(ui,/objective\.kind === "flag-mine" \? "⚑" : "✓"/);
});


test("training card matches the shared Coaching card surface and spacing", () => {
  const css=read("styles/batch28f-training.css");
  const card=css.match(/\.coach-full-page \.coach-history-screen > \.coach-training-panel\s*\{([^}]+)\}/)?.[1];
  assert.ok(card); for(const rule of ["margin: 0", "padding: clamp(16px, 2vw, 24px)", "border-radius: 12px", "background: var(--surface)", "border: 1px solid var(--line, #444)"]) assert.ok(card.includes(rule),rule);
  assert.doesNotMatch(css,/\.coach-training-panel\s*\{\s*padding: 14px/);
});
test("training header uses matching typography and the existing accessible toggle", () => {
  const css=read("styles/batch28f-training.css"), ui=read("components/coach/training-panel.tsx");
  const heading=css.match(/\.coach-full-page \.coach-training-panel > h2\s*\{([^}]+)\}/)?.[1];
  assert.ok(heading); for(const rule of ["font-size: 1.25rem", "line-height: 1.35", "margin: 0 0 8px"]) assert.ok(heading.includes(rule),rule);
  assert.match(ui,/<h2 id="coach-training-title"><button type="button" className="profile-history-toggle" aria-expanded=\{expanded\} aria-controls="coach-training-body"/);
  assert.match(ui,/profile-history-chevron is-collapsed/);
});
