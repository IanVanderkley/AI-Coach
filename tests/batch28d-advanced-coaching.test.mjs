import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { analyzeAdvancedSnapshot, inspectAdvanced, overlapEvidence, overlapRegions, riskPercent } from "../lib/coach/advanced-square-analysis.ts";
const boardOf = (s, flags=[]) => [...s].map((v,i)=>({revealed:v!==".",flagged:flags.includes(i),adjacentMines:v==="."?null:Number(v),exploded:false}));
const inspect=(r,c,m,s,i,flags=[])=>inspectAdvanced(analyzeAdvancedSnapshot(r,c,m,boardOf(s,flags)),i);
test("advanced overlap finds both middle cells safe on two-sided 1-2-1",()=>{
 const board=boardOf("...121..."), s=analyzeAdvancedSnapshot(3,3,2,board);
 for(const i of [1,7]) {const v=inspectAdvanced(s,i);assert.equal(v.proof.classification,"proven-safe");assert.equal(v.risk.mine,"0%");const p=overlapEvidence(v.proof);assert.ok(p.result.includes(i));assert.deepEqual(overlapRegions(p).shared.sort((a,b)=>a-b),[1,7]);}
});
test("weighted risk and survival use exact counts",()=>{
 const v=inspect(3,4,2,"1.1.........",1);assert.equal(v.risk.mine,"36.36%");assert.equal(v.risk.survival,"63.64%");assert.equal(v.risk.numerator,"4");assert.equal(v.risk.denominator,"11");assert.equal(v.risk.certainty,"uncertain");assert.deepEqual(v.risk.best,[3,6,7]);assert.equal(v.risk.bestMine,"9.09%");
});
test("alternatives exclude flags but flags never affect risk",()=>{
 const v=inspect(3,4,2,"1.1.........",1,[3,6]);assert.equal(v.risk.mine,"36.36%");assert.deepEqual(v.risk.best,[7]);
});
test("tiny and near-certain risks never round to certainty",()=>{
 const d=10n**100n;assert.equal(riskPercent(1n,d),"<0.01%");assert.equal(riskPercent(d-1n,d),">99.99%");assert.equal(riskPercent(0n,d),"0%");assert.equal(riskPercent(d,d),"100%");assert.throws(()=>riskPercent(2n,1n));
});
test("terminal, inconsistent, revealed and invalid inspection are unavailable",()=>{
 const terminal=boardOf("1...");terminal[1]={...terminal[1],revealed:true,exploded:true};assert.equal(inspectAdvanced(analyzeAdvancedSnapshot(2,2,1,terminal),2),null);
 assert.equal(inspect(2,2,1,"2...",1),null);assert.equal(inspect(2,2,1,"1...",0),null);assert.equal(inspect(2,2,1,"1...",99),null);
});
test("limited search does not display risk counts",()=>{
 const board=boardOf(".".repeat(81));for(const i of [10,12,14,16,28,30,32,34,46,48,50,52]) board[i]={...board[i],revealed:true,adjacentMines:1};
 const s=analyzeAdvancedSnapshot(9,9,10,board);assert.equal(s.probability.status,"limited");assert.equal(inspectAdvanced(s,0).risk,null);
});
test("complete search certifies safe or mine without requiring a rule proof",()=>{
 const v=inspect(3,3,2,"....21.10",0);assert.equal(v.risk.certainty,"safe");assert.equal(v.proof,null);assert.equal(v.risk.mine,"0%");
 const mine=inspect(2,2,1,"111.",3);assert.equal(mine.risk.certainty,"mine");assert.equal(mine.risk.survival,"0%");
});
test("inconsistent independent proof results fail closed",()=>{
 const s=analyzeAdvancedSnapshot(2,2,1,boardOf("1..."));assert.equal(inspectAdvanced({...s,conflict:true},1),null);
});
test("snapshot analysis does not mutate visible evidence or depend on hidden values",()=>{
 const b=boardOf("1.1........."), copy=JSON.stringify(b);const s=analyzeAdvancedSnapshot(3,4,2,b);assert.equal(JSON.stringify(b),copy);const altered=b.map((v,i)=>v.revealed?v:{...v,adjacentMines:i,flagged:true});assert.deepEqual(analyzeAdvancedSnapshot(3,4,2,altered).probability,s.probability);
});
test("replay integration is explicit, snapshot-scoped and post-game only",()=>{
 const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");const ui=read("components/coach/verified-replay-panel.tsx");const panel=read("components/coach/advanced-square-panel.tsx");
 assert.match(ui,/const advancedBoard = opening \? current\.after : current\.before/);assert.match(ui,/advanced\.game === game && advanced\.board === advancedBoard/);assert.match(ui,/function runAdvanced\(\) \{[\s\S]*?setPlaying\(false\);[\s\S]*?analyzeAdvancedSnapshot/);assert.match(ui,/showProofs && squareAnalysis\?\.classification === "unresolved"/);assert.match(panel,/onClick=\{onAnalyze\}/);assert.match(panel,/all compatible full-board mine layouts are equally likely/);assert.match(panel,/No incomplete counts/);assert.match(panel,/replayCellGlyph\(cell\)/);
});
