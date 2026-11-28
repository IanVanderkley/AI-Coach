import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { reviewOwnerTransition } from '../lib/coach/review-owner.ts';
import { prepareAdaptiveTraining } from '../lib/coach/training-catalog.ts';
import { prepareTrainingExercise, assessTrainingAnswer } from '../lib/coach/training-exercise.ts';
import { calculateComponentProbabilities } from '../lib/coach/component-probabilities.ts';
import { answerVerifiedFollowUp, guidedFollowUpQuestions } from '../lib/coach/verified-follow-up.ts';
import { resolveThreadQuestion } from '../lib/coach/follow-up-thread.ts';
const source = path => readFileSync(path,'utf8');
const catalog = prepareAdaptiveTraining();
const moment = {id:'move-4',moveNumber:3,kind:'mistake',occurrences:1,category:'Unnecessary guess',action:'reveal',location:'row 1, column 2',finding:'A safe alternative was available.',evidence:'The clue proves a safe square.',nextTime:'Reveal the safe square first.'};
const report = {moments:[moment]};
test('initial session does not interrupt the first authorized deep link',()=>{
  for(const id of [null,'owner-a']) assert.deepEqual(reviewOwnerTransition(undefined,'INITIAL_SESSION',id),{owner:id,reset:false});
});
test('same-user sign in, token refresh and metadata update preserve active review',()=>{
  for(const event of ['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED','INITIAL_SESSION']) assert.deepEqual(reviewOwnerTransition('owner-a',event,'owner-a'),{owner:'owner-a',reset:false});
});
test('owner replacement, sign out and guest sign in invalidate account-derived state',()=>{
  for(const event of ['SIGNED_IN','TOKEN_REFRESHED','INITIAL_SESSION']) assert.deepEqual(reviewOwnerTransition('owner-a',event,'owner-b'),{owner:'owner-b',reset:true});
  assert.deepEqual(reviewOwnerTransition('owner-a','SIGNED_OUT',null),{owner:null,reset:true});
  assert.deepEqual(reviewOwnerTransition(null,'SIGNED_IN','owner-b'),{owner:'owner-b',reset:true});
});
test('account transition clears visible review data and invalidates outstanding review requests synchronously',()=>{
  const ui=source('components/coach/coach-console.tsx');
  const change=ui.slice(ui.indexOf('client.auth.onAuthStateChange'),ui.indexOf('return () => subscription.unsubscribe()'));
  assert.match(change,/reviewOwnerTransition\(owner.current, event, session\?\.user.id \?\? null\)/);
  assert.match(change,/if \(!transition.reset\) return;\s*\/\/[^\n]*\n\s*const revision = \+\+historyEpoch.current;/);
  for(const clear of ['setGames([])','setScores({})','setReviewed({})','setUnavailableGrades({})','setRankedReviewedGrades({})','setPreferences(null)','setSelection(null)','setReplayFocus(null)','setResult(null)','++request.current','++demoRequest.current','setHistoryRevision(revision)']) assert.ok(change.includes(clear),clear);
  assert.match(ui,/className="coach-ranked-history" key=\{historyRevision\}/);
});
test('history and preference responses from a replaced owner cannot be displayed, and old deep links do not reopen on refresh',()=>{
  const ui=source('components/coach/coach-console.tsx');
  assert.match(ui,/const isCurrent = \(\) => active && historyEpoch.current === historyRevision;/);
  assert.match(ui,/new URLSearchParams\(historyRevision === 0 \? window.location.search : ""\)/);
  assert.match(ui,/\.then\(\(recent\) => \{\s*if \(!isCurrent\(\)\) return;\s*setGames\(recent\)/);
  assert.match(ui,/if \(isCurrent\(\)\) setPreferences\(value\)/);
  assert.match(ui,/if \(isCurrent\(\)\) setHistoryLoading\(false\)/);
  assert.match(ui,/const isCurrent = \(\) => !cancelled && historyEpoch.current === historyRevision;/);
  assert.match(ui,/await repository.loadReview\(item.id\);\s*if \(!isCurrent\(\)\) return;/);
});
test('probability and hypothetical questions cannot masquerade as a verified explanation',()=>{
  for(const q of ['Explain the probabilities of this move.','Why did the probability change?','Explain my chances.','Predicting the outcome: why was this good?','Could I have won?']){
    assert.equal(answerVerifiedFollowUp(report,moment.id,q).supported,false,q);
    assert.equal(resolveThreadQuestion(report,moment.id,q).supported,false,q);
  }
  for(const q of guidedFollowUpQuestions(moment)) assert.equal(resolveThreadQuestion(report,moment.id,q).supported,true,q);
  assert.match(resolveThreadQuestion(report,moment.id,'What were the probabilities?').message,/inspect the replay/);
});
// Independent full-board brute-force oracle. No production constraint builder,
// probability implementation or solver-derived solution index is reused.
function oracle(exercise){
  const {rows,columns,mineCount,cells}=exercise,n=cells.length;
  const covered=cells.flatMap((v,i)=>typeof v==='number'?[]:[i]);
  const clues=cells.flatMap((v,i)=>typeof v==='number'?[i]:[]);
  const hits=Array(n).fill(0);let total=0;
  const adjacent=(a,b)=>a!==b&&Math.abs(Math.floor(a/columns)-Math.floor(b/columns))<=1&&Math.abs(a%columns-b%columns)<=1;
  function visit(start,mines){
    if(mines.length===mineCount){
      if(!clues.every(i=>mines.filter(j=>adjacent(i,j)).length===cells[i]))return;
      total++;for(const i of mines)hits[i]++;return;
    }
    for(let i=start;i<=covered.length-(mineCount-mines.length);i++)visit(i+1,[...mines,covered[i]]);
  }
  assert.equal(rows*columns,n);visit(0,[]);assert.ok(total>0);return {total,hits,covered};
}
test('independent exhaustive oracle verifies every covered square in all nine training exercises',t=>{
  assert.equal(catalog.length,9);let checked=0,layouts=0;
  for(const p of catalog){
    const {total,hits,covered}=oracle(p.exercise);layouts+=total;
    assert.equal(p.totalLayouts,String(total));
    assert.deepEqual(p.squares.map(s=>s.index).sort((a,b)=>a-b),covered);
    for(const square of p.squares){
      checked++;assert.equal(square.mineLayouts,String(hits[square.index]));
      assert.equal(square.classification,hits[square.index]===0?'safe':hits[square.index]===total?'mine':'uncertain');
    }
    const objective=p.exercise.objective;
    if(objective.kind==='classify-square'){
      for(const value of ['safe','mine','uncertain'])assert.equal(assessTrainingAnswer(p,{classification:value}).status,value===(hits[objective.index]===0?'safe':hits[objective.index]===total?'mine':'uncertain')?'correct':'incorrect');
    }else{
      for(const index of covered.filter(i=>p.exercise.cells[i]==='covered'))assert.equal(assessTrainingAnswer(p,{index}).status,(objective.kind==='reveal-safe'?hits[index]===0:hits[index]===total)?'correct':'incorrect');
    }
  }
  t.diagnostic(`${checked} covered squares across ${catalog.length} puzzles; ${layouts} compatible layouts`);
});
test('adding flags cannot alter exact square classifications or compatible layout counts',()=>{
  for(const p of catalog){
    const cells=p.exercise.cells.map(cell=>typeof cell==='number'?cell:'flagged');
    const index=p.squares[0].index;
    const result=prepareTrainingExercise({...p.exercise,cells,objective:{kind:'classify-square',index}});
    assert.equal(result.ok,true);assert.equal(result.prepared.totalLayouts,p.totalLayouts);
    assert.deepEqual(result.prepared.squares.map(s=>[s.index,s.classification,s.mineLayouts]),p.squares.map(s=>[s.index,s.classification,s.mineLayouts]));
  }
});
test('solver work-limit failures disclose no partial probabilities',()=>{
  const p=catalog[6],{rows,columns,mineCount,cells}=p.exercise;
  const board=cells.map(c=>({revealed:typeof c==='number',flagged:c==='flagged',adjacentMines:typeof c==='number'?c:null,exploded:false}));
  for(const limits of [{maxNodes:1},{maxCombineWork:1},{maxComponent:0}]){
    const r=calculateComponentProbabilities(rows,columns,mineCount,board,limits);assert.equal(r.status,'limited');assert.deepEqual(r.squares,[]);assert.equal('totalLayouts' in r,false);
  }
});
test('training and conversations remain local, with conditional thread persistence',()=>{
  for(const path of ['components/coach/training-panel.tsx','components/coach/verified-follow-up.tsx'])assert.doesNotMatch(source(path),/fetch\(|\/api\/|supabase/);
  assert.match(source('components/coach/training-panel.tsx'),/catalog.length \? <TrainingBoardWorkspace catalog=\{catalog\} \/>/);
  assert.match(source('components/coach/verified-follow-up.tsx'),/if \(persist\)\s*window.sessionStorage.setItem/);
  // The exact caller is checked in the full repository; the isolated fixture
  // contains only these two component modules, so this test checks their boundary.
});
test('saved coaching reports authorize every read/write and use owner scope before history limits',()=>{
  const api=source('app/api/coach/reports/route.ts');
  assert.match(api,/client.auth.getClaims\(\)/);assert.match(api,/ranked_session_is_active/);assert.match(api,/if \(active !== true\) return null/);
  const get=api.slice(api.indexOf('export async function GET'),api.indexOf('export async function POST'));
  const post=api.slice(api.indexOf('export async function POST'),api.indexOf('export async function DELETE'));
  const del=api.slice(api.indexOf('export async function DELETE'));
  for(const body of [get,post,del])assert.match(body,/const auth = await authorize\(\)/);
  assert.match(get,/\.eq\("user_id", userId\)[\s\S]*?\.limit\(100\)/);
  assert.match(post,/readCompletedRankedRecording\([\s\S]*?userId,/);
  assert.match(post,/readPracticeReview\(admin, userId, input.gameRef\)/);
  assert.match(del,/\.delete\(\)\s*\.eq\("user_id", userId\)/);
  assert.match(api,/"Cache-Control": "private, no-store"/);
});
