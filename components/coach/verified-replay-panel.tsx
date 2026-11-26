"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  ShieldCheck,
  SkipBack,
  SkipForward,
} from "lucide-react";
import {
  type Proof,
  type ReplayFrame,
  type VisibleCell,
} from "@/lib/coach/verified-replay";
import { prioritizeMoments, recommendedReveal } from "@/lib/coach/visual-coaching";
import type { CoachPreferences } from "@/lib/settings/types";
import { reviewProofOptions } from "@/lib/coach/review-presentation";
import type { PracticeAnalysis } from "@/lib/coach/practice-analysis";
import { explainMove, timelineMove, cellLabel } from "@/lib/coach/teaching-review";
import { TeachingProof } from "@/components/coach/teaching-proof";
import { describeReplayRows } from "@/lib/coach/replay-accessibility";
import { useReplayTooltips } from "@/lib/settings/replay-tooltips";
import { useReplayView, type ReplayView } from "@/lib/settings/replay-view";
import type { PracticeSession } from "@/lib/practice/history";

const numberClasses: Record<number, string> = {
  1: "number-one",
  2: "number-two",
  3: "number-three",
  4: "number-four",
  5: "number-five",
  6: "number-six",
  7: "number-seven",
  8: "number-eight",
};
type BoardViewProps = {
  cells: readonly VisibleCell[];
  columns: number;
  selectedIndex: number;
  title: string;
  safeProofs: readonly Proof[];
  mineProofs: readonly Proof[];
  recommendation?: number | null;
  decision: ReplayFrame["decision"];
  clues?: readonly number[];
  targets?: readonly number[];
  tooltips: boolean;
};
function BoardView({
  cells,
  columns,
  selectedIndex,
  title,
  safeProofs,
  mineProofs,
  recommendation,
  decision,
  clues = [],
  targets = [],
  tooltips,
}: BoardViewProps) {
  const [textOpen, setTextOpen] = useState(false);
  const safe = new Set(safeProofs.map((p) => p.index));
  const mines = new Set(mineProofs.map((p) => p.index));
  const sources = new Set(clues);
  const taught = new Set(targets);
  const boardStyle: CSSProperties = {
    gridTemplateColumns: `24px repeat(${columns}, 36px)`,
  };
  return (
    <div className="verified-board-panel">
      <h4>{title}</h4>
      <div
        className="verified-board-scroll"
        tabIndex={0}
        role="region"
        aria-label={`${title}, scrollable board`}
      >
        <div
          className="verified-board"
          style={boardStyle}
          role="img"
          aria-label={`${title}. ${cells.length / columns} rows, ${columns} columns. ${cellLabel(selectedIndex, columns)} is the chosen square.`}
        >
          <span className="coach-board-coordinate" aria-hidden="true" />
          {Array.from({ length: columns }, (_, col) => (
            <span
              key={`col-${col}`}
              className="coach-board-coordinate"
              aria-hidden="true"
            >
              {col + 1}
            </span>
          ))}
          {cells.map((cell, index) => {
            const number = cell.revealed && !cell.exploded ? cell.adjacentMines : null;
            const proof =
              !cell.revealed &&
              (safe.has(index) ? "proven safe" : mines.has(index) ? "proven mine" : null);
            const fact = cell.exploded
              ? "exploded mine"
              : cell.revealed
                ? `revealed ${number ?? "mine"}`
                : cell.flagged
                  ? "player flag"
                  : "covered";
            const selected = index === selectedIndex;
            return (
              <BoardCell
                key={index}
                rowLabel={index % columns === 0 ? Math.floor(index / columns) + 1 : null}
              >
                <span
                  className={[
                    "verified-cell",
                    cell.revealed ? "verified-revealed" : "verified-covered",
                    cell.exploded ? "verified-exploded" : "",
                    cell.flagged ? "verified-flagged" : "",
                    selected ? "verified-selected" : "",
                    index === recommendation ? "verified-recommended" : "",
                    sources.has(index) ? "verified-clue" : "",
                    taught.has(index) ? "verified-teaching-target" : "",
                    proof === "proven safe" ? "verified-safe" : "",
                    proof === "proven mine" ? "verified-mine" : "",
                    number !== null && number > 0 ? (numberClasses[number] ?? "") : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-decision={selected ? decision : undefined}
                  data-tip={
                    tooltips
                      ? `${cellLabel(index, columns)}: ${fact}${proof ? `, ${proof}` : ""}${sources.has(index) ? ", supporting clue" : ""}`
                      : undefined
                  }
                  aria-hidden="true"
                >
                  {cell.exploded || (cell.revealed && number === null)
                    ? "✹"
                    : cell.flagged
                      ? "⚑"
                      : number !== null
                        ? number || ""
                        : proof === "proven safe"
                          ? "✓"
                          : proof === "proven mine"
                            ? "!"
                            : ""}
                </span>
              </BoardCell>
            );
          })}
        </div>
      </div>
      <details
        className="coach-board-text"
        onToggle={(event) => setTextOpen(event.currentTarget.open)}
      >
        <summary>Read {title.toLowerCase()} as text</summary>
        {textOpen && (
          <ul tabIndex={0} aria-label={`${title}, row by row`}>
            {describeReplayRows(
              cells,
              columns,
              selectedIndex,
              safe,
              mines,
              sources,
              recommendation,
            ).map((row, index) => (
              <li key={index}>{row}</li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}
function BoardCell({
  rowLabel,
  children,
}: {
  rowLabel: number | null;
  children: ReactNode;
}) {
  return (
    <>
      {rowLabel !== null && (
        <span className="coach-board-coordinate" aria-hidden="true">
          {rowLabel}
        </span>
      )}
      {children}
    </>
  );
}

export function VerifiedReplayPanel({
  game,
  analysis,
  preferences,
  focusMoveNumber,
  focusRequestId,
}: {
  game: PracticeSession;
  analysis: PracticeAnalysis;
  preferences?: CoachPreferences | null;
  focusMoveNumber?: number | null;
  focusRequestId?: number;
}) {
  const start = analysis.opening;
  const frames = useMemo(() => analysis.replay.frames.slice(start), [analysis, start]);
  const important = useMemo(
    () =>
      prioritizeMoments(analysis.report, preferences).map((moment) => ({
        frame: analysis.replay.frames[moment.moveNumber - 1],
        index: moment.moveNumber - start - 1,
        category: moment.category,
      })),
    [analysis, preferences, start],
  );
  const last = Math.max(0, frames.length - 1);
  const [cursor, setCursor] = useState<number | null>(null);
  const { view: preferredView } = useReplayView();
  const [viewOverride, setBoardMode] = useState<ReplayView | null>(null);
  const boardMode = viewOverride ?? preferredView;
  const [showProofs, setShowProofs] = useState(true);
  const [playing, setPlaying] = useState(false);
  const { enabled: tooltips } = useReplayTooltips();
  const position = Math.max(0, Math.min(last, cursor ?? important[0]?.index ?? 0));
  const selectedIndex = timelineMove(position, last);
  const current = frames[selectedIndex];
  useEffect(() => {
    setCursor(null);
    setPlaying(false);
    setBoardMode(null);
    setShowProofs(true);
  }, [game]);
  useEffect(() => {
    if (
      focusMoveNumber != null &&
      Number.isInteger(focusMoveNumber) &&
      focusMoveNumber > start + 1 &&
      focusMoveNumber <= start + frames.length
    ) {
      setCursor(focusMoveNumber - start - 1);
      setPlaying(false);
    }
  }, [focusMoveNumber, focusRequestId, start, frames.length]);
  useEffect(() => {
    if (!playing) return;
    let animation = 0;
    let initial: number | null = null;
    const from = position;
    function tick(now: number) {
      initial ??= now;
      const value = Math.min(last, from + (now - initial) / 850);
      setCursor(value);
      if (value >= last) setPlaying(false);
      else animation = window.requestAnimationFrame(tick);
    }
    animation = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animation);
    // Start one animation per playback session, not on every fractional tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, last]);
  const explanation = useMemo(
    () =>
      current && selectedIndex > 0
        ? explainMove(current, game.rows, game.columns, game.mineCount)
        : undefined,
    [current, selectedIndex, game.rows, game.columns, game.mineCount],
  );
  const detail = preferences?.explanationDetail ?? "standard";
  const proofOptions = reviewProofOptions(detail);
  function goTo(index: number) {
    setPlaying(false);
    setCursor(timelineMove(index, last));
  }
  const tip = (label: string) => (tooltips ? label : undefined);
  if (!current)
    return (
      <section className="verified-report" aria-label="Verified replay">
        <h3>Verified Replay</h3>
        <p role="alert">No recorded moves are available to replay.</p>
      </section>
    );
  const opening = selectedIndex === 0;
  const chosen = current.move.row * game.columns + current.move.col;
  const recommendation = opening ? null : recommendedReveal(current);
  const decision = opening ? "not-enough-evidence" : current.decision;
  const mode = opening && boardMode === "before" ? "after" : boardMode;
  return (
    <section
      className="verified-report"
      id="coach-replay-workspace"
      tabIndex={-1}
      aria-label="Verified gameplay analysis"
    >
      <div className="verified-heading">
        <div>
          <span className="subtle-label">YOUR GAME, MOVE BY MOVE</span>
          <h3>
            <ShieldCheck size={21} aria-hidden="true" /> Verified Move Review
          </h3>
          <p>
            {game.outcome === "win" ? "WIN" : "LOSS"} · {game.difficulty} · {game.rows} ×{" "}
            {game.columns} · {last} review moves
          </p>
        </div>
      </div>

      <p className="verified-note">
        Move 0 opens the board and is not assessed. Uncertain moves are not automatically
        mistakes or unavoidable guesses.
      </p>
      {important.length > 0 && (
        <div className="verified-moments">
          <h4>Key lessons</h4>
          <div className="verified-moment-buttons">
            {important.map(({ frame, index, category }) => (
              <button
                key={index}
                type="button"
                className={`verified-moment${index === selectedIndex ? " active" : ""}`}
                data-kind={frame.decision}
                onClick={() => goTo(index)}
                aria-pressed={index === selectedIndex}
              >
                Move {index} · {category}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="verified-move-nav">
        <button
          type="button"
          className="coach-replay-nav"
          data-tip={tip("Go to the previous recorded move")}
          onClick={() => goTo(selectedIndex - 1)}
          disabled={selectedIndex === 0}
        >
          <ChevronLeft size={17} aria-hidden="true" /> Previous
        </button>
        <label>
          <span>Move</span>
          <select
            value={selectedIndex}
            onChange={(event) => goTo(Number(event.target.value))}
          >
            {frames.map((frame, index) => (
              <option value={index} key={index}>
                {index === 0
                  ? "Move 0: opening reveal"
                  : `#${index}: ${frame.move.action} (${frame.move.row + 1}, ${frame.move.col + 1})`}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="coach-replay-nav"
          data-tip={tip("Go to the next recorded move")}
          onClick={() => goTo(selectedIndex + 1)}
          disabled={selectedIndex === last}
        >
          Next <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>
      <label className="coach-replay-timeline">
        <span>
          Move {selectedIndex} of {last}
        </span>
        <input
          type="range"
          min={0}
          max={last || 1}
          step="any"
          value={position}
          disabled={last === 0}
          aria-label="Replay timeline"
          aria-valuetext={`Move ${selectedIndex} of ${last}`}
          style={
            {
              "--replay-progress": `${last ? (position / last) * 100 : 0}%`,
            } as CSSProperties
          }
          onChange={(event) => {
            setPlaying(false);
            setCursor(Number(event.target.value));
          }}
          onKeyDown={(event) => {
            if (
              ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "Home", "End"].includes(
                event.key,
              )
            ) {
              event.preventDefault();
              goTo(
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? last
                    : selectedIndex +
                      (["ArrowLeft", "ArrowDown"].includes(event.key) ? -1 : 1),
              );
            }
          }}
        />
      </label>
      <div className="coach-replay-toolbar" aria-label="Replay controls">
        <div className="coach-replay-control-group">
          <button
            type="button"
            aria-label="First move"
            data-tip={tip("Return to the opening board (Move 0)")}
            onClick={() => goTo(0)}
            disabled={selectedIndex === 0}
          >
            <SkipBack size={19} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="coach-playback"
            aria-label={playing ? "Pause replay" : "Play replay"}
            data-tip={tip(playing ? "Pause replay" : "Play the recorded moves")}
            disabled={last === 0}
            onClick={() => {
              if (playing) {
                setPlaying(false);
                return;
              }
              if (position >= last) setCursor(0);
              setPlaying(true);
            }}
          >
            {playing ? (
              <Pause size={21} fill="currentColor" aria-hidden="true" />
            ) : (
              <Play size={21} fill="currentColor" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            aria-label="Last move"
            data-tip={tip("Jump to the final move")}
            onClick={() => goTo(last)}
            disabled={selectedIndex === last}
          >
            <SkipForward size={19} aria-hidden="true" />
          </button>
        </div>
        <div className="coach-replay-control-group">
          {(["before", "after", "compare"] as const).map((view) => (
            <button
              key={view}
              type="button"
              aria-pressed={mode === view}
              disabled={opening && view === "before"}
              data-tip={tip(
                view === "before"
                  ? "Inspect the information available before the move"
                  : view === "after"
                    ? "See what happened after the move"
                    : "Compare the boards before and after the action",
              )}
              onClick={() => {
                setBoardMode(view);
                setPlaying(false);
              }}
            >
              {view === "compare"
                ? "Compare"
                : view === "before"
                  ? "Before move"
                  : "After move"}
            </button>
          ))}
        </div>
        <label
          data-tip={tip(
            "Highlight proven safe cells, mines, and the numbered clues used in the explanation",
          )}
        >
          <input
            type="checkbox"
            checked={showProofs}
            onChange={(event) => setShowProofs(event.target.checked)}
          />{" "}
          Show deductions
        </label>
      </div>
      <div className="coach-review-workspace" data-view={mode}>
        <div className="coach-review-board-pane">
          <div className={`verified-boards ${mode === "compare" ? "" : "single-board"}`}>
            {mode !== "after" && (
              <BoardView
                title={`Before move ${selectedIndex}`}
                cells={current.before}
                columns={game.columns}
                selectedIndex={chosen}
                safeProofs={showProofs ? current.deductions.safe : []}
                mineProofs={showProofs ? current.deductions.mines : []}
                recommendation={showProofs ? recommendation : null}
                clues={showProofs ? explanation?.clues : []}
                targets={showProofs ? explanation?.targets : []}
                decision={decision}
                tooltips={tooltips}
              />
            )}
            {mode !== "before" && (
              <BoardView
                title={opening ? "Opening board · Move 0" : `After move ${selectedIndex}`}
                cells={current.after}
                columns={game.columns}
                selectedIndex={chosen}
                safeProofs={[]}
                mineProofs={[]}
                decision={decision}
                tooltips={tooltips}
              />
            )}
          </div>
          <p className="verified-legend">
            ✓ safe · ! mine · ⚑ player flag · blue numbered clue = proof source · dashed
            green outline = suggested reveal · solid outline = chosen square.
          </p>
        </div>
        <div className="coach-review-insight-pane">
          <div className="verified-decision" data-decision={decision}>
            <strong>
              {opening
                ? "Move 0 · Opening reveal"
                : current.decision === "good"
                  ? "Proven good decision"
                  : current.decision === "mistake"
                    ? "Verified mistake"
                    : "Not enough evidence"}
            </strong>
            <span>
              {current.move.action} at {cellLabel(chosen, game.columns)}
            </span>
            <p>
              {opening
                ? "This reveal establishes the starting board. It is excluded from the coaching assessment."
                : current.changed
                  ? explanation?.summary || current.explanation
                  : "This action did not change the visible board."}
            </p>
          </div>
          {showProofs && mode !== "after" && recommendation !== null && (
            <p className="verified-note">
              Recommended safe reveal: {cellLabel(recommendation, game.columns)}. The
              dashed green outline marks this square.
            </p>
          )}
          {!opening && explanation?.nextStep && (
            <div className="coach-lesson-next">
              <strong>Use this in your next game</strong>
              <p>{explanation.nextStep}</p>
            </div>
          )}
          {!opening && (
            <TeachingProof
              key={`${current.actionNumber}-${detail}`}
              explanation={explanation}
              expanded={proofOptions.expanded}
              technical={proofOptions.technical}
            />
          )}
        </div>
      </div>
    </section>
  );
}
