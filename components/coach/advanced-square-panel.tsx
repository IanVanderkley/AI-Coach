import { useState } from "react";
import { inspectAdvanced, overlapEvidence, overlapRegions, type AdvancedSnapshot } from "@/lib/coach/advanced-square-analysis";
import { TeachingProof } from "@/components/coach/teaching-proof";
import { replayCellGlyph, localSquareBounds } from "@/lib/coach/square-coach-presentation";
import { cellLabel } from "@/lib/coach/teaching-review";
import type { SquareAnalysis } from "@/lib/coach/square-analysis";

function OverlapLesson({ proof, index }: { proof: SquareAnalysis; index: number }) {
  const [phase, setPhase] = useState(0);
  const certificate = overlapEvidence(proof);
  if (!certificate) return null;
  const { board, columns } = proof.explanation;
  const [a,b,c] = certificate.groups;
  const { onlyA, onlyB, shared } = overlapRegions(certificate);
  const bounds = localSquareBounds(index, board.length / columns, columns);
  const evidence = certificate.groups.flatMap(g => [...g.cells, ...g.knownMines, ...g.knownSafe, ...(g.clue === null ? [] : [g.clue])]);
  for (const i of evidence) {
    const r = Math.floor(i / columns), col = i % columns;
    bounds.top = Math.min(bounds.top, r); bounds.bottom = Math.max(bounds.bottom, r);
    bounds.left = Math.min(bounds.left, col); bounds.right = Math.max(bounds.right, col);
  }
  const marks = new Map<number,string>();
  for (const g of phase === 0 ? [a] : certificate.groups) {
    for (const i of g.knownMines) marks.set(i,"M");
    for (const i of g.knownSafe) marks.set(i,"✓");
  }
  for (const i of onlyA) marks.set(i,"A");
  for (const i of shared) marks.set(i,phase === 0 ? "A" : "AB");
  if (phase > 0) for (const i of onlyB) marks.set(i,"B");
  if (phase === 2) for (const i of certificate.result) marks.set(i,certificate.mineCount === 0 ? "SAFE" : "MINE");
  if (a.clue !== null) marks.set(a.clue,"A clue");
  if (phase > 0 && b.clue !== null) marks.set(b.clue,"B clue");
  if (phase > 0 && c && c.clue !== null) marks.set(c.clue,"C clue");
  const cols = Array.from({length:bounds.right-bounds.left+1},(_,i)=>bounds.left+i);
  const rows = Array.from({length:bounds.bottom-bounds.top+1},(_,i)=>bounds.top+i);
  const name = (g: typeof a) => g.clue === null ? "the board's total mine count" : `the ${g.originalCount} at ${cellLabel(g.clue, columns)}`;
  const selectedInResult = certificate.result.includes(index);
  const sharedText = certificate.sharedMin === certificate.sharedMax ? `exactly ${certificate.sharedMin}` : `between ${certificate.sharedMin} and ${certificate.sharedMax}`;
  return <div className="coach-advanced-overlap">
    <h5>{selectedInResult ? "Why this square is certain" : "An earlier deduction in this proof"}</h5>
    <p>Actual evidence board · cyan outline marks your square. Letters identify overlapping groups.</p>
    <div className="coach-square-local-scroll" role="region" aria-label="Overlap evidence board" tabIndex={0}>
      <div className="coach-square-local-grid" style={{gridTemplateColumns:`20px repeat(${cols.length}, 36px)`}}>
        <span aria-hidden="true"/>{cols.map(col=><span className="coach-board-coordinate" key={`c${col}`}>{col+1}</span>)}
        {rows.flatMap(row=>[<span className="coach-board-coordinate" key={`r${row}`}>{row+1}</span>,...cols.map(col=>{
          const i=row*columns+col, cell=board[i], mark=marks.get(i);
          return <span key={i} className={`verified-cell ${cell.revealed?"verified-revealed":"verified-covered"} ${i===index?"coach-square-local-selected":""}`} data-overlap-mark={mark} role="img" aria-label={`${cellLabel(i,columns)}, ${cell.revealed?`revealed ${cell.adjacentMines}`:cell.flagged?"player flag":"covered"}${mark?`, ${mark}`:""}`}>
            {replayCellGlyph(cell)}{mark&&<span className="coach-advanced-marker" aria-hidden="true">{mark}</span>}
          </span>;
        })])}
      </div>
    </div>
    <p>A = blue · B = purple · AB = shared · M/✓ = earlier proven mine/safe. SAFE/MINE marks the conclusion.</p>
    <div className="coach-visual-step" aria-live="polite">
      <strong>Step {phase+1} of 3</strong>
      {phase===0?<p>Start with group A, from {name(a)}. After earlier deductions, its {a.cells.length} covered squares need {a.remainingMines} mines.</p>:phase===1?<p>Group B, from {name(b)}, needs {b.remainingMines} mines in {b.cells.length} covered squares. Both groups count the {shared.length} shared AB squares. {c?`Group C, from ${name(c)}, covers their union and needs ${c.remainingMines} mines. `:""}The shared area must contain {sharedText} mines.</p>:<p>The {certificate.region === "shared" ? "shared area" : certificate.region === "only-a" ? "A-only area" : "B-only area"} contains {certificate.mineCount} mines in {certificate.result.length} squares. {certificate.mineCount===0?"Every marked result square is safe.":"Every marked result square is a mine."} {selectedInResult?"That includes your selected square.":"The full proof below shows how this leads to your selected square."}</p>}
    </div>
    <div className="coach-visual-controls"><button type="button" disabled={phase===0} onClick={()=>setPhase(p=>Math.max(0,p-1))}>Previous</button><button type="button" disabled={phase===2} onClick={()=>setPhase(p=>Math.min(2,p+1))}>Next step</button><button type="button" onClick={()=>setPhase(0)}>Restart lesson</button></div>
  </div>;
}

export function AdvancedSquarePanel({ snapshot, index, columns, onAnalyze, technical }: { snapshot: AdvancedSnapshot | null; index:number; columns:number; onAnalyze:()=>void; technical:boolean }) {
  const result = snapshot ? inspectAdvanced(snapshot,index) : null;
  return <section className="coach-advanced-square" aria-label="Advanced square analysis">
    <h5>Advanced logic and risk</h5>
    <p className="coach-square-local-note">The basic analysis above uses the original deduction rules.</p>
    {!snapshot ? <><p>Go beyond basic deductions. Analyze this evidence snapshot without changing the replay or its grade.</p><div className="coach-visual-controls"><button type="button" onClick={onAnalyze}>Analyze risk and advanced logic</button></div></> : !result ? <p role="status">Advanced analysis is unavailable for this evidence. No additional claims are made.</p> : <>
      {result.proof && <><p><strong>Advanced result: {result.proof.classification === "proven-safe" ? "Proven safe" : "Proven mine"}</strong></p>
        <OverlapLesson key={index} proof={result.proof} index={index}/><TeachingProof explanation={result.proof.explanation} expanded={false} technical={technical}/></>}
      {result.risk ? <>
        {!result.proof && <p><strong>{result.risk.certainty === "safe" ? "Proven safe by exhaustive search" : result.risk.certainty === "mine" ? "Proven mine by exhaustive search" : "Still uncertain"}</strong></p>}
        <div className="coach-advanced-risks"><div>Mine risk <strong>{result.risk.mine}</strong></div><div>Survival chance <strong>{result.risk.survival}</strong></div></div>
        <p>{result.risk.certainty === "safe" ? "No compatible mine layout places a mine here." : result.risk.certainty === "mine" ? "Every compatible mine layout places a mine here." : "Some compatible mine layouts put a mine here, and others do not."}</p>
        <p>Risk assumes all compatible full-board mine layouts are equally likely. Actual generation rules may change these odds. Flags are not evidence.</p>
        {result.risk.best.length>0&&<p><strong>Lower-risk alternatives:</strong> {result.risk.best.slice(0,4).map(i=>cellLabel(i,columns)).join("; ")}{result.risk.best.length>4?` and ${result.risk.best.length-4} more at the same model risk`:""}. Calculated mine risk: {result.risk.bestMine}. These unflagged squares have the lowest calculated risk among alternatives; lower risk is not necessarily safe.</p>}
        <details><summary>Exact compatible layout counts</summary><p>Layouts with a mine: {result.risk.numerator}</p><p>Total compatible layouts: {result.risk.denominator}</p></details>
      </> : <p>Probability search reached its work limit. No incomplete counts or estimated percentages are displayed.</p>}
    </>}
  </section>;
}
