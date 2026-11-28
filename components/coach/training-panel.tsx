"use client";

import { Fragment, useId, useRef, useState } from "react";
import { ChevronDown, GraduationCap } from "lucide-react";
import { newTrainingSession, prepareStarterTraining, trainingCellAnswer, updateTrainingSession, type TrainingAction, type TrainingCellInput } from "@/lib/coach/training-catalog";
import { explainTrainingAnswer, trainingGuidance, trainingPositionLabel } from "@/lib/coach/training-guidance";
import { prepareReviewTraining } from "@/lib/coach/training-from-review";
import type { CompletedGameAnalysis } from "@/lib/coach/practice-analysis";
import type { PreparedTrainingExercise, TrainingClassification } from "@/lib/coach/training-exercise";

const choices: TrainingClassification[] = ["safe", "mine", "uncertain"];


function TrainingWorkspace() {
  const [catalog] = useState(prepareStarterTraining);
  if (!catalog?.length) return <p role="alert">Training exercises are temporarily unavailable.</p>;
  return <TrainingBoardWorkspace catalog={catalog} />;
}

function TrainingBoardWorkspace({ catalog }: { catalog: readonly PreparedTrainingExercise[] }) {
  const [session, setSession] = useState(newTrainingSession);
  const [hintLevel, setHintLevel] = useState(0);
  const touchCell = useRef<number | null>(null);
  const prepared = catalog[session.position];
  const { exercise } = prepared;
  const { objective, rows, columns } = exercise;
  const promptId = useId();
  const axesId = useId();
  const target = objective.kind === "classify-square" ? objective.index : null;
  const attempt = session.attempt;
  const selectedIndex = attempt && "index" in attempt.answer ? attempt.answer.index : null;
  const selectedClass = attempt && "classification" in attempt.answer ? attempt.answer.classification : null;
  const dispatch = (action: TrainingAction) => {
    if (action.kind === "next" || action.kind === "previous") setHintLevel(0);
    setSession(current => updateTrainingSession(current, catalog, action));
  };
  const guidance = trainingGuidance(prepared, attempt?.status === "correct" ? attempt.answer : undefined);
  const visibleHint = attempt?.status === "correct" ? 3 : hintLevel;
  const feedback = attempt ? explainTrainingAnswer(prepared, attempt.answer) : null;
  function submitCell(index: number, input: TrainingCellInput) {
    const answer = trainingCellAnswer(objective, index, input);
    if (answer) dispatch({ kind: "answer", answer });
  }
  const prompt = objective.kind === "reveal-safe" ? "Left-click a covered square that is guaranteed safe to reveal." : objective.kind === "flag-mine" ? "Right-click an unflagged covered square that must contain a mine." : `Classify the highlighted square (${trainingPositionLabel(objective.index, columns)}).`;
  return (
    <div className="coach-training-workspace">
      <div className="coach-training-heading">
        <div>
          <p className="coach-training-kicker">Exercise {session.position + 1} of {catalog.length} · {exercise.difficulty}</p>
          <h3>{exercise.title}</h3>
          <p id={promptId}>{prompt}</p>
          {target === null && <p className="verified-note">On a touchscreen, tap a square. With a keyboard, focus a square and press Enter or Space to {objective.kind === "flag-mine" ? "flag" : "reveal"} it.</p>}
        </div>
        <span className="coach-training-mine-count">Total mines: {exercise.mineCount}</span>
      </div>
      <p id={axesId} className="verified-note coach-training-axis-guide">Column numbers are above the board. Row numbers are on the left. Both start at 1.</p>
      <div className="coach-training-board-scroll">
        <div className="coach-training-board" role="group" aria-label={`Training puzzle board, ${rows} rows and ${columns} columns`} aria-describedby={`${promptId} ${axesId}`} style={{ gridTemplateColumns: `32px repeat(${columns}, minmax(0, 1fr))`, width: `min(100%, ${columns * 52 + 36}px)`, minWidth: columns * 28 + 36 }}>
          <span className="coach-training-axis" aria-hidden="true" />
          {Array.from({ length: columns }, (_, column) => <span key={`column-${column}`} className="coach-training-axis coach-training-column-number" aria-hidden="true">{column + 1}</span>)}
          {exercise.cells.map((cell, index) => {
            const state = typeof cell === "number" ? "revealed" : cell;
            const label = `${trainingPositionLabel(index, columns)}, ${typeof cell === "number" ? `${cell} adjacent mines` : cell === "flagged" ? "flagged, not proven" : "covered"}${target === index ? ", highlighted target" : ""}`;
            const result = selectedIndex === index ? attempt?.status : undefined;
            const hint = visibleHint >= 3 && guidance.index === index ? "solution" : visibleHint >= 2 && guidance.related.includes(index) ? "related" : visibleHint >= 1 && (visibleHint >= 3 ? guidance.clues : guidance.locate).includes(index) ? "clue" : undefined;
            const hintLabel = hint ? `, ${hint === "solution" ? "explained square" : hint === "related" ? "related covered square" : "supporting clue"}` : "";
            const content = typeof cell === "number" ? (cell === 0 ? "" : cell) : cell === "flagged" ? "⚑" : "";
            // The snapshot never changes. Feedback marks a choice, not a real reveal/flag.
            return <Fragment key={index}>
              {index % columns === 0 && <span className="coach-training-axis coach-training-row-number" aria-hidden="true">{Math.floor(index / columns) + 1}</span>}
              {target === null && cell === "covered" ? (
              <button key={index} type="button" className="coach-training-cell" data-state={state} data-result={result} data-hint={hint} aria-label={`${label}${hintLabel}${result ? `, ${result} choice` : ""}, ${objective.kind === "flag-mine" ? "flag" : "reveal"}`} aria-disabled={attempt !== null}
                onPointerDown={event => { touchCell.current = event.pointerType === "touch" || event.pointerType === "pen" ? index : null; }}
                onPointerCancel={() => { touchCell.current = null; }}
                onClick={event => {
                  const activate = event.detail === 0 || touchCell.current === index;
                  touchCell.current = null;
                  if (event.button === 0) submitCell(index, activate ? "activate" : "reveal");
                }}
                onContextMenu={event => {
                  event.preventDefault();
                  touchCell.current = null;
                  submitCell(index, "flag");
                }}>{result ? (result === "correct" ? (objective.kind === "flag-mine" ? "⚑" : "✓") : "×") : content}</button>
            ) : (
              <span key={index} role="img" aria-label={`${label}${hintLabel}`} data-hint={hint} className="coach-training-cell" data-state={state} data-clue={typeof cell === "number" ? cell : undefined} data-target={target === index ? "true" : undefined}>{content}</span>
            )}
            </Fragment>;
          })}
        </div>
      </div>
      {target !== null && <div className="coach-training-classifications" role="group" aria-label="Square classification">
        {choices.map(choice => <button key={choice} type="button" className="coach-btn secondary" aria-pressed={selectedClass === choice} aria-disabled={attempt !== null} data-result={selectedClass === choice ? attempt?.status : undefined} onClick={() => dispatch({ kind: "answer", answer: { classification: choice } })}>{choice === "safe" ? "Guaranteed safe" : choice === "mine" ? "Guaranteed mine" : "Uncertain"}</button>)}
      </div>}
      <p className="verified-note">Flags are marks, not proof. Use the visible clues and the total mine count.</p>
      <div className="coach-training-feedback" role="status" aria-atomic="true" data-result={attempt?.status}>
        {attempt ? <><strong>{attempt.status === "correct" ? "Correct!" : "Not quite."}</strong>{" "}{attempt.status === "correct" ? feedback : `${feedback ?? "That answer is not supported by the visible board."} Retry to make another choice or use a hint.`}</> : "Choose an answer to check your deduction."}
      </div>
      <div className="coach-training-guidance">
        <button type="button" className="coach-btn secondary" disabled={visibleHint >= 3} onClick={() => setHintLevel(level => Math.min(3, level + 1))}>{visibleHint === 0 ? "Get a hint" : visibleHint === 1 ? "Next hint" : visibleHint === 2 ? "Show full explanation" : "Explanation shown"}</button>
        <div aria-live="polite">
          {visibleHint >= 1 && <p><strong>Hint 1 — Where to look:</strong> {guidance.hint1}</p>}
          {visibleHint >= 2 && <p><strong>Hint 2 — Reason it through:</strong> {guidance.hint2}</p>}
          {visibleHint >= 3 && <div className="coach-training-proof"><h4>Full explanation</h4><p>{guidance.conclusion} {guidance.flagNote}</p>{guidance.steps.length > 0 && <ol>{guidance.steps.map((step, i) => <li key={i}><strong>{step.title}</strong> — {step.text}</li>)}</ol>}<p className="verified-note">Yellow outlines indicate supporting clues, blue outlines indicate related squares, and the white outline identifies the explained square (not necessarily safe).</p></div>}
        </div>
      </div>
      <div className="coach-training-actions">
        <button type="button" className="coach-btn secondary" disabled={session.position === 0} onClick={() => dispatch({ kind: "previous" })}>Previous</button>
        <button type="button" className="coach-btn secondary" disabled={!attempt} onClick={() => dispatch({ kind: "retry" })}>Retry</button>
        <button type="button" className="coach-btn" disabled={session.position === catalog.length - 1} onClick={() => dispatch({ kind: "next" })}>{attempt?.status === "correct" ? "Next exercise" : "Skip exercise"}</button>
      </div>
      <p className="verified-note">Training is separate from Practice and Ranked. Attempts are not saved yet.</p>
    </div>
  );
}

/** Lazy mount on first open, then preserve the current exercise when collapsed. */
export function TrainingPanel() {
  const [expanded, setExpanded] = useState(false);
  const [started, setStarted] = useState(false);
  return (
    <section className="coach-training-panel" aria-labelledby="coach-training-title">
      <h2 id="coach-training-title"><button type="button" className="profile-history-toggle" aria-expanded={expanded} aria-controls="coach-training-body" onClick={() => { setStarted(true); setExpanded(current => !current); }}><GraduationCap size={20} aria-hidden="true" /> Interactive training <ChevronDown size={18} aria-hidden="true" className={expanded ? "profile-history-chevron" : "profile-history-chevron is-collapsed"} /></button></h2>
      <p className="verified-note">Practice deductions on small, mathematically verified boards. No account needed.</p>
      <div id="coach-training-body" hidden={!expanded}>{started && <TrainingWorkspace />}</div>
    </section>
  );
}

/** Explicit, local practice from the already open completed review. Unmounts
 * with the review; no account identifiers, hidden layouts or training writes. */
export function ReviewTrainingPanel({ analysis }: { analysis: CompletedGameAnalysis }) {
  const [catalog, setCatalog] = useState<PreparedTrainingExercise[] | null>(null);
  const hasMistakes = analysis.reviewed.some(frame => frame.decision === "mistake");
  if (!hasMistakes) return null;
  return <section className="coach-training-panel coach-review-training" aria-label="Train from your mistakes">
    <h2>Train from your mistakes</h2>
    <p className="verified-note">Try a verified puzzle using the complete visible board before a mistake in this review. Up to three exercises are available.</p>
    {catalog === null ? <button type="button" className="coach-btn secondary" onClick={() => setCatalog(prepareReviewTraining({ rows: analysis.game.rows, columns: analysis.game.columns, mineCount: analysis.game.mineCount }, analysis.reviewed))}>Practice my mistakes</button> : catalog.length ? <TrainingBoardWorkspace catalog={catalog} /> : <p role="status">No supported exercise could be fully verified from the first few mistakes. Try the starter exercises in Coaching instead.</p>}
  </section>;
}
