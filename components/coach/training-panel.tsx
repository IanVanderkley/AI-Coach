"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, GraduationCap } from "lucide-react";
import { newTrainingSession, prepareAdaptiveTraining, trainingCellAnswer, updateTrainingSession, type TrainingAction, type TrainingCellInput } from "@/lib/coach/training-catalog";
import { explainTrainingAnswer, trainingGuidance, trainingPositionLabel } from "@/lib/coach/training-guidance";
import { prepareReviewTraining } from "@/lib/coach/training-from-review";
import type { CompletedGameAnalysis } from "@/lib/coach/practice-analysis";
import type { PreparedTrainingExercise, TrainingClassification } from "@/lib/coach/training-exercise";

import { appendTrainingAttempt, readTrainingHistory, writeTrainingHistory, recommendTraining, trainingProgress, TRAINING_HISTORY_LIMIT, TRAINING_LEVELS, type TrainingHistoryEntry } from "@/lib/coach/training-progress";

const choices: TrainingClassification[] = ["safe", "mine", "uncertain"];


function browserStorage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

function TrainingWorkspace() {
  const [catalog] = useState(prepareAdaptiveTraining);
  const [progress, setProgress] = useState<{ history: TrainingHistoryEntry[]; available: boolean } | null>(null);
  const latest = useRef<typeof progress>(null);
  useEffect(() => {
    if (!catalog) return;
    const state = readTrainingHistory(browserStorage(), catalog.map(p => p.exercise.id));
    latest.current = state;
    setProgress(state);
  }, [catalog]);
  if (!catalog?.length) return <p role="alert">Training exercises are temporarily unavailable.</p>;
  if (!progress) return <p role="status">Loading training progress…</p>;
  const ids = catalog.map(p => p.exercise.id);
  function recordAttempt(entry: TrainingHistoryEntry) {
    const current = latest.current;
    if (!current) return;
    const storage = current.available ? browserStorage() : null;
    const stored = storage ? readTrainingHistory(storage, ids) : null;
    const history = appendTrainingAttempt(stored?.available ? stored.history : current.history, entry, ids);
    const state = { history, available: writeTrainingHistory(storage, history, ids) };
    latest.current = state;
    setProgress(state);
  }
  function resetProgress(): boolean {
    const current = latest.current;
    if (!current) return false;
    // If storage was unavailable, don't pretend the prior saved copy was cleared.
    const available = writeTrainingHistory(browserStorage(), [], ids);
    if (!available) return false;
    const state = { history: [], available };
    latest.current = state;
    setProgress(state);
    return true;
  }
  return <TrainingBoardWorkspace catalog={catalog} progress={progress} onAttempt={recordAttempt} onReset={resetProgress} />;
}

function TrainingBoardWorkspace({ catalog, progress, onAttempt, onReset }: { catalog: readonly PreparedTrainingExercise[]; progress?: { history: TrainingHistoryEntry[]; available: boolean }; onAttempt?: (entry: TrainingHistoryEntry) => void; onReset?: () => boolean }) {
  const [session, setSession] = useState(newTrainingSession);
  const sessionRef = useRef(session);
  const [hintLevel, setHintLevel] = useState(0);
  const hintRef = useRef(0);
  const seenHints = useRef(new Map<number, number>());
  const exposedAnswers = useRef(new Set<number>());
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const recommendation = progress ? recommendTraining(catalog, progress.history) : null;
  const stats = progress ? trainingProgress(progress.history) : null;
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
    const current = sessionRef.current;
    const next = updateTrainingSession(current, catalog, action);
    if (next === current) return;
    sessionRef.current = next;
    setSession(next);
    if (next.position !== current.position) {
      seenHints.current.set(current.position, hintRef.current);
      hintRef.current = seenHints.current.get(next.position) ?? 0;
      if (hintRef.current === 0) setHintLevel(0); else setHintLevel(hintRef.current);
      touchCell.current = null;
    }
    if (action.kind === "retry" && current.attempt?.status === "correct") { hintRef.current = 3; setHintLevel(3); }
    if (action.kind === "answer" && next.attempt) {
      onAttempt?.({ id: catalog[current.position].exercise.id, correct: next.attempt.status === "correct", hints: exposedAnswers.current.has(current.position) ? 3 : hintRef.current });
      // Correct feedback and classification feedback reveal the actual answer.
      // Subsequent attempts in this workspace are assisted, even after navigation.
      if (next.attempt.status === "correct" || catalog[current.position].exercise.objective.kind === "classify-square") {
        exposedAnswers.current.add(current.position);
      }
    }
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
      {progress && stats && recommendation && <div className="coach-training-progress">
        <div className="coach-training-progress-heading"><h3>Training progress</h3><span className="verified-note">{progress.available ? "Saved on this browser" : "Browser storage unavailable — progress is temporary"}</span></div>
        <div className="coach-training-progress-grid">
          <div><span>Recent attempts</span><strong>{stats.attempts}</strong></div>
          <div><span>Correct answers</span><strong>{stats.correct}</strong></div>
          <div><span>Different puzzles solved</span><strong>{stats.solved}/{catalog.length}</strong></div>
          <div><span>Assisted attempts</span><strong>{stats.assisted}</strong></div>
        </div>
        <p className="verified-note">Last {TRAINING_HISTORY_LIMIT} answers to general exercises, including retries. Assistance includes hints or an answer already shown during this training session. Shared by anyone using this browser. Not a skill rating.</p>
        <div className="coach-training-recommendation">
          <div><strong>Recommended: {recommendation.difficulty}</strong><p>{recommendation.reason}</p></div>
          <button className="coach-btn secondary" type="button" disabled={recommendation.position === session.position && !attempt} onClick={() => dispatch(recommendation.position === session.position ? {kind:"retry"} : {kind:"jump",position:recommendation.position})}>Practice recommended exercise</button>
        </div>
        <label className="coach-training-level">Choose difficulty <select value={exercise.difficulty} onChange={event => { const position = catalog.findIndex(p => p.exercise.difficulty === event.target.value); if (position >= 0) dispatch({kind:"jump",position}); }}>{TRAINING_LEVELS.map(level => <option key={level} value={level}>{level[0].toUpperCase() + level.slice(1)}</option>)}</select></label>
        <details className="coach-training-history"><summary>Recent training history</summary>
          {progress.history.length ? <ul>{progress.history.slice(-10).reverse().map((entry,i) => <li key={i}><span>{catalog.find(p => p.exercise.id === entry.id)?.exercise.title}</span><strong>{entry.correct ? "Correct" : "Incorrect"}</strong><small>{entry.hints === 0 ? "No assistance recorded" : entry.hints === 3 ? "Answer or full explanation shown" : `Hint level ${entry.hints}`}</small></li>)}</ul> : <p>No training answers yet.</p>}
          {confirmReset ? <div className="coach-training-actions"><span>Clear the training history saved in this browser?</span><button type="button" className="coach-btn secondary" onClick={() => setConfirmReset(false)}>Cancel</button><button type="button" className="coach-btn" onClick={() => { const cleared = onReset?.(); setConfirmReset(false); setResetMessage(cleared ? "Training history cleared." : "Could not clear saved history. Check browser storage settings."); }}>Clear history</button></div> : <button type="button" className="coach-btn secondary" disabled={!progress.history.length} onClick={() => {setConfirmReset(true);setResetMessage("");}}>Reset training history</button>}
          {resetMessage && <p role="status">{resetMessage}</p>}
        </details>
      </div>}
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
        <button type="button" className="coach-btn secondary" disabled={visibleHint >= 3} onClick={() => { hintRef.current = Math.min(3, hintRef.current + 1); setHintLevel(hintRef.current); }}>{visibleHint === 0 ? "Get a hint" : visibleHint === 1 ? "Next hint" : visibleHint === 2 ? "Show full explanation" : "Explanation shown"}</button>
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
      <p className="verified-note">Training is separate from Practice and Ranked. {progress ? "General exercise history stays on this browser, not your account." : "Personalized review attempts are temporary and are not saved."}</p>
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
    {catalog === null ? <button type="button" className="coach-btn secondary" onClick={() => setCatalog(prepareReviewTraining({ rows: analysis.game.rows, columns: analysis.game.columns, mineCount: analysis.game.mineCount, opening: analysis.opening }, analysis.reviewed))}>Practice my mistakes</button> : catalog.length ? <TrainingBoardWorkspace catalog={catalog} /> : <p role="status">No supported exercise could be fully verified from the first few mistakes. Try the starter exercises in Coaching instead.</p>}
  </section>;
}
