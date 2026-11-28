import { TeachingProof } from "@/components/coach/teaching-proof";
import type { SquareAnalysis, SquareClassification } from "@/lib/coach/square-analysis";
import { describeSquareCoach, localSquareBounds, replayCellGlyph, relativeSquare } from "@/lib/coach/square-coach-presentation";
import { cellLabel } from "@/lib/coach/teaching-review";

const labels: Record<SquareClassification, string> = {
  "proven-safe": "Proven safe",
  "proven-mine": "Proven mine",
  unresolved: "Unresolved",
  revealed: "Revealed",
};
const numberClasses = ["", "number-one", "number-two", "number-three", "number-four", "number-five", "number-six", "number-seven", "number-eight"];

function LocalEvidenceBoard({ analysis, index, clues }: { analysis: SquareAnalysis; index: number; clues: number[] }) {
  const { board, columns } = analysis.explanation;
  const bounds = localSquareBounds(index, board.length / columns, columns);
  const { top, bottom, left, right } = bounds;
  const rows = Array.from({ length: bottom - top + 1 }, (_, r) => top + r);
  const cols = Array.from({ length: right - left + 1 }, (_, c) => left + c);
  const inside = (i: number) => Math.floor(i / columns) >= top && Math.floor(i / columns) <= bottom && i % columns >= left && i % columns <= right;
  const outside = clues.filter(i => !inside(i));
  return (
    <figure className="coach-square-local">
      <figcaption>Actual replay board around your square</figcaption>
      <div className="coach-square-local-scroll" role="region" aria-label="Local evidence board" tabIndex={0}>
        <div className="coach-square-local-grid" style={{ gridTemplateColumns: `20px repeat(${cols.length}, 36px)` }}>
          <span aria-hidden="true" />
          {cols.map(c => <span key={`col-${c}`} className="coach-board-coordinate" aria-hidden="true">{c + 1}</span>)}
          {rows.flatMap(r => [
            <span key={`row-${r}`} className="coach-board-coordinate" aria-hidden="true">{r + 1}</span>,
            ...cols.map(c => {
              const i = r * columns + c;
              const cell = board[i];
              const isClue = clues.includes(i);
              const selected = i === index;
              const fact = cell.exploded ? "exploded mine" : cell.revealed ? cell.adjacentMines === null ? "revealed mine" : `revealed ${cell.adjacentMines}` : cell.flagged ? "player flag" : "covered";
              const className = ["verified-cell", cell.revealed ? "verified-revealed" : "verified-covered", cell.exploded ? "verified-exploded" : "", cell.flagged ? "verified-flagged" : "", cell.revealed && cell.adjacentMines !== null ? numberClasses[cell.adjacentMines] : "", selected ? "coach-square-local-selected" : "", isClue ? "coach-square-local-clue" : ""].filter(Boolean).join(" ");
              return <span key={i} className={className} role="img" aria-label={`${cellLabel(i, columns)}, ${fact}${selected ? ", selected square" : ""}${isClue ? ", clue in final deduction" : ""}`}>{replayCellGlyph(cell)}</span>;
            }),
          ])}
        </div>
      </div>
      <p className="coach-square-local-key"><span>Blue outline: your square</span>{clues.length > 0 && <span>Purple outline: clue in the final deduction</span>}</p>
      {outside.length > 0 && <p className="coach-square-local-note">Outside this crop: {outside.map(i => `the ${board[i].adjacentMines} ${relativeSquare(index, i, columns)} (${cellLabel(i, columns)})`).join("; ")}. The full proof includes these clues.</p>}
    </figure>
  );
}

export function SquareAnalysisPanel({ analysis, index, columns, opening, technical }: {
  analysis: SquareAnalysis;
  index: number;
  columns: number;
  opening: boolean;
  technical: boolean;
}) {
  const { classification, flagNote, explanation } = analysis;
  const coach = describeSquareCoach(analysis, index);
  return (
    <section className="coach-square-analysis" aria-label="Inspected square analysis">
      <h4>Square analysis</h4>
      <p className="coach-square-scope">{opening ? "Opening board · after the opening reveal" : "Evidence before this move · even when viewing After"}</p>
      <div className="coach-square-heading" aria-live="polite" aria-atomic="true">
        <strong>{cellLabel(index, columns)}</strong>
        <span className="coach-square-classification" data-classification={classification}>{labels[classification]}</span>
      </div>
      <LocalEvidenceBoard analysis={analysis} index={index} clues={coach.clues} />
      <div className="coach-square-answer">
        <h5>{classification === "proven-safe" ? "Why is this square safe?" : classification === "proven-mine" ? "Why is this a mine?" : classification === "revealed" ? "What does this square tell you?" : "What can we tell so far?"}</h5>
        <p>{coach.text}</p>
        {flagNote && <p>{flagNote}</p>}
        {coach.prerequisite && <p className="coach-square-local-note">{coach.prerequisite}</p>}
      </div>
      {explanation.steps.length > 0 && <TeachingProof explanation={explanation} expanded={false} technical={technical} />}
    </section>
  );
}
