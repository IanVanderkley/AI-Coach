"use client";

import Link from "next/link";
import { Check, Clipboard, RotateCcw, Share2, Trophy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { MineLogo } from "@/components/play/mine-logo";
import { RankedXpProgress } from "@/components/ranked/ranked-xp-progress"; // AI_COACH_RANKED_ACCOUNT_XP_V1
import { RankedMatchXpReceipt } from "@/components/ranked/ranked-match-xp-receipt"; // AI_COACH_RANKED_OUTCOME_XP_V1
import { RankedMatchRating } from "@/components/ranked/ranked-match-rating";
import {
  formatRankedDuration,
  formatRankedShareText,
  type RankedResultSummary,
} from "@/lib/ranked/result-summary";

type RankedResultDialogProps = {
  result: RankedResultSummary | null;
  busy: boolean;
  onPlayAgain: () => void;
  onReturnLobby: () => void;
  onDismiss: () => void;
};

export function RankedResultDialog({
  result,
  busy,
  onPlayAgain,
  onReturnLobby,
  onDismiss,
}: RankedResultDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  // AI_COACH_RANKED_RESULT_EXPERIENCE_V1: share only server-confirmed match statistics.
  const [copyState, setCopyState] = useState<"idle" | "copied" | "unavailable">("idle");
  const [shareState, setShareState] = useState<
    "idle" | "shared" | "copied" | "unavailable"
  >("idle");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (result && !dialog.open) dialog.showModal();
    if (!result && dialog.open) dialog.close();
    setCopyState("idle");
    setShareState("idle");
  }, [result?.matchId, result?.outcome]);

  const won = result?.outcome === "won";

  function getShareText() {
    if (!result) return "";
    const summary = formatRankedShareText(result);
    const { protocol, hostname, origin } = window.location;
    const hosted =
      protocol === "https:" && hostname !== "localhost" && hostname !== "127.0.0.1";
    return hosted ? `${summary}\n${origin}` : summary;
  }

  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(getShareText());
      setCopyState("copied");
    } catch {
      setCopyState("unavailable");
    }
  }

  async function shareResult() {
    if (!result) return;
    const text = getShareText();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "MindSweeper Ranked result", text });
        setShareState("shared");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareState("copied");
    } catch {
      setShareState("unavailable");
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={`ranked-result-dialog ${won ? "ranked-result-win practice-result-win" : "ranked-result-loss practice-result-loss"}`}
      aria-labelledby="ranked-result-title"
      aria-describedby="ranked-result-description"
      onClose={onDismiss}
    >
      {result ? (
        <div className="ranked-result-content">
          {won && (
            <div
              className="practice-record-burst practice-victory-burst ranked-result-confetti"
              aria-hidden="true"
            >
              {Array.from({ length: 12 }, (_, index) => (
                <span
                  key={index}
                  style={{ "--burst-angle": `${index * 30}deg` } as CSSProperties}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            className="ranked-result-close"
            aria-label="Close Ranked results"
            onClick={onDismiss}
          >
            <X size={19} aria-hidden="true" />
          </button>
          <div className="ranked-result-header">
            <div
              className="ranked-result-emblem practice-result-emblem"
              aria-hidden="true"
            >
              {won ? (
                <>
                  <span className="practice-win-ring" />
                  <Trophy className="practice-win-trophy" size={40} strokeWidth={2.2} />
                  <span className="practice-win-glint" />
                </>
              ) : (
                <>
                  <MineLogo className="ranked-result-mine practice-loss-logo" />
                  <span className="practice-loss-fuse" />
                  <span className="practice-loss-spark" />
                  <span className="practice-loss-flash" />
                  <span className="practice-loss-smoke" />
                </>
              )}
            </div>
            <div>
              <p className="ranked-result-eyebrow">RANKED MATCH COMPLETE</p>
              <h2 id="ranked-result-title">{won ? "Victory!" : "Game over"}</h2>
              <p id="ranked-result-description" className="ranked-result-description">
                {won
                  ? "Every safe square cleared. Your victory was confirmed by the Ranked server."
                  : "A mine ended this run. Your result was confirmed by the Ranked server."}
              </p>
            </div>
          </div>
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
          <div className="ranked-result-rewards">
            <RankedMatchRating
              key={`rating-${result.matchId}`}
              matchId={result.matchId}
              expectedOutcome={result.outcome}
            />
            <div className="ranked-result-xp">
              <RankedMatchXpReceipt
                key={`reward-${result.matchId}`}
                matchId={result.matchId}
                expectedOutcome={result.outcome}
              />
              <RankedXpProgress key={result.matchId} matchId={result.matchId} />
            </div>
          </div>
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
            <button
              type="button"
              className="ranked-result-secondary"
              onClick={onReturnLobby}
              disabled={busy}
            >
              Return to lobby
            </button>
            <Link className="ranked-result-secondary" href="/profile">
              View profile
            </Link>
          </div>
          <div className="ranked-result-utilities">
            <div className="ranked-result-sharing" aria-label="Share Ranked match result">
              <button type="button" onClick={() => void shareResult()}>
                {shareState === "shared" || shareState === "copied" ? (
                  <Check size={16} aria-hidden="true" />
                ) : (
                  <Share2 size={16} aria-hidden="true" />
                )}
                {shareState === "shared"
                  ? "Shared!"
                  : shareState === "copied"
                    ? "Copied to share"
                    : "Share result"}
              </button>
              <button type="button" onClick={() => void copyResult()}>
                {copyState === "copied" ? (
                  <Check size={16} aria-hidden="true" />
                ) : (
                  <Clipboard size={16} aria-hidden="true" />
                )}
                {copyState === "copied" ? "Copied!" : "Copy result"}
              </button>
            </div>
            {(copyState === "unavailable" || shareState === "unavailable") && (
              <p className="ranked-result-share-status" role="status">
                Sharing is unavailable in this browser. Match results remain visible
                above.
              </p>
            )}
            <button
              type="button"
              className="ranked-result-view-board"
              onClick={onDismiss}
            >
              View finished board
            </button>
          </div>
          <p className="ranked-result-note">
            The match reward comes from a database receipt; the account XP card shows your
            saved lifetime total. Ranked Elo and account XP are separate.
          </p>
        </div>
      ) : null}
    </dialog>
  );
}
