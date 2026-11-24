"use client";

import { useEffect, useState } from "react";
import { calculateLevelProgress, type LevelProgress } from "@/lib/levels/progression";
import { loadPlayerLevel } from "@/lib/levels/repository";

type LevelState =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "error" }
  | { kind: "ready"; progress: LevelProgress };

/** A read-only end-of-Practice progress indicator. It never awards or guesses XP. */
export function MatchXpBar({ resultKey }: { resultKey: string }) {
  const [state, setState] = useState<LevelState>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    void loadPlayerLevel()
      .then((lookup) => {
        if (!active) return;
        setState(
          lookup.state === "ready"
            ? { kind: "ready", progress: calculateLevelProgress(lookup.totalXp) }
            : { kind: "guest" },
        );
      })
      .catch(() => {
        if (active) setState({ kind: "error" });
      });
    return () => {
      active = false;
    };
  }, [resultKey]);

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
      <p className="match-xp-compact-disclaimer">
        Practice currently grants no verified account XP. This bar shows saved progress
        only.
      </p>
    </section>
  );
}
