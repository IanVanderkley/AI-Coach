import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLearningReviews } from '../lib/coach/learning-analytics.ts';
import { buildSavedReview, summarizeLearning } from '../lib/coach/personalized-review.ts';
import { preparePracticeAnalysis, PRACTICE_ANALYSIS_VERSION } from '../lib/coach/practice-analysis.ts';
const keys = ['unnecessary-guess','revealed-known-mine','flagged-known-safe'];
function saved(id, good=3, mistakes=1, uncertain=2, extra={}) {
  return {mode:'practice',difficulty:'Intermediate',gameRef:`g${id}`,completedAt:new Date(Date.UTC(2026,0,id)).toISOString(),outcome:'loss',version:PRACTICE_ANALYSIS_VERSION,review:{score:{good,mistakes,uncertain,progress:50,score:good+mistakes?60:null},report:{provenGood:good,verifiedMistakes:mistakes,uncertainActions:uncertain,recordedActions:good+mistakes+uncertain},mistakeMoves:{[keys[0]]:Array.from({length:mistakes},(_,i)=>i+2),[keys[1]]:[],[keys[2]]:[]}},...extra};
}
const analyze = (rows,mode='practice',difficulty='Intermediate',window=10)=>analyzeLearningReviews(rows,mode,difficulty,window);
test('empty saved history has no accuracy, coverage, completion or recurrence rate',()=>{
 const a=analyze([]); assert.equal(a.evidence.decisionAccuracy.percent,null);assert.equal(a.evidence.decisionCoverage.percent,null);assert.equal(a.averageBoardCleared,null);assert.equal(a.patterns[0].prevalence.percent,null);
});
test('uncertain actions are excluded from accuracy but counted in evidence coverage',()=>{
 const a=analyze([saved(1,3,1,6),saved(2,1,0,0)]);assert.deepEqual(a.evidence.decisionAccuracy,{numerator:4,denominator:5,percent:80});assert.equal(a.evidence.decisionCoverage.denominator,11);assert.equal(a.evidence.assessedGames,2);assert.equal(a.metrics.accuracy,80);
});
test('no assessed moves is distinct from a zero accuracy score',()=>{
 const a=analyze([saved(1,0,0,5)]);assert.equal(a.evidence.decisionAccuracy.percent,null);assert.equal(a.evidence.decisionCoverage.percent,0);assert.equal(a.evidence.gamesWithoutAssessedDecisions,1);assert.equal(analyze([saved(1,0,2,5)]).evidence.decisionAccuracy.percent,0);
});
test('cohort and version isolation including Ranked Intermediate',()=>{
 const rows=[saved(1),saved(2,3,1,0,{mode:'ranked'}),saved(3,3,1,0,{difficulty:'Expert'}),saved(4,3,1,0,{version:0})];const a=analyze(rows);assert.deepEqual(a.selected.map(x=>x.gameRef),['g1']);assert.equal(a.exclusions.outsideCohort,2);assert.equal(a.exclusions.otherVersion,1);assert.deepEqual(analyze(rows,'ranked').selected.map(x=>x.gameRef),['g2']);assert.throws(()=>analyze(rows,'ranked','Expert'));
});
test('latest distinct games fill only the selected window without mutating input',()=>{
 const rows=Array.from({length:12},(_,i)=>saved(i+1));const before=structuredClone(rows);const a=analyze(rows);assert.deepEqual(a.selected.map(x=>x.gameRef),['g12','g11','g10','g9','g8','g7','g6','g5','g4','g3']);assert.equal(a.exclusions.outsideWindow,2);assert.deepEqual(rows,before);assert.throws(()=>analyze(rows,'practice','Intermediate',11));
});
test('duplicates do not inflate counts and conflicting copies fail closed independent of order',()=>{
 const a=saved(1),b=saved(2),c=saved(2,8,1,0);const x=analyze([a,structuredClone(a),b,c]);const y=analyze([c,b,a]);assert.deepEqual(x.selected,[a]);assert.deepEqual(x.selected,y.selected);assert.equal(x.exclusions.duplicate,1);assert.equal(x.exclusions.conflictingGames,1);
});
test('counter mismatches, invalid dates, duplicate move references and malformed rows excluded',()=>{
 const a=saved(1),b=saved(2),c=saved(3),d=saved(4,3,2,0);b.review.report.provenGood=99;c.completedAt='invalid';d.review.mistakeMoves[keys[1]]=[2];const x=analyze([a,b,c,d,null,saved(5,3,-1,0)]);assert.deepEqual(x.selected,[a]);assert.equal(x.exclusions.invalid,5);
});
test('recurrence counts distinct games and retains real example move references',()=>{
 const a=analyze([saved(1,3,4,0)]);assert.equal(a.patterns[0].recurring,false);assert.equal(a.patterns[0].occurrences,4);const b=analyze([saved(1,3,4,0),saved(2,3,1,0),saved(3,3,0,0)]);assert.equal(b.patterns[0].recurring,true);assert.equal(b.patterns[0].games,2);assert.equal(b.patterns[0].occurrences,5);assert.deepEqual(b.patterns[0].example,{gameRef:'g2',move:2});assert.equal(b.patterns[0].prevalence.denominator,3);
});
test('existing saved review metrics and learning score remain unchanged for valid inputs',()=>{
 const rows=[saved(1,1,2,3),saved(2,7,1,4)];const a=analyze(rows);const old=summarizeLearning(rows,'practice','Intermediate',10);assert.deepEqual(a.metrics,old.metrics);assert.equal(a.averageBoardCleared,50);
});
test('real completed replay output flows through the existing saved review builder',()=>{
 const game={game:'minesweeper',difficulty:'Beginner',rows:2,columns:3,mineCount:2,mines:[0,2],outcome:'loss',durationSeconds:3,moves:[{row:1,col:0,action:'reveal'},{row:1,col:1,action:'reveal'},{row:1,col:2,action:'reveal'},{row:0,col:0,action:'reveal'}]};const review=buildSavedReview(preparePracticeAnalysis(game));const a=analyze([saved(1,0,0,0,{difficulty:'Beginner',review})],'practice','Beginner');assert.equal(a.evidence.games,1);assert.equal(a.metrics.mistakes,1);assert.equal(a.patterns.find(p=>p.key===keys[1]).example.move,4);assert.equal(a.evidence.observed,3);
});
