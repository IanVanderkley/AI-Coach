import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareAdaptiveTraining,prepareStarterTraining,newTrainingSession,updateTrainingSession} from '../lib/coach/training-catalog.ts';
import {trainingGuidance} from '../lib/coach/training-guidance.ts';
import {parseTrainingHistory,appendTrainingAttempt,readTrainingHistory,writeTrainingHistory,trainingProgress,recommendTraining,TRAINING_PROGRESS_KEY,TRAINING_HISTORY_LIMIT} from '../lib/coach/training-progress.ts';
const catalog=prepareAdaptiveTraining();
const ids=catalog.map(p=>p.exercise.id);
const entry=(index,correct=true,hints=0)=>({id:ids[index],correct,hints});
const payload=history=>({version:1,history});
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),values};};
test('adaptive catalog adds three independently verified multi-clue positions with varied classifications',()=>{
  assert.equal(catalog.length,9);assert.equal(new Set(ids).size,9);assert.deepEqual(catalog.slice(0,6),prepareStarterTraining());
  assert.deepEqual(catalog.slice(6).map(p=>p.solution.classification),['safe','mine','uncertain']);
  assert.ok(catalog[6].squares.find(s=>s.index===4).proof.derivation.dependencies.length>=2);
  assert.ok(catalog[7].squares.find(s=>s.index===7).proof.derivation.dependencies.length>=2);
  for(const p of catalog.slice(6)){assert.ok(BigInt(p.totalLayouts)>0n);assert.equal(p.exercise.difficulty,'advanced');assert.doesNotMatch(JSON.stringify(trainingGuidance(p)),/\bR\d+C\d+\b/);}
});
test('fresh history recommends a beginner exercise; manual difficulty jumps are bounded',()=>{
  assert.equal(recommendTraining(catalog,[]).position,0);const start=newTrainingSession();
  assert.deepEqual(updateTrainingSession(start,catalog,{kind:'jump',position:6}),{position:6,attempt:null});
  for(const position of [-1,9,1.5,NaN])assert.equal(updateTrainingSession(start,catalog,{kind:'jump',position}),start);
  assert.equal(updateTrainingSession(start,catalog,{kind:'jump',position:0}),start);
});
test('repeating one correct puzzle never promotes difficulty',()=>{
  const history=Array(20).fill(entry(0));assert.equal(trainingProgress(history).solved,1);assert.equal(recommendTraining(catalog,history).difficulty,'beginner');assert.equal(recommendTraining(catalog,history).position,1);
});
test('distinct correct answers with no displayed hints advance recommendations across levels',()=>{
  const h=[entry(0),entry(1)];assert.equal(recommendTraining(catalog,h).difficulty,'intermediate');assert.equal(recommendTraining(catalog,[...h,entry(3),entry(4)]).difficulty,'advanced');
});
test('missed puzzle is revisited and latest incorrect answers override earlier successes',()=>{
  const h=[entry(0),entry(1),entry(2,false)];assert.equal(recommendTraining(catalog,h).position,2);assert.equal(recommendTraining(catalog,[...h,entry(2,true,2)]).difficulty,'intermediate');
  assert.equal(recommendTraining(catalog,[entry(0),entry(1),entry(0,false)]).position,0);
});
test('hint-assisted answers are distinct from unassisted answers and full level completion advances',()=>{
  const h=[entry(0,true,2),entry(1,true,3)];assert.equal(recommendTraining(catalog,h).position,2);assert.equal(recommendTraining(catalog,[...h,entry(2,true,1)]).difficulty,'intermediate');assert.equal(trainingProgress(h).assisted,2);
});
test('progress counts correct retries separately from unique puzzles and does not mutate input',()=>{
  const h=[entry(0,false),entry(0,true,1),entry(1,true)];const before=structuredClone(h);assert.deepEqual(trainingProgress(h),{attempts:3,correct:2,assisted:1,solved:2});recommendTraining(catalog,h);assert.deepEqual(h,before);
});
test('browser history survives a round trip, stores only generic IDs, result and hint level',()=>{
  const s=storage(),h=[entry(0),entry(1,false,2)];assert.equal(writeTrainingHistory(s,h,ids),true);assert.deepEqual(readTrainingHistory(s,ids),{history:h,available:true});assert.deepEqual(JSON.parse(s.values.get(TRAINING_PROGRESS_KEY)),payload(h));assert.equal(writeTrainingHistory(s,[],ids),true);assert.deepEqual(readTrainingHistory(s,ids).history,[]);
});
test('unknown, personalized, malformed, oversized and extra fields fail closed',()=>{
  for(const bad of [{...entry(0),id:'review-move-6'},{...entry(0),accountId:'private'},{...entry(0),board:[]},{...entry(0),hints:4},{...entry(0),hints:1.2},{...entry(0),correct:'yes'},null])assert.equal(parseTrainingHistory(payload([bad]),ids),null);
  assert.equal(parseTrainingHistory({version:99,history:[]},ids),null);assert.equal(parseTrainingHistory(payload(Array(61).fill(entry(0))),ids),null);
  assert.equal(writeTrainingHistory(storage(),[{...entry(0),id:'review-move-6'}],ids),false);
});
test('bounded history retains the latest 60 entries and rejects an unrecognized new entry',()=>{
  const h=Array(TRAINING_HISTORY_LIMIT).fill(entry(0));const next=appendTrainingAttempt(h,entry(8),ids);assert.equal(next.length,60);assert.deepEqual(next.at(-1),entry(8));assert.deepEqual(appendTrainingAttempt(next,{...entry(8),id:'foreign'},ids),next);assert.deepEqual(h.at(-1),entry(0));
});
test('blocked storage and malformed JSON never crash training',()=>{
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};assert.deepEqual(readTrainingHistory(blocked,ids),{history:[],available:false});assert.equal(writeTrainingHistory(blocked,[],ids),false);
  const s=storage();for(const bad of ['broken','x'.repeat(12001),JSON.stringify({version:2,history:[]})]){s.setItem(TRAINING_PROGRESS_KEY,bad);assert.deepEqual(readTrainingHistory(s,ids),{history:[],available:true});}
});
test('only accepted answers are recorded; personalized workspace has no persistence callbacks',()=>{
  const ui=readFileSync('components/coach/training-panel.tsx','utf8');assert.match(ui,/if \(next === current\) return;/);assert.match(ui,/if \(action.kind === "answer" && next.attempt\)/);assert.match(ui,/current.attempt\?\.status === "correct".*hintRef.current = 3/);assert.match(ui,/onAttempt=\{recordAttempt\}/);assert.match(ui,/catalog.length \? <TrainingBoardWorkspace catalog=\{catalog\} \/>/);assert.match(ui,/Shared by anyone using this browser/);assert.match(ui,/Personalized review attempts are temporary and are not saved/);assert.doesNotMatch(ui,/fetch\(|\/api\/|supabase|sessionStorage/);
});
test('history reset requires explicit confirmation and layout preserves numbered axes and controls',()=>{
  const ui=readFileSync('components/coach/training-panel.tsx','utf8'),css=readFileSync('styles/batch28f-training.css','utf8');assert.match(ui,/confirmReset \?/);assert.match(ui,/setConfirmReset\(true\)/);assert.match(ui,/onReset\?\.\(\)/);assert.match(ui,/Choose difficulty/);assert.match(ui,/coach-training-column-number/);assert.match(ui,/coach-training-row-number/);assert.match(css,/coach-training-progress-grid.*auto-fit/);assert.match(css,/coach-training-progress :focus-visible/);
});
