import assert from "node:assert/strict";
import test from "node:test";
import { deduceVisibleBoard } from "../lib/coach/verified-replay.ts";
import { prepareSquareAnalysis, explainSquare } from "../lib/coach/square-analysis.ts";
import { buildVisualLesson } from "../lib/coach/visual-deduction.ts";

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
// Validate the teaching chain independently of the solver's constraint builder.
function verifyChain(analysis, board, rows, cols, mineCount, root) {
  const provenSafe=new Set(), provenMines=new Set();
  for (const step of analysis.explanation.steps) {
    const v=step.visual;
    assert.ok(v && v.groups.length>=1 && v.groups.length<=2);
    const [a,b]=v.groups;
    const required=new Set();
    for (const g of v.groups) {
      const area=g.clue===null?Array.from({length:board.length},(_,i)=>i):neighbors(g.clue,rows,cols);
      if (g.clue!==null) { assert.ok(board[g.clue].revealed); assert.equal(g.originalCount,board[g.clue].adjacentMines); }
      else assert.equal(g.originalCount,mineCount);
      for (const i of g.knownMines) { assert.ok(provenMines.has(i)); required.add(i); }
      for (const i of g.knownSafe) { assert.ok(provenSafe.has(i)); required.add(i); }
      const partition=[...g.cells,...g.knownMines,...g.knownSafe];
      assert.deepEqual(sorted(partition),sorted(area.filter(i=>!board[i].revealed)));
      assert.equal(g.remainingMines,g.originalCount-g.knownMines.length);
      assert.ok(g.remainingMines>=0 && g.remainingMines<=g.cells.length);
    }
    assert.deepEqual(sorted(step.dependencies),sorted(required));
    assert.deepEqual(sorted(step.clues),sorted(new Set(v.groups.flatMap(g=>g.clue===null?[]:[g.clue]))));
    if (b) assert.ok(a.cells.every(i=>b.cells.includes(i)));
    assert.deepEqual(sorted(v.result),sorted(b?b.cells.filter(i=>!a.cells.includes(i)):a.cells));
    assert.equal(v.mineCount,b?b.remainingMines-a.remainingMines:a.remainingMines);
    assert.ok(v.result.length && (v.mineCount===0 || v.mineCount===v.result.length));
    for (const i of v.result) {
      assert.ok(!board[i].revealed);
      assert.ok(!(v.mineCount===0?provenMines:provenSafe).has(i));
      (v.mineCount===0?provenSafe:provenMines).add(i);
    }
  }
  assert.ok(analysis.explanation.steps.at(-1).visual.result.includes(root));
  assert.ok((analysis.classification==="proven-safe"?provenSafe:provenMines).has(root));
}
for (const [rows,cols] of [[2,2],[2,3],[3,3]]) test(`exhaustive ${rows}x${cols}: sound claims, flag independence and teaching chains`,t=>{
  const total=rows*cols, full=bit(total)-1;
  let checked=0, modelPairs=0, gaps=0, gapBoards=0, claims=0, firstGap=null;
  for (const [key,item] of corpus(rows,cols)) {
    const board=boardOf(item.clues), before=JSON.stringify(board);
    const plain=deduceVisibleBoard(rows,cols,item.mineCount,board);
    const traced=deduceVisibleBoard(rows,cols,item.mineCount,board,true);
    const flagged=deduceVisibleBoard(rows,cols,item.mineCount,boardOf(item.clues,full^item.shown),true);
    const context=prepareSquareAnalysis(board,rows,cols,item.mineCount);
    assert.deepEqual(signature(traced),signature(plain),key);
    assert.deepEqual(flagged,traced,key); // flags cannot change proofs or derivations
    const missing=verifyClaims(traced,item,total,key);
    gaps+=missing; if(missing){gapBoards++; firstGap??=key;}
    for (const i of indices(full^item.shown,total)) {
      const analysis=explainSquare(context,i);
      const expected=context.safe.has(i)?"proven-safe":context.mines.has(i)?"proven-mine":"unresolved";
      assert.equal(analysis.classification,expected,key);
      if(expected!=="unresolved"){
        claims++; verifyChain(analysis,board,rows,cols,item.mineCount,i);
        const visual=buildVisualLesson(analysis,i);
        assert.ok(visual,key);
        for(const phase of visual.phases) for(const [j,role] of phase.marks) {
          if(role==="safe"||role==="known-safe") assert.ok(!(item.any&bit(j)),key);
          if(role==="mine"||role==="known-mine") assert.ok(item.all&bit(j),key);
        }
      } else assert.equal(analysis.explanation.steps.length,0,key);
    }
    assert.equal(JSON.stringify(board),before,key);
    checked++; modelPairs+=item.models;
  }
  assert.equal(modelPairs,3**total-1); // excludes the all-mined board
  assert.ok(checked>0 && claims>0);
  t.diagnostic(JSON.stringify({snapshots:checked,layoutSnapshotPairs:modelPairs,claims,missedForcedSquares:gaps,snapshotsWithMissedProofs:gapBoards,firstGap}));
});

test("oracle distinguishes ambiguity from certainty without trusting flags",()=>{
  const item=corpus(2,2).get("1:1...");
  assert.equal(item.models,3);
  assert.equal(item.all,0);
  assert.equal(item.any,14);
  for(let flags=0;flags<16;flags++) assert.deepEqual(signature(deduceVisibleBoard(2,2,1,boardOf(item.clues,flags))),{safe:[],mines:[]});
});

test("terminal mine exposure cannot create inspected-square proofs",()=>{
  const board=boardOf("1..."); board[1]={revealed:true,flagged:false,adjacentMines:null,exploded:true};
  const context=prepareSquareAnalysis(board,2,2,1);
  assert.equal(context.proofs.size,0);
  assert.equal(explainSquare(context,2).classification,"unresolved");
  assert.equal(buildVisualLesson(explainSquare(context,2),2),null);
});

test("two-sided 1-2-1 constraints: the two middle-column covered squares are forced safe",()=>{
  const item=corpus(3,3).get("2:...121...");
  assert.equal(item.models,4);
  assert.equal(item.any,bit(0)|bit(2)|bit(6)|bit(8));
  assert.equal(item.all,0);
  const board=boardOf(item.clues);
  // Do not assert today's incompleteness: a stronger solver may find both.
  verifyClaims(deduceVisibleBoard(3,3,2,board,true),item,9,"two-sided pattern");
});
