"use client";

import { RotateCcw, Save, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import type { PracticeRecoverySnapshot } from "@/lib/practice/in-progress";

type Props = {
  saved: PracticeRecoverySnapshot | null;
  replaceOpen: boolean;
  difficulty: string;
  onResume: () => void;
  onDiscardSaved: () => void;
  onReplace: () => void;
  onKeepPlaying: () => void;
};

function time(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function PracticeRecoveryDialog({
  saved,
  replaceOpen,
  difficulty,
  onResume,
  onDiscardSaved,
  onReplace,
  onKeepPlaying,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const mode = saved ? "restore" : replaceOpen ? "replace" : null;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (mode && !dialog.open) dialog.showModal();
    if (!mode && dialog.open) dialog.close();
  }, [mode]);

  return (
    <dialog
      ref={ref}
      className="practice-recovery-dialog"
      aria-labelledby="practice-recovery-title"
      onCancel={(event) => {
        event.preventDefault();
        if (mode === "replace") onKeepPlaying();
      }}
    >
      {mode === "restore" && saved ? (
        <div className="practice-recovery-inner">
          <div className="practice-recovery-icon">
            <Save size={27} aria-hidden="true" />
          </div>
          <p className="practice-recovery-eyebrow">UNFINISHED PRACTICE GAME</p>
          <h2 id="practice-recovery-title">Welcome back!</h2>
          <p>
            You've got an unfinished {difficulty} game saved in this browser. Pick up
            where you left off or start fresh.
          </p>
          <div className="practice-recovery-stats">
            <span>
              <strong>{time(saved.elapsedMs)}</strong>
              <small>Time played</small>
            </span>
            <span>
              <strong>{saved.board.flat().filter((cell) => cell.revealed).length}</strong>
              <small>Cells revealed</small>
            </span>
            <span>
              <strong>{saved.board.flat().filter((cell) => cell.flagged).length}</strong>
              <small>Flags placed</small>
            </span>
          </div>
          <button type="button" className="practice-recovery-primary" onClick={onResume}>
            <RotateCcw size={17} aria-hidden="true" /> Resume Game
          </button>
          <button
            type="button"
            className="practice-recovery-secondary"
            onClick={onDiscardSaved}
          >
            <Trash2 size={16} aria-hidden="true" /> Discard and Start New
          </button>
          <p className="practice-recovery-note">
            Practice only · This saved game is not a Ranked or verified record.
          </p>
        </div>
      ) : mode === "replace" ? (
        <div className="practice-recovery-inner">
          <div className="practice-recovery-icon is-warning">
            <ShieldAlert size={27} aria-hidden="true" />
          </div>
          <p className="practice-recovery-eyebrow">UNFINISHED GAME</p>
          <h2 id="practice-recovery-title">Start a new game?</h2>
          <p>
            Your current {difficulty} board and its move recording will be lost if you
            start over.
          </p>
          <button
            type="button"
            className="practice-recovery-primary"
            onClick={onKeepPlaying}
          >
            Keep This Game
          </button>
          <button
            type="button"
            className="practice-recovery-secondary"
            onClick={onReplace}
          >
            <Trash2 size={16} aria-hidden="true" /> Discard and Start New
          </button>
        </div>
      ) : null}
    </dialog>
  );
}
