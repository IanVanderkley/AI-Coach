import assert from "node:assert/strict";
import test from "node:test";
import { deduceVisibleBoard } from "../lib/coach/verified-replay.ts";

// Independent small-board oracle: enumerate all mine layouts AND all subsets
// of revealed non-mines. Bucket by public mine total and visible clues alone.
// This includes synthetic snapshots, not only states reachable by flood reveal.
const bit = i => 1 << i;
const pop = n => { let c = 0; for (; n; n &= n - 1) c++; return c; };
const indices = (n, total) => Array.from({length: total}, (_, i) => i).filter(i => n & bit(i));
const sorted = xs => [...xs].sort((a,b) => a-b);
const neighbors = (i, rows, cols) => Array.from({length: rows*cols}, (_, j) => j).filter(j => j !== i && Math.abs(Math.floor(i/cols)-Math.floor(j/cols)) <= 1 && Math.abs(i%cols-j%cols) <= 1);
function corpus(rows, cols) {
  const total = rows*cols, full = bit(total)-1, cases = new Map();
  const masks = Array.from({length:total}, (_, i) => neighbors(i,rows,cols).reduce((m,j)=>m|bit(j),0));
  for (let layout=0; layout<full; layout++) {
    const mineCount=pop(layout), safe=full^layout;
    const values=masks.map(m=>pop(m&layout));
    for (let shown=safe;; shown=(shown-1)&safe) {
      const clues=values.map((v,i)=>shown&bit(i)?String(v):".").join("");
      const key=`${mineCount}:${clues}`;
      const item=cases.get(key);
      if (item) { item.any |= layout; item.all &= layout; item.models++; }
      else cases.set(key,{mineCount,clues,shown,any:layout,all:layout,models:1});
      if (!shown) break;
    }
  }
  return cases;
}
function boardOf(clues, flagMask=0) {
  return [...clues].map((v,i)=>({revealed:v!==".", flagged:v==="." && !!(flagMask&bit(i)), adjacentMines:v==="."?null:Number(v), exploded:false}));
}
const signature = result => ({safe:sorted(result.safe.map(p=>p.index)),mines:sorted(result.mines.map(p=>p.index))});
function verifyClaims(result, item, total, context) {
  const actual=signature(result), covered=indices(((1<<total)-1)^item.shown,total);
  const safe=covered.filter(i=>!(item.any&bit(i))), mines=covered.filter(i=>item.all&bit(i));
  for (const [kind,expected] of [["safe",safe],["mines",mines]]) {
    assert.equal(new Set(actual[kind]).size,actual[kind].length,context);
    for (const i of actual[kind]) assert.ok(expected.includes(i),`${context}: false ${kind} claim at ${i}`);
  }
  return safe.length+mines.length-actual.safe.length-actual.mines.length;
}
// Independently validate each certificate using all possible assignments to its
// input groups, rather than duplicating the advanced solver's bound equations.
function verifyTrace(result, board, rows, cols, mineCount) {
  const byIndex = new Map([...result.safe, ...result.mines].map(p => [p.index,p]));
  const safe = new Set(result.safe.map(p=>p.index));
  const mines = new Set(result.mines.map(p=>p.index));
  const visited = new Set(), visiting = new Set(), checkedSteps = new Set();
  let overlapSteps = 0;
  function visit(p) {
    if (visited.has(p.index)) return;
    assert.ok(!visiting.has(p.index), "cyclic prerequisites"); visiting.add(p.index);
    const d = p.derivation;
    assert.ok(d && (!!d.visual !== !!d.overlap));
    const v = d.overlap ?? d.visual;
    assert.ok(v.result.includes(p.index));
    assert.equal(v.mineCount,safe.has(p.index)?0:v.result.length);
    for(const i of d.dependencies) { assert.ok(byIndex.has(i)); visit(byIndex.get(i)); }
    if (!checkedSteps.has(d)) {
      checkedSteps.add(d);
      const required = new Set();
      for(const g of v.groups) {
        const area = g.clue === null ? Array.from({length:board.length},(_,i)=>i) : neighbors(g.clue,rows,cols);
        if(g.clue!==null) { assert.ok(board[g.clue].revealed); assert.equal(g.originalCount,board[g.clue].adjacentMines); }
        else assert.equal(g.originalCount,mineCount);
        for(const i of g.knownMines) { assert.ok(visited.has(i) && mines.has(i)); required.add(i); }
        for(const i of g.knownSafe) { assert.ok(visited.has(i) && safe.has(i)); required.add(i); }
        assert.deepEqual(sorted([...g.cells,...g.knownMines,...g.knownSafe]),sorted(area.filter(i=>!board[i].revealed)));
        assert.equal(g.remainingMines,g.originalCount-g.knownMines.length);
      }
      assert.deepEqual(sorted(d.dependencies),sorted(required));
      assert.deepEqual(sorted(d.clues),sorted(new Set(v.groups.flatMap(g=>g.clue===null?[]:[g.clue]))));
      const [a,b,c] = v.groups;
      const mask = xs => xs.reduce((m,i)=>m|bit(i),0);
      const union = mask(v.groups.flatMap(g=>g.cells));
      const outcome = mask(v.result);
      assert.ok(outcome && (outcome & union)===outcome);
      let valid=0, min=Infinity,max=-Infinity;
      for(let m=union;;m=(m-1)&union) {
        if(v.groups.every(g=>pop(m & mask(g.cells))===g.remainingMines)) {
          valid++;
          assert.equal(pop(m&outcome),v.mineCount,"certificate does not force result");
          if(d.overlap) {const n=pop(m&mask(a.cells)&mask(b.cells)); min=Math.min(min,n); max=Math.max(max,n);}
        }
        if(!m) break;
      }
      assert.ok(valid>0,"certificate must have a satisfying assignment");
      if(d.overlap) {
        overlapSteps++;
        assert.ok(b && v.groups.length<=3);
        const shared=mask(a.cells)&mask(b.cells), onlyA=mask(a.cells)&~mask(b.cells), onlyB=mask(b.cells)&~mask(a.cells);
        assert.ok(shared && onlyA && onlyB);
        assert.equal(outcome,{shared,"only-a":onlyA,"only-b":onlyB}[v.region]);
        if(c) assert.equal(mask(c.cells),mask(a.cells)|mask(b.cells));
        assert.equal(v.sharedMin,min); assert.equal(v.sharedMax,max);
      }
    }
    visiting.delete(p.index); visited.add(p.index);
  }
  for(const p of byIndex.values()) visit(p);
  return overlapSteps;
}
for(const [rows,cols] of [[2,2],[2,3],[3,3]]) test(`advanced overlap ${rows}x${cols}: oracle, certificates and flag independence`,t=>{
  const total=rows*cols, full=bit(total)-1;
  let snapshots=0, baselineMisses=0, advancedMisses=0, claims=0, advancedSteps=0, improved=0;
  for(const [key,item] of corpus(rows,cols)) {
    const board=boardOf(item.clues), before=JSON.stringify(board);
    const baseline=deduceVisibleBoard(rows,cols,item.mineCount,board,true);
    const advanced=deduceVisibleBoard(rows,cols,item.mineCount,board,true,true);
    const plain=deduceVisibleBoard(rows,cols,item.mineCount,board,false,true);
    const flagged=deduceVisibleBoard(rows,cols,item.mineCount,boardOf(item.clues,full^item.shown),true,true);
    assert.deepEqual(signature(advanced),signature(plain),key);
    assert.deepEqual(advanced,flagged,key);
    const missing=verifyClaims(advanced,item,total,key), oldMissing=verifyClaims(baseline,item,total,key);
    for(const kind of ["safe","mines"]) for(const p of baseline[kind]) assert.ok(advanced[kind].some(q=>q.index===p.index),key);
    baselineMisses+=oldMissing; advancedMisses+=missing; if(missing<oldMissing) improved++;
    advancedSteps+=verifyTrace(advanced,board,rows,cols,item.mineCount);
    claims+=advanced.safe.length+advanced.mines.length;
    assert.equal(JSON.stringify(board),before,key);
    snapshots++;
  }
  if(rows===3 && cols===3) { assert.ok(advancedMisses<baselineMisses); assert.ok(advancedSteps>0); }
  t.diagnostic(JSON.stringify({snapshots,baselineMisses,advancedMisses,claims,advancedSteps,improved}));
});
test("two-sided 1-2-1 is solved only in the opt-in mode, with a three-group certificate",()=>{
  const board=boardOf("...121...");
  const baseline=deduceVisibleBoard(3,3,2,board,true);
  assert.deepEqual(signature(baseline),{safe:[],mines:[]});
  const result=deduceVisibleBoard(3,3,2,board,true,true);
  assert.deepEqual(signature(result),{safe:[1,7],mines:[]});
  assert.equal(result.safe[0].derivation.overlap.groups.length,3);
  assert.equal(result.safe[0].derivation.overlap.sharedMax,0);
  assert.equal(result.safe[0].derivation.visual,undefined);
});
test("an unsupported flag still proves nothing in advanced mode",()=>{
  for(let flags=0;flags<16;flags++) assert.deepEqual(signature(deduceVisibleBoard(2,2,1,boardOf("1...",flags),true,true)),{safe:[],mines:[]});
});
test("terminal exposed mines are excluded by the advanced solver itself",()=>{
  const board=boardOf("1..."); board[1]={revealed:true,flagged:false,adjacentMines:null,exploded:true};
  assert.deepEqual(deduceVisibleBoard(2,2,1,board,true,true),{safe:[],mines:[]});
});
