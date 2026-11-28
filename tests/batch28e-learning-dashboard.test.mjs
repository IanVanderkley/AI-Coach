import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLearningDashboard, formatLearningPercent, formatLearningChange, trendAvailability } from '../lib/coach/learning-dashboard.ts';
import { PRACTICE_ANALYSIS_VERSION } from '../lib/coach/practice-analysis.ts';
const row=(id,good=4,mistakes=1,uncertain=5,extra={})=>({mode:'practice',difficulty:'Intermediate',gameRef:`g${id}`,completedAt:new Date(Date.UTC(2026,0,id)).toISOString(),outcome:'loss',version:PRACTICE_ANALYSIS_VERSION,review:{score:{good,mistakes,uncertain,progress:50,score:good+mistakes?60:null},report:{provenGood:good,verifiedMistakes:mistakes,uncertainActions:uncertain,recordedActions:good+mistakes+uncertain,moments:[]},mistakeMoves:{'unnecessary-guess':Array.from({length:mistakes},(_,i)=>i+2),'revealed-known-mine':[],'flagged-known-safe':[]}},...extra});
const build=(rows,mode='practice',difficulty='Intermediate',window=10)=>buildLearningDashboard(rows,mode,difficulty,window);
test('dashboard uses one accepted cohort for all views',()=>{const a=row(1),bad=row(2);bad.review.report.provenGood=100;const d=build([a,structuredClone(a),bad,row(3,4,1,5,{difficulty:'Expert'}),row(4,4,1,5,{mode:'ranked'})]);assert.deepEqual(d.learning.selected.map(x=>x.gameRef),['g1']);assert.equal(d.trends.totalGames,1);assert.equal(d.recommendation.evidence.games,1);assert.equal(d.learning.exclusions.invalid,1);assert.equal(d.learning.exclusions.duplicate,1);});
test('empty dashboard does not invent rates or a lesson',()=>{const d=build([]);assert.equal(d.learning.evidence.decisionAccuracy.percent,null);assert.equal(d.learning.evidence.decisionCoverage.percent,null);assert.equal(d.recommendation.lesson,null);assert.equal(d.trends.points.length,0);});
test('coverage and accuracy use different denominators',()=>{const d=build([row(1)]);assert.equal(d.learning.evidence.decisionAccuracy.percent,80);assert.equal(d.learning.evidence.decisionCoverage.percent,50);});
test('uncertain-only reviews do not establish accuracy or mastery',()=>{const d=build([row(1,0,0,30)]);assert.equal(d.learning.evidence.decisionAccuracy.percent,null);assert.equal(d.learning.evidence.decisionCoverage.percent,0);assert.equal(d.recommendation.kind,'collect-evidence');});
test('legacy reports do not supply action-specific skill percentages',()=>{const d=build([row(1),row(2),row(3)]);assert.equal(d.recommendation.evidenceGames,0);assert.deepEqual(d.recommendation.skillEvidence,[]);});
test('strict trend requirement replaces old five-game-only comparison',()=>{const d=build(Array.from({length:10},(_,i)=>row(i+1,1,0,0)));assert.equal(d.trends.comparison.accuracyChange,null);assert.match(trendAvailability(d.trends.comparison),/20 assessed decisions/);});
test('weighted comparable change and rolling points retain coverage',()=>{const d=build(Array.from({length:10},(_,i)=>row(i+1,i<5?4:8,i<5?4:2,2)));assert.equal(d.trends.comparison.accuracyChange,30);assert.equal(d.trends.points[3].rolling,null);assert.equal(d.trends.points[4].rolling.accuracy.percent,50);assert.equal(d.trends.points[9].rolling.accuracy.percent,80);});
test('selection and recommendation reference same newest game',()=>{const d=build([row(1),row(2)]);assert.equal(d.recommendation.focus.example.gameRef,'g2');assert.equal(d.recommendation.focus.example.move,2);assert.equal(d.recommendation.kind,'recurring-mistake');});
test('mode and window changes never mix cohorts',()=>{const rows=[...Array.from({length:12},(_,i)=>row(i+1)),row(20,4,1,5,{mode:'ranked'})];assert.equal(build(rows).learning.selected.length,10);assert.equal(build(rows,'ranked').learning.selected[0].gameRef,'g20');assert.equal(build(rows,'practice','Expert').learning.selected.length,0);});
test('display distinguishes zero from missing and uses percentage points',()=>{assert.equal(formatLearningPercent(null),'Not enough data');assert.equal(formatLearningPercent(0),'0%');assert.equal(formatLearningPercent(26.424),'26.4%');assert.equal(formatLearningChange(null),'Not enough data');assert.equal(formatLearningChange(0),'0 pp');assert.equal(formatLearningChange(2.345),'+2.3 pp');assert.equal(formatLearningChange(-2.345),'-2.3 pp');});
test('component wires strict trends and recommendation to existing filters',()=>{const s=readFileSync(new URL('../components/coach/personalized-coaching.tsx',import.meta.url),'utf8');assert.match(s,/buildLearningDashboard\(reports, mode, actualDifficulty, windowSize\)/);assert.match(s,/trends\.comparison\.accuracyChange/);assert.match(s,/recommendation\.focus/);assert.match(s,/onReview\(mode, lead\.example!\.gameRef, lead\.example!\.move\)/);assert.match(s,/LearningDashboardDetail dashboard=\{dashboard\}/);});
test('chart provides accessible exact table and does not join missing values',()=>{const s=readFileSync(new URL('../components/coach/learning-dashboard-detail.tsx',import.meta.url),'utf8');assert.match(s,/value === null \? null/);assert.match(s,/typeof prior === "number"/);assert.match(s,/<table/);assert.match(s,/scope="col"/);assert.match(s,/Saved reports do not yet include action-specific evidence/);});

test('legacy accuracy meter uses the precise validated rate and never invents zero',()=>{
  const d=build([row(1,2,1,4)]);
  assert.equal(d.learning.metrics.accuracy,200/3);
  assert.equal(d.learning.metrics.accuracy,d.learning.evidence.decisionAccuracy.percent);
  assert.equal(build([row(1,0,0,4)]).learning.metrics.accuracy,null);
  assert.equal(build([row(1,0,2,4)]).learning.metrics.accuracy,0);
  const s=readFileSync(new URL('../components/coach/personalized-coaching.tsx',import.meta.url),'utf8');
  assert.match(s,/learning\.metrics\.accuracy !== null && \([\s\S]*?<progress[^>]*value=\{learning\.metrics\.accuracy\}/);
});

test('trend availability separates the ten-review minimum from stronger evidence requirements',()=>{
  const nine=build(Array.from({length:9},(_,i)=>row(i+1,10,1,0)));
  assert.equal(nine.learning.selected.length,9);
  assert.equal(nine.trends.comparison.accuracyChange,null);
  assert.equal(nine.trends.comparison.reason,'too-few-games');
  const ten=build(Array.from({length:10},(_,i)=>row(i+1,1,0,0)));
  assert.equal(ten.trends.comparison.reason,'too-few-assessed-decisions');
  assert.equal(ten.trends.comparison.accuracyChange,null);
  const enough=build(Array.from({length:10},(_,i)=>row(i+1,10,1,0)));
  assert.equal(enough.trends.comparison.accuracyChange,0);
  const s=readFileSync(new URL('../components/coach/personalized-coaching.tsx',import.meta.url),'utf8');
  assert.match(s,/learning\.selected\.length < 10\s*\? "Needs at least 10 reviews[^"\n]*"\s*:\s*trendAvailability\(trends\.comparison\)/);
});
