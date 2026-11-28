import assert from "node:assert/strict";
import test from "node:test";
import { enumerateVisibleBoard } from "../lib/coach/constraint-enumeration.ts";
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
for (const [rows, cols] of [[2,2],[2,3],[3,3]]) test(`enumeration matches every forced square on ${rows}x${cols}`, t => {
  const total=rows*cols, full=bit(total)-1;
  let snapshots=0, claims=0, priorMisses=0, maxNodes=0;
  for(const [key,item] of corpus(rows,cols)) {
    const board=boardOf(item.clues), original=JSON.stringify(board);
    const actual=enumerateVisibleBoard(rows,cols,item.mineCount,board);
    assert.equal(actual.status,"complete",key);
    const covered=indices(full^item.shown,total);
    const safe=covered.filter(i=>!(item.any&bit(i))), mines=covered.filter(i=>item.all&bit(i));
    assert.deepEqual(actual.safe,safe,key); assert.deepEqual(actual.mines,mines,key);
    assert.deepEqual(enumerateVisibleBoard(rows,cols,item.mineCount,boardOf(item.clues,full^item.shown)),actual,key);
    assert.equal(JSON.stringify(board),original);
    const advanced=deduceVisibleBoard(rows,cols,item.mineCount,board,false,true);
    priorMisses+=safe.length+mines.length-advanced.safe.length-advanced.mines.length;
    snapshots++; claims+=safe.length+mines.length; maxNodes=Math.max(maxNodes,actual.nodes);
  }
  t.diagnostic(JSON.stringify({snapshots,claims,priorMisses,enumerationMisses:0,maxNodes}));
});
test("budget exhaustion discards every result, even if some models were found",()=>{
  const board=boardOf("1...");
  const complete=enumerateVisibleBoard(2,2,1,board);
  assert.equal(complete.status,"complete");
  for(let n=1;n<complete.nodes;n++) {
    const result=enumerateVisibleBoard(2,2,1,board,{maxNodes:n});
    assert.deepEqual(result,{status:"limited",safe:[],mines:[],nodes:n});
  }
  assert.deepEqual(enumerateVisibleBoard(2,2,1,board,{maxNodes:complete.nodes}),complete);
});
test("frontier cap and hard limit validation fail closed",()=>{
  assert.equal(enumerateVisibleBoard(3,3,1,boardOf("....1...."),{maxFrontier:7}).status,"limited");
  const large = boardOf(".".repeat(81));
  for (const i of [10,13,16,37]) large[i] = boardOf("1")[0];
  assert.deepEqual(enumerateVisibleBoard(9,9,10,large),{status:"limited",safe:[],mines:[],nodes:0});
  for(const limits of [{maxFrontier:19},{maxNodes:100001},{maxNodes:0},{maxFrontier:NaN}]) assert.equal(enumerateVisibleBoard(2,2,1,boardOf("1..."),limits).status,"invalid");
});
test("global mine total can force all off-frontier squares without enumerating them",()=>{
  const safe=enumerateVisibleBoard(2,4,1,boardOf("1......."));
  assert.equal(safe.status,"complete"); assert.deepEqual(safe.safe,[2,3,6,7]); assert.deepEqual(safe.mines,[]);
  const mines=enumerateVisibleBoard(2,4,5,boardOf("1......."));
  assert.equal(mines.status,"complete"); assert.deepEqual(mines.mines,[2,3,6,7]); assert.deepEqual(mines.safe,[]);
});
test("empty frontier supports large boards without false certainty or probabilities",()=>{
  for(const [r,c,m] of [[9,9,10],[16,16,40],[16,30,99]]) {
    const result=enumerateVisibleBoard(r,c,m,boardOf(".".repeat(r*c)));
    assert.deepEqual(result,{status:"complete",safe:[],mines:[],frontierModels:1,nodes:1,frontierSize:0,outsideSize:r*c});
  }
});
test("impossible snapshots, invalid inputs and terminal mine exposures never produce claims",()=>{
  assert.equal(enumerateVisibleBoard(2,2,1,boardOf("2...")).status,"inconsistent");
  assert.equal(enumerateVisibleBoard(2,2,1,boardOf("1..2")).status,"inconsistent");
  assert.equal(enumerateVisibleBoard(2,2,1,boardOf("9...")).status,"invalid");
  assert.equal(enumerateVisibleBoard(2,2,1,boardOf("1..")).status,"invalid");
  const board=boardOf("1..."); board[1]={...board[1],revealed:true,exploded:true};
  assert.deepEqual(enumerateVisibleBoard(2,2,1,board),{status:"terminal",safe:[],mines:[],nodes:0});
});
test("hidden adjacency values cannot influence the result",()=>{
  const board=boardOf("...121...");
  const poisoned=board.map((cell,i)=>cell.revealed?cell:{...cell,adjacentMines:i});
  assert.deepEqual(enumerateVisibleBoard(3,3,2,poisoned),enumerateVisibleBoard(3,3,2,board));
});
