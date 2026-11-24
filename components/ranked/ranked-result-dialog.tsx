"use client";

import Link from "next/link";
import { RotateCcw, Trophy, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { MineLogo } from "@/components/play/mine-logo";
import {
  formatRankedDuration,
  type RankedResultSummary,
} from "@/lib/ranked/result-summary";

type RankedResultDialogProps = {
  result: RankedResultSummary | null;
  busy: boolean;
  onPlayAgain: () => void;
  onDismiss: () => void;
};

export function RankedResultDialog({
  result,
  busy,
  onPlayAgain,
  onDismiss,
}: RankedResultDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (result && !dialog.open) dialog.showModal();
    if (!result && dialog.open) dialog.close();
  }, [result?.matchId, result?.outcome]);

  const won = result?.outcome === "won";

  return (
    <dialog
      ref={dialogRef}
      className={`ranked-result-dialog ${won ? "ranked-result-win" : "ranked-result-loss"}`}
      aria-labelledby="ranked-result-title"
      aria-describedby="ranked-result-description"
      onClose={onDismiss}
    >
      {result ? (
        <div className="ranked-result-content">
          <button
            type="button"
            className="ranked-result-close"
            aria-label="Close Ranked results"
            onClick={onDismiss}
          >
            <X size={19} aria-hidden="true" />
          </button>
          <div className="ranked-result-emblem" aria-hidden="true">
            {won ? (
              <Trophy size={40} strokeWidth={2.2} />
            ) : (
              <MineLogo className="ranked-result-mine" />
            )}
          </div>
          <p className="ranked-result-eyebrow">RANKED MATCH COMPLETE</p>
          <h2 id="ranked-result-title">{won ? "Victory!" : "Game over"}</h2>
          <p id="ranked-result-description" className="ranked-result-description">
            {won
              ? "Every safe square cleared. Your victory was confirmed by the Ranked server."
              : "A mine ended this run. Your result was confirmed by the Ranked server."}
          </p>
          <div className="ranked-result-stats" aria-label="Ranked match statistics">
            <div>
              <span>Server time</span>
              <strong>{formatRankedDuration(result.durationMs)}</strong>
            </div>
            <div>
              <span>Moves</span>
              <strong>{result.moveCount}</strong>
            </div>
            <div>
              <span>Flags on board</span>
              <strong>{result.flagCount}</strong>
            </div>
          </div>
          <p className="ranked-result-board-label">
            {result.rows} × {result.columns} · {result.mineCount} mines ·
            Server-controlled
          </p>
          <div className="ranked-result-actions">
            <button
              type="button"
              className="ranked-result-primary"
              onClick={onPlayAgain}
              disabled={busy}
            >
              <RotateCcw size={17} aria-hidden="true" />
              {busy ? "Starting…" : "Play again"}
            </button>
            <Link className="ranked-result-secondary" href="/profile">
              View profile
            </Link>
          </div>
          <button type="button" className="ranked-result-view-board" onClick={onDismiss}>
            View finished board
          </button>
          <p className="ranked-result-note">
            XP and RP changes are not displayed here yet. This screen reports only
            server-confirmed gameplay statistics.
          </p>
        </div>
      ) : null}
    </dialog>
  );
}
