"use client";

import { CircleHelp, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { calculateLevelProgress, type LevelProgress } from "@/lib/levels/progression";
import { loadPlayerLevel } from "@/lib/levels/repository";

type AccountXpState =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "unavailable" }
  | { kind: "ready"; progress: LevelProgress };

/**
 * AI_COACH_RANKED_ACCOUNT_XP_V1
 * Read-only account totals from the existing authenticated, RLS-protected XP table.
 * Never treat a result, client hint, or difference between totals as an XP award.
 */
export function RankedXpProgress({ matchId }: { matchId: string }) {
  const [state, setState] = useState<AccountXpState>({ kind: "loading" });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });

    void loadPlayerLevel()
      .then((account) => {
        if (!active) return;
        setState(
          account.state === "ready"
            ? {
                kind: "ready",
                progress: calculateLevelProgress(account.totalXp),
              }
            : { kind: "guest" },
        );
      })
      .catch(() => {
        // No fabricated zero, earned XP, or level on auth/database failures.
        if (active) setState({ kind: "unavailable" });
      });

    return () => {
      active = false;
    };
  }, [matchId, revision]);

  const progress = state.kind === "ready" ? state.progress : null;

  return (
    <section className="ranked-xp-panel" aria-label="Current account XP progression">
      <div className="ranked-xp-heading">
        <span>
          <Sparkles size={17} aria-hidden="true" /> Account progression
        </span>
        <span className="ranked-xp-trust">
          <ShieldCheck size={15} aria-hidden="true" /> Saved account balance
        </span>
      </div>

      {state.kind === "loading" && (
        <p className="ranked-xp-message" role="status">
          Checking your saved XP…
        </p>
      )}
      {state.kind === "guest" && (
        <p className="ranked-xp-message" role="status">
          Sign in to view account XP. This result does not grant XP by itself.
        </p>
      )}
      {state.kind === "unavailable" && (
        <p className="ranked-xp-message" role="status">
          Account XP is unavailable. No reward amount has been assumed.
        </p>
      )}
      {progress && (
        <>
          <div className="ranked-xp-totals">
            <div>
              <span>Current level</span>
              <strong>{progress.level.toLocaleString()}</strong>
            </div>
            <div>
              <span>Lifetime account XP</span>
              <strong>{progress.totalXp.toLocaleString()} XP</strong>
            </div>
          </div>
          <div className="ranked-xp-progress-heading">
            <span>Progress to Level {(progress.level + 1).toLocaleString()}</span>
            <strong>
              {progress.xpIntoLevel.toLocaleString()} /{" "}
              {progress.xpPerLevel.toLocaleString()}
            </strong>
          </div>
          <div
            className="ranked-xp-progress-track"
            role="progressbar"
            aria-label="Account XP toward next level"
            aria-valuemin={0}
            aria-valuemax={progress.xpPerLevel}
            aria-valuenow={progress.xpIntoLevel}
          >
            <span style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="ranked-xp-next">
            {progress.xpToNextLevel.toLocaleString()} XP until Level{" "}
            {(progress.level + 1).toLocaleString()}
          </p>
        </>
      )}

      <button
        type="button"
        className="ranked-xp-refresh"
        onClick={() => setRevision((previous) => previous + 1)}
        disabled={state.kind === "loading"}
      >
        <RefreshCw size={14} aria-hidden="true" /> Refresh saved XP
      </button>
      <p className="ranked-xp-disclaimer">
        <CircleHelp size={13} aria-hidden="true" /> This is your saved XP total, not the
        XP earned in this match. Competitive RP is separate.
      </p>
    </section>
  );
}
