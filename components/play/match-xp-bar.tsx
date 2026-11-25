"use client";

import { useEffect, useState } from "react";
import { calculateLevelProgress, type LevelProgress } from "@/lib/levels/progression";
import { loadPlayerLevel, loadPracticeXpReceipt } from "@/lib/levels/repository";
import type { PracticeXpReceipt } from "@/lib/levels/rewards";

type LevelState =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "error" }
  | { kind: "ready"; progress: LevelProgress };

/** A read-only end-of-Practice progress indicator. It never awards or guesses XP. */
export function MatchXpBar({
  resultKey,
  saveResult,
  expectedOutcome,
  expectedDifficulty,
}: {
  resultKey: string;
  saveResult?: Promise<string | null>;
  expectedOutcome?: "win" | "loss";
  expectedDifficulty?: string;
}) {
  const [state, setState] = useState<LevelState>({ kind: "loading" });
  const [receipt, setReceipt] = useState<PracticeXpReceipt | null>(null);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    setReceipt(null);
    void (async () => {
      const recordId = await saveResult;
      if (!active) return;
      if (recordId) {
        try {
          const saved = await loadPracticeXpReceipt(recordId);
          if (
            active &&
            saved &&
            saved.outcome === expectedOutcome &&
            saved.difficulty === expectedDifficulty
          )
            setReceipt(saved);
        } catch {
          /* Do not estimate an unavailable receipt. */
        }
      }
      const lookup = await loadPlayerLevel();
      if (!active) return;
      setState(
        lookup.state === "ready"
          ? { kind: "ready", progress: calculateLevelProgress(lookup.totalXp) }
          : { kind: "guest" },
      );
    })().catch(() => {
      if (active) {
        setReceipt(null);
        setState({ kind: "error" });
      }
    });
    return () => {
      active = false;
    };
  }, [resultKey, saveResult, expectedOutcome, expectedDifficulty]);

  return (
    <section className="match-xp-compact" aria-label="Level progress after Practice game">
      {state.kind === "loading" && <p role="status">Loading account level…</p>}
      {state.kind === "guest" && (
        <p role="status">Sign in to see your account level and XP progress.</p>
      )}
      {state.kind === "error" && (
        <p role="status">Account XP is unavailable. Your balance has not changed.</p>
      )}
      {state.kind === "ready" && (
        <>
          <div className="match-xp-compact-heading">
            <strong>LVL {state.progress.level.toLocaleString()}</strong>
            <span>Level {(state.progress.level + 1).toLocaleString()}</span>
          </div>
          <div
            className="match-xp-compact-track"
            role="progressbar"
            aria-label="XP toward next account level"
            aria-valuemin={0}
            aria-valuemax={state.progress.xpPerLevel}
            aria-valuenow={state.progress.xpIntoLevel}
          >
            <span style={{ width: `${state.progress.percent}%` }} />
          </div>
          <div className="match-xp-compact-foot">
            <span>
              {state.progress.xpIntoLevel.toLocaleString()} /{" "}
              {state.progress.xpPerLevel.toLocaleString()} XP
            </span>
            <span>{state.progress.xpToNextLevel.toLocaleString()} XP to go</span>
          </div>
        </>
      )}
      {state.kind === "ready" && (
        <p className="match-xp-compact-disclaimer" role="status">
          {receipt?.reason === "earned" ? (
            <strong>+{receipt.amount.toLocaleString()} XP · Practice reward</strong>
          ) : receipt?.reason === "daily_limit" ? (
            "Daily Practice XP limit reached. Your result is saved."
          ) : receipt?.reason === "participation" ? (
            "This game did not qualify for Practice XP."
          ) : (
            "No saved Practice XP receipt for this game."
          )}
        </p>
      )}
      <p className="match-xp-compact-disclaimer">
        Practice XP counts toward your account level, not competitive rating.
      </p>
    </section>
  );
}
