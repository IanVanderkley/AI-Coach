import assert from "node:assert/strict";
import test from "node:test";
import { calculateVisibleProbabilities as probability, enumerateVisibleBoard } from "../lib/coach/constraint-enumeration.ts";

const boardOf = (text, flagged = false) => [...text].map(v => ({revealed:v!==".", flagged:v==="." && flagged, adjacentMines:v==="."?null:Number(v), exploded:false}));
const bit=i=>1<<i;
const pop=n=>{let c=0;for(;n;n&=n-1)c++;return c;};
// Independent full-layout oracle; no frontier or binomial weighting.
function corpus(rows,cols) {
  const n=rows*cols, full=bit(n)-1, cases=new Map();
  const neighbors=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>j).filter(j=>j!==i&&Math.abs(Math.floor(i/cols)-Math.floor(j/cols))<=1&&Math.abs(i%cols-j%cols)<=1).reduce((m,j)=>m|bit(j),0));
  for(let layout=0;layout<full;layout++) {
    const safe=full^layout, mineCount=pop(layout);
    for(let shown=safe;;shown=(shown-1)&safe) {
      const clues=neighbors.map((m,i)=>shown&bit(i)?String(pop(m&layout)):".").join("");
      const key=`${mineCount}:${clues}`;
      let item=cases.get(key);
      if(!item) {item={mineCount,clues,shown,models:0,hits:Array(n).fill(0)};cases.set(key,item);}
      item.models++;
      for(let i=0;i<n;i++) if(layout&bit(i)) item.hits[i]++;
      if(!shown) break;
    }
  }
  return cases;
}
for(const [r,c] of [[2,2],[2,3],[3,3]]) test(`exact full-layout probabilities on every ${r}x${c} snapshot`, t=>{
  let snapshots=0, squares=0;
  for(const [key,x] of corpus(r,c)) {
    const board=boardOf(x.clues), before=JSON.stringify(board);
    const result=probability(r,c,x.mineCount,board);
    assert.equal(result.status,"complete",key);
    assert.equal(result.model,"uniform-compatible-layouts");
    assert.equal(result.totalLayouts,String(x.models),key);
    const expected=x.hits.flatMap((n,index)=>x.shown&bit(index)?[]:[{index,mineLayouts:String(n)}]);
    assert.deepEqual(result.squares,expected,key);
    const original=enumerateVisibleBoard(r,c,x.mineCount,board);
    assert.deepEqual(result.squares.filter(s=>s.mineLayouts==="0").map(s=>s.index),original.safe,key);
    assert.deepEqual(result.squares.filter(s=>s.mineLayouts===result.totalLayouts).map(s=>s.index),original.mines,key);
    assert.equal(result.nodes,original.nodes);
    assert.equal(JSON.stringify(board),before);
    snapshots++;squares+=expected.length;
  }
  t.diagnostic(JSON.stringify({snapshots,squares}));
});
test("unequal off-frontier multiplicities change the actual model fractions",()=>{
  const board=boardOf("1.1.........");
  const result=probability(3,4,2,board);
  assert.equal(enumerateVisibleBoard(3,4,2,board).frontierModels,5);
  assert.equal(result.totalLayouts,"11");
  assert.deepEqual(result.squares.map(s=>[s.index,s.mineLayouts]),[[1,"4"],[3,"1"],[4,"3"],[5,"4"],[6,"1"],[7,"1"],[8,"2"],[9,"2"],[10,"2"],[11,"2"]]);
});
test("flags and hidden adjacency values cannot change probabilities",()=>{
  const board=boardOf("1.1.........");
  const changed=board.map((v,i)=>v.revealed?v:{...v,flagged:true,adjacentMines:i});
  assert.deepEqual(probability(3,4,2,changed),probability(3,4,2,board));
});
test("limits return no partial counts even after finding valid layouts",()=>{
  const board=boardOf("1.1........."), full=probability(3,4,2,board);
  for(let n=1;n<full.nodes;n++) assert.deepEqual(probability(3,4,2,board,{maxNodes:n}),{status:"limited",squares:[],nodes:n});
  assert.deepEqual(probability(3,4,2,board,{maxNodes:full.nodes}),full);
  assert.deepEqual(probability(3,4,2,board,{maxFrontier:5}),{status:"limited",squares:[],nodes:0});
});
test("terminal, inconsistent and invalid inputs cannot produce probabilities",()=>{
  assert.equal(probability(2,2,1,boardOf("2...")).status,"inconsistent");
  assert.equal(probability(2,2,1,boardOf("9...")).status,"invalid");
  assert.equal(probability(2,2,1,boardOf("1..."),{maxNodes:100001}).status,"invalid");
  const terminal=boardOf("1...");terminal[1]={...terminal[1],revealed:true,exploded:true};
  assert.deepEqual(probability(2,2,1,terminal),{status:"terminal",squares:[],nodes:0});
});
test("large empty frontiers use exact JSON-safe counts, not rounded floats",()=>{
  for(const [r,c,m] of [[9,9,10],[16,16,40],[16,30,99],[50,50,1250]]) {
    const n=r*c,result=probability(r,c,m,boardOf(".".repeat(n)));
    assert.equal(result.status,"complete"); assert.equal(result.nodes,1);assert.equal(result.squares.length,n);
    const total=BigInt(result.totalLayouts);
    if(n>81) assert.ok(total>BigInt(Number.MAX_SAFE_INTEGER)); else assert.ok(total>0n);
    assert.ok(result.squares.every(s=>BigInt(s.mineLayouts)*BigInt(n)===total*BigInt(m)));
    assert.deepEqual(JSON.parse(JSON.stringify(result)),result);
  }
});
test("all square marginals sum to the public mine count on a nonempty frontier",()=>{
  const board=boardOf("1"+".".repeat(479));const result=probability(16,30,99,board);
  assert.equal(result.status,"complete");assert.equal(result.squares.length,479);
  assert.equal(result.squares.reduce((sum,s)=>sum+BigInt(s.mineLayouts),0n),99n*BigInt(result.totalLayouts));
});
test("zero mines and fully revealed safe boards have exact counts",()=>{
  const empty=probability(2,2,0,boardOf("...."));assert.equal(empty.totalLayouts,"1");assert.ok(empty.squares.every(s=>s.mineLayouts==="0"));
  const open=probability(2,2,0,boardOf("0000"));assert.equal(open.totalLayouts,"1");assert.deepEqual(open.squares,[]);
});
