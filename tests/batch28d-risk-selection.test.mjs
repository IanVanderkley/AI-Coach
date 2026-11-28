import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeAdvancedSnapshot, inspectAdvanced } from '../lib/coach/advanced-square-analysis.ts';
const boardOf = text => [...text].map(v=>({revealed:v!=='.',flagged:false,adjacentMines:v==='.'?null:Number(v),exploded:false}));
test('cached snapshot selects the correct distinct exact risks on repeated inspection',()=>{
 const s=analyzeAdvancedSnapshot(3,4,2,boardOf('1.1.........'));
 for(const [index,hits] of [[1,'4'],[3,'1'],[4,'3'],[8,'2'],[1,'4']]){
  const actual=inspectAdvanced(s,index).risk;assert.equal(actual.numerator,hits);assert.equal(actual.denominator,'11');
 }
});
test('unconstrained covered squares have equal odds and accurate peer counts',()=>{
 const s=analyzeAdvancedSnapshot(2,4,2,boardOf('1.......'));
 for(const i of [2,3,6,7]){const v=inspectAdvanced(s,i).risk;assert.equal(v.mine,'25%');assert.equal(v.adjacentClues,0);assert.equal(v.sameRiskCount,3);assert.equal(v.comparison.mine,'33.33%');}
});
test('clue-adjacent squares can have a different probability from the unconstrained area',()=>{
 const s=analyzeAdvancedSnapshot(2,4,2,boardOf('1.......'));
 for(const i of [1,4,5]){const v=inspectAdvanced(s,i).risk;assert.equal(v.mine,'33.33%');assert.equal(v.adjacentClues,1);assert.equal(v.sameRiskCount,2);assert.equal(v.comparison.mine,'25%');}
});
test('all equal risks have no contrasting square; flags do not change peer counts',()=>{
 const board=boardOf('1...');board[1].flagged=true;
 const s=analyzeAdvancedSnapshot(2,2,1,board);const v=inspectAdvanced(s,2).risk;
 assert.equal(v.sameRiskCount,2);assert.equal(v.comparison,null);
});
test('comparison identifies an unflagged uncertain square with a distinct displayed risk',()=>{
 const board=boardOf('1.1.........');board[3].flagged=true;
 const s=analyzeAdvancedSnapshot(3,4,2,board);
 for(const entry of s.probability.squares){const v=inspectAdvanced(s,entry.index).risk;const c=v.comparison;if(c){assert.equal(board[c.index].flagged,false);assert.notEqual(c.index,entry.index);const target=inspectAdvanced(s,c.index).risk;assert.equal(target.certainty,'uncertain');assert.equal(target.mine,c.mine);assert.notEqual(v.mine,c.mine);}}
});
test('panel labels the inspected index and renders the selection-specific explanation',()=>{
 const panel=readFileSync(new URL('../components/coach/advanced-square-panel.tsx',import.meta.url),'utf8');
 assert.match(panel,/inspectAdvanced\(snapshot,index\)/);assert.match(panel,/Selected square: \{cellLabel\(index, columns\)\}/);assert.match(panel,/result\.risk\.sameRiskCount/);assert.match(panel,/result\.risk\.comparison\.index/);
});
