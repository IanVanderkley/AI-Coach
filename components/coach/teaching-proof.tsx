import { useState } from "react";
import type { TeachingExplanation } from "@/lib/coach/teaching-review";
import { describeTechnicalProof, proofStepIndices } from "@/lib/coach/proof-presentation";
import type { ProofVisual } from "@/lib/coach/verified-replay";
import { describeGroup, describeVisual, proofBounds } from "@/lib/coach/visual-proof";

function ProofBoard({
  visual,
  explanation,
}: {
  visual: ProofVisual;
  explanation: TeachingExplanation;
}) {
  const { board, columns } = explanation;
  const { top, bottom, left, right } = proofBounds(
    visual,
    board.length / columns,
    columns,
  );
  const [a, b] = visual.groups;
  const shared = new Set(a.cells);
  const result = new Set(visual.result);
  const knownMines = new Set(visual.groups.flatMap((group) => group.knownMines));
  const knownSafe = new Set(visual.groups.flatMap((group) => group.knownSafe));
  const indices = Array.from({ length: bottom - top + 1 }, (_, r) =>
    Array.from({ length: right - left + 1 }, (_, c) => (top + r) * columns + left + c),
  );
  return (
    <div
      className="coach-proof-board-scroll"
      tabIndex={0}
      role="region"
      aria-label="Proof board, scroll to inspect the squares"
    >
      <div
        className="coach-proof-grid"
        style={{ gridTemplateColumns: `24px repeat(${right - left + 1}, 36px)` }}
        role="img"
        aria-label="Cropped board before the move. A and B are numbered clues; question marks are shared unresolved squares; check marks are proven safe; M is a proven mine."
      >
        <span aria-hidden="true" />
        {Array.from({ length: right - left + 1 }, (_, c) => (
          <span key={c} className="coach-proof-coordinate" aria-hidden="true">
            {left + c + 1}
          </span>
        ))}
        {indices.flatMap((row, r) => [
          <span key={`row-${r}`} className="coach-proof-coordinate" aria-hidden="true">
            {top + r + 1}
          </span>,
          ...row.map((i) => {
            const cell = board[i];
            const clueA = a.clue === i,
              clueB = b?.clue === i;
            const kind =
              clueA || clueB
                ? "clue"
                : result.has(i)
                  ? visual.mineCount === 0
                    ? "safe"
                    : "mine"
                  : knownMines.has(i)
                    ? "known-mine"
                    : knownSafe.has(i)
                      ? "known-safe"
                      : shared.has(i)
                        ? "shared"
                        : cell.revealed
                          ? "revealed"
                          : "covered";
            const label =
              clueA || clueB
                ? `${cell.adjacentMines}${b ? (clueA ? " A" : " B") : ""}`
                : kind === "safe" || kind === "known-safe"
                  ? "✓"
                  : kind === "mine" || kind === "known-mine"
                    ? "M"
                    : kind === "shared"
                      ? "?"
                      : cell.revealed
                        ? cell.adjacentMines || ""
                        : cell.flagged
                          ? "⚑"
                          : "";
            return (
              <span
                key={i}
                className="coach-proof-cell"
                data-kind={kind}
                aria-hidden="true"
              >
                {label}
              </span>
            );
          }),
        ])}
      </div>
    </div>
  );
}

export function TeachingProof({
  explanation,
  fallback,
  expanded = true,
  technical = false,
}: {
  explanation?: TeachingExplanation;
  fallback?: string;
  expanded?: boolean;
  technical?: boolean;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);
  if (!explanation?.steps.length) return fallback ? <p>{fallback}</p> : null;
  const stepCount = explanation.steps.length;
  const currentStep = proofStepIndices(stepCount, stepIndex, false)[0];
  const visibleSteps = proofStepIndices(stepCount, currentStep, showAll);
  return (
    <details className="coach-proof-steps" open={expanded}>
      <summary>
        See why — {explanation.steps.length}{" "}
        {explanation.steps.length === 1 ? "step" : "steps"}
      </summary>
      <p className="coach-proof-rule">
        A number tells you how many mines touch it, including diagonals. A flag is your
        mark; the numbers must confirm it.
      </p>
      {stepCount > 1 && (
        <div className="coach-proof-navigation" aria-label="Deduction steps">
          <button
            type="button"
            disabled={showAll || currentStep === 0}
            onClick={() => setStepIndex(currentStep - 1)}
          >
            Previous step
          </button>
          <span role="status">
            {showAll
              ? `All ${stepCount} steps`
              : `Step ${currentStep + 1} of ${stepCount}`}
          </span>
          <button
            type="button"
            disabled={showAll || currentStep === stepCount - 1}
            onClick={() => setStepIndex(currentStep + 1)}
          >
            Next step
          </button>
          <button
            type="button"
            aria-pressed={showAll}
            onClick={() => setShowAll((value) => !value)}
          >
            {showAll ? "One step at a time" : "Show all steps"}
          </button>
        </div>
      )}
      <ol className="coach-proof-lessons" start={showAll ? 1 : currentStep + 1}>
        {visibleSteps.map((index) => {
          const step = explanation.steps[index];
          const visual = step.visual;
          if (!visual)
            return (
              <li key={index}>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
              </li>
            );
          const lesson = describeVisual(visual);
          return (
            <li key={index} className="coach-proof-lesson">
              <h5>
                <span className="coach-proof-step-number">{index + 1}</span>
                {lesson.title}
              </h5>
              <div className="coach-proof-split">
                <div className="coach-proof-visual">
              <ProofBoard visual={visual} explanation={explanation} />
              <div className="coach-proof-key">
                <span>Blue number = clue</span>
                {visual.groups.length > 1 && <span>Blue ? = shared squares</span>}
                <span>✓ = safe</span>
                <span>M = proven mine</span>
              </div>
                </div>
                <div className="coach-proof-copy">
              <p>{lesson.introduction}</p>
              {visual.groups.length > 1 && (
                <div className="coach-proof-equations">
                  {visual.groups.map((group, j) => (
                    <p key={j}>
                      <strong>{j === 0 ? "A" : "B"}:</strong>{" "}
                      {describeGroup(group, j === 0 ? "A" : "B")}
                    </p>
                  ))}
                </div>
              )}
              <p>{lesson.reasoning}</p>
              <p className="coach-proof-conclusion" data-safe={visual.mineCount === 0}>
                <strong>{lesson.conclusion}</strong>
              </p>
              <p className="coach-proof-habit">
                <strong>Remember:</strong> {lesson.habit}
              </p>
                </div>
              </div>
              <details className="coach-proof-technical" open={technical}>
                <summary>Exact numbers and coordinates</summary>
                {describeTechnicalProof(visual, explanation.columns).map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </details>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
