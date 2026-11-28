import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLearningTrends } from '../lib/coach/learning-trends.ts';
import { PRACTICE_ANALYSIS_VERSION, preparePracticeAnalysis } from '../lib/coach/practice-analysis.ts';
import { buildSavedReview } from '../lib/coach/personalized-review.ts';
const keys = ['unnecessary-guess','revealed-known-mine','flagged-known-safe'];
function saved(id, good=4, mistakes=1, uncertain=2, extra={}) {
  return {mode:'practice',difficulty:'Intermediate',gameRef:`g${id}`,completedAt:new Date(Date.UTC(2026,0,id)).toISOString(),outcome:'loss',version:PRACTICE_ANALYSIS_VERSION,review:{score:{good,mistakes,uncertain,progress:50,score:good+mistakes?60:null},report:{provenGood:good,verifiedMistakes:mistakes,uncertainActions:uncertain,recordedActions:good+mistakes+uncertain},mistakeMoves:{[keys[0]]:Array.from({length:mistakes},(_,i)=>i+2),[keys[1]]:[],[keys[2]]:[]}},...extra};
}
const trend = (rows,mode='practice',difficulty='Intermediate',window=10)=>buildLearningTrends(rows,mode,difficulty,window);
const ten = () => Array.from({length:10},(_,i)=>saved(i+1));
const close = (a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('empty history shows no points or changes, not zero accuracy',()=>{
 const t=trend([]);assert.equal(t.totalGames,0);assert.deepEqual(t.points,[]);assert.equal(t.comparison.older.accuracy.percent,null);assert.equal(t.comparison.accuracyChange,null);assert.equal(t.comparison.reason,'too-few-games');
});
test('chronological points are deterministic and source input stays unchanged',()=>{
 const rows=ten().reverse(),copy=structuredClone(rows);const t=trend(rows);assert.deepEqual(t.points.map(p=>p.gameRef),Array.from({length:10},(_,i)=>`g${i+1}`));assert.deepEqual(rows,copy);
});
test('accuracy is pooled from supported and mistaken actions, not averaged game percentages',()=>{
 const rows=[saved(1,1,0,9),saved(2,1,9,0),saved(3,0,0,3),saved(4,0,0,0),saved(5,0,0,0)];const p=trend(rows).points[4].rolling;assert.deepEqual(p.accuracy,{numerator:2,denominator:11,percent:200/11});assert.equal(p.coverage.denominator,23);assert.equal(p.assessedGames,2);
});
test('rolling windows contain exactly the five latest chronological games and no future data',()=>{
 const t=trend(ten());assert.ok(t.points.slice(0,4).every(p=>p.rolling===null));assert.equal(t.points[4].rolling.from,t.points[0].completedAt);assert.equal(t.points[5].rolling.from,t.points[1].completedAt);assert.equal(t.points[9].rolling.to,t.points[9].completedAt);assert.equal(t.points[9].rolling.games,5);
});
test('zero accuracy and no assessed decisions remain distinct',()=>{
 const t=trend([saved(1,0,2,5),saved(2,0,0,5),saved(3,0,0,0)]);assert.equal(t.points[0].game.accuracy.percent,0);assert.equal(t.points[1].game.accuracy.percent,null);assert.equal(t.points[1].game.coverage.percent,0);assert.equal(t.points[2].game.coverage.percent,null);
});
test('equal nonoverlapping periods report exact percentage point changes',()=>{
 const rows=Array.from({length:10},(_,i)=>saved(i+1,i<5?2:4,i<5?2:1,i<5?4:0));const c=trend(rows).comparison;assert.equal(c.enoughAccuracy,true);assert.equal(c.older.games,5);assert.equal(c.recent.games,5);assert.equal(c.accuracyChange,30);assert.equal(c.coverageChange,50);assert.equal(c.boardClearedChange,0);assert.equal(c.reason,null);
});
test('decline is signed and board completion is averaged per game',()=>{
 const rows=ten();for(const [i,r] of rows.entries()){r.review.score.progress=i<5?70:40;if(i>=5){r.review.score.good=0;r.review.score.mistakes=5;r.review.report.provenGood=0;r.review.report.verifiedMistakes=5;r.review.mistakeMoves[keys[0]]=[2,3,4,5,6];}}const c=trend(rows).comparison;assert.equal(c.accuracyChange,-80);assert.equal(c.boardClearedChange,-30);
});
test('odd window excludes middle only from period comparisons',()=>{
 const rows=Array.from({length:11},(_,i)=>saved(i+1));const t=trend(rows,'practice','Intermediate',25);assert.equal(t.totalGames,11);assert.equal(t.comparison.middleGamesExcluded,1);assert.equal(t.comparison.older.to,rows[4].completedAt);assert.equal(t.comparison.recent.from,rows[6].completedAt);
});
test('insufficient assessed games or actions suppress accuracy change without hiding coverage',()=>{
 const low=Array.from({length:10},(_,i)=>saved(i+1,1,0,3));const c=trend(low).comparison;assert.equal(c.comparable,true);assert.equal(c.enoughAccuracy,false);assert.equal(c.accuracyChange,null);assert.equal(c.coverageChange,0);assert.equal(c.reason,'too-few-assessed-decisions');const few=ten();few[0]=saved(1,0,0,3);assert.equal(trend(few).comparison.enoughAccuracy,false);
});
test('same timestamp at the comparison boundary prevents directional claims',()=>{
 const rows=ten();rows[5].completedAt=rows[4].completedAt;const c=trend(rows).comparison;assert.equal(c.comparable,false);assert.equal(c.reason,'overlapping-timestamps');assert.equal(c.accuracyChange,null);assert.equal(c.boardClearedChange,null);
});
test('reuse cohort version, deduplication, conflict and window validation',()=>{
 const rows=Array.from({length:12},(_,i)=>saved(i+1));const t=trend([...rows,structuredClone(rows[0]),saved(12,8),saved(13,4,1,2,{mode:'ranked'}),saved(14,4,1,2,{difficulty:'Expert'}),saved(15,4,1,2,{version:0})]);assert.equal(t.totalGames,10);assert.equal(t.points[0].gameRef,'g2');assert.equal(t.points.at(-1).gameRef,'g11');assert.equal(t.exclusions.duplicate,1);assert.equal(t.exclusions.conflictingGames,1);assert.equal(t.exclusions.outsideCohort,2);assert.equal(t.exclusions.otherVersion,1);assert.throws(()=>trend(rows,'ranked','Expert'));
});
test('mistake prevalence uses distinct games and real completed replay projections',()=>{
 const game={game:'minesweeper',difficulty:'Beginner',rows:2,columns:3,mineCount:2,mines:[0,2],outcome:'loss',durationSeconds:3,moves:[{row:1,col:0,action:'reveal'},{row:1,col:1,action:'reveal'},{row:1,col:2,action:'reveal'},{row:0,col:0,action:'reveal'}]};const review=buildSavedReview(preparePracticeAnalysis(game));const p=trend([saved(1,0,0,0,{difficulty:'Beginner',review})],'practice','Beginner').points[0].game;assert.equal(p.mistakes,1);assert.equal(p.observed,3);assert.equal(p.mistakePatterns.find(x=>x.key===keys[1]).games,1);assert.equal(p.mistakePatterns.find(x=>x.key===keys[1]).prevalence.percent,100);
 const rows=Array.from({length:10},(_,i)=>saved(i+1,5,i<5?3:0,0));const c=trend(rows).comparison;assert.equal(c.older.mistakePatterns[0].occurrences,15);assert.equal(c.older.mistakePatterns[0].games,5);assert.equal(c.mistakePrevalenceChanges[0].change,-100);close(c.accuracyChange,37.5);
});
