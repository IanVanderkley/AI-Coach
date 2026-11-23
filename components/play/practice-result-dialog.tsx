"use client";

import Link from "next/link";
import {
  Award,
  Check,
  Clipboard,
  RotateCcw,
  Share2,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

import type { PracticeBestUpdate } from "@/lib/practice/personal-best";
import { formatPracticeShareText } from "@/lib/practice/share-text";
import { MineLogo } from "./mine-logo";

export type PracticeResultSummary = {
  outcome: "win" | "loss";
  difficulty: string;
  durationSeconds: number;
  moveCount: number;
  flagsOnBoard: number;
  personalBest: PracticeBestUpdate | null;
  reviewId: string | null;
};

type PracticeResultDialogProps = {
  result: PracticeResultSummary | null;
  onPlayAgain: () => void;
  onDismiss: () => void;
};

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function PracticeResultDialog({
  result,
  onPlayAgain,
  onDismiss,
}: PracticeResultDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
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
  }, [result]);

  const isWin = result?.outcome === "win";
  const isPersonalBest = isWin && result?.personalBest?.kind === "improved";
  const isFirstBest = isWin && result?.personalBest?.kind === "first";

  function shareText() {
    if (!result) return "";
    const summary = formatPracticeShareText(result);
    const { protocol, hostname, origin } = window.location;
    const hosted =
      protocol === "https:" && hostname !== "localhost" && hostname !== "127.0.0.1";
    return hosted ? `${summary}\n${origin}` : summary;
  }

  async function copySummary() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(shareText());
      setCopyState("copied");
    } catch {
      setCopyState("unavailable");
    }
  }

  async function shareSummary() {
    if (!result) return;
    const text = shareText();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "AI-Coach Practice result", text });
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
      className={`practice-result-dialog ${isWin ? "practice-result-win" : "practice-result-loss"}`}
      aria-labelledby="practice-result-title"
      aria-describedby="practice-result-subtitle"
      onClose={onDismiss}
    >
      {result ? (
        <div className="practice-result-inner">
          {isWin && (
            <div
              className={`practice-record-burst ${isPersonalBest ? "practice-record-burst-extra" : "practice-victory-burst"}`}
              aria-hidden="true"
            >
              {Array.from({ length: isPersonalBest ? 16 : 12 }, (_, index) => (
                <span
                  key={index}
                  style={
                    {
                      "--burst-angle": `${index * (isPersonalBest ? 22.5 : 30)}deg`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          )}

          <button
            type="button"
            className="practice-result-close"
            aria-label="Close game results"
            onClick={onDismiss}
          >
            <X size={18} aria-hidden="true" />
          </button>

          <div className="practice-result-emblem" aria-hidden="true">
            {isWin ? (
              <>
                <span className="practice-win-ring" />
                <Trophy className="practice-win-trophy" size={33} />
                <span className="practice-win-glint" />
              </>
            ) : (
              <>
                <MineLogo className="practice-loss-logo" />
                <span className="practice-loss-fuse" />
                <span className="practice-loss-spark" />
                <span className="practice-loss-flash" />
                <span className="practice-loss-smoke" />
              </>
            )}
          </div>
          <p className="practice-result-eyebrow">PRACTICE COMPLETE</p>
          <h2 id="practice-result-title">{isWin ? "Victory!" : "Game over"}</h2>
          <p id="practice-result-subtitle" className="practice-result-subtitle">
            {isWin
              ? "Every safe square revealed. Nicely played."
              : "A mine ended this run. Review your decisions and try again."}
          </p>

          {(isPersonalBest || isFirstBest) && (
            <div className="practice-result-achievement" role="status">
              {isPersonalBest ? (
                <Sparkles size={19} aria-hidden="true" />
              ) : (
                <Award size={19} aria-hidden="true" />
              )}
              <span>
                {isPersonalBest
                  ? `New ${result.difficulty} personal best! Your previous best was ${formatTime(result.personalBest!.previousSeconds!)}.`
                  : `Congratulations on your first ${result.difficulty} win!`}
              </span>
            </div>
          )}

          <div className="practice-result-metrics" aria-label="Game results">
            <div>
              <span>Time</span>
              <strong>{formatTime(result.durationSeconds)}</strong>
            </div>
            <div>
              <span>Moves</span>
              <strong>{result.moveCount}</strong>
            </div>
            <div>
              <span>Flags placed</span>
              <strong>{result.flagsOnBoard}</strong>
            </div>
          </div>
          <p className="practice-result-difficulty">
            {result.difficulty} · Practice mode
            {isWin &&
              result.personalBest?.bestSeconds !== null &&
              result.personalBest?.bestSeconds !== undefined &&
              ` · Browser best: ${formatTime(result.personalBest.bestSeconds)}`}
          </p>

          <div className="practice-result-actions">
            <button
              type="button"
              className="practice-result-primary"
              onClick={onPlayAgain}
            >
              <RotateCcw size={17} aria-hidden="true" /> Play Again
            </button>
            <Link
              className="practice-result-secondary"
              href={
                result.reviewId
                  ? `/coaching?source=practice&reviewId=${encodeURIComponent(result.reviewId)}`
                  : "/coaching?source=practice"
              }
            >
              <Award size={17} aria-hidden="true" /> Analyze Game
            </Link>
          </div>

          <div className="practice-result-bottom">
            <button type="button" onClick={() => void shareSummary()}>
              {shareState === "shared" || shareState === "copied" ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <Share2 size={15} aria-hidden="true" />
              )}
              {shareState === "shared"
                ? "Shared!"
                : shareState === "copied"
                  ? "Copied to share"
                  : "Share result"}
            </button>
            <button type="button" onClick={() => void copySummary()}>
              {copyState === "copied" ? (
                <Check size={15} aria-hidden="true" />
              ) : copyState === "idle" ? (
                <Clipboard size={15} aria-hidden="true" />
              ) : null}
              {copyState === "copied" ? "Copied!" : "Copy result"}
            </button>
            <button type="button" onClick={onDismiss}>
              View board
            </button>
          </div>
          {(copyState === "unavailable" || shareState === "unavailable") && (
            <p className="practice-result-copy-error" role="status">
              Sharing is unavailable in this browser. You can still see your results
              above.
            </p>
          )}
          <p className="practice-result-note">
            Practice times are saved on this browser, not independently verified world
            records.
          </p>
        </div>
      ) : null}
    </dialog>
  );
}
