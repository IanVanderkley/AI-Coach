"use client";

import Link from "next/link";
import { History, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import type { RankedHistoryEntry } from "@/lib/ranked/history";
import { formatRankedDuration } from "@/lib/ranked/result-summary";

type HistoryState =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "error" }
  | { kind: "ready"; matches: RankedHistoryEntry[] };

export function RankedHistory() {
  const [state, setState] = useState<HistoryState>({ kind: "loading" });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    async function load() {
      setState({ kind: "loading" });
      try {
        const response = await fetch("/api/ranked/history", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!live) return;
        if (response.status === 401) {
          setState({ kind: "guest" });
          return;
        }
        if (!response.ok) throw new Error("Ranked history unavailable");
        const result: unknown = await response.json();
        if (
          !result ||
          typeof result !== "object" ||
          !Array.isArray((result as { matches?: unknown }).matches)
        )
          throw new Error("Invalid Ranked history");
        if (live)
          setState({
            kind: "ready",
            matches: (result as { matches: RankedHistoryEntry[] }).matches,
          });
      } catch {
        if (live) setState({ kind: "error" });
      }
    }
    void load();
    return () => {
      live = false;
      controller.abort();
    };
  }, [revision]);

  const matches = state.kind === "ready" ? state.matches : [];
  const wins = matches.filter((game) => game.outcome === "won").length;
  const losses = matches.filter((game) => game.outcome === "lost").length;

  return (
    <section className="ranked-history-card" aria-labelledby="ranked-history-title">
      <div className="ranked-history-heading">
        <div>
          <span className="ranked-history-eyebrow">RANKED ACTIVITY</span>
          <h2 id="ranked-history-title">
            <History size={20} aria-hidden="true" /> Recent Ranked matches
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setRevision((current) => current + 1)}
          disabled={state.kind === "loading"}
        >
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </div>
      {state.kind === "loading" && (
        <p role="status">Loading your server-recorded matches…</p>
      )}
      {state.kind === "guest" && (
        <p>
          Sign in to see your private Ranked match history.{" "}
          <Link href="/sign-in">Sign in</Link>
        </p>
      )}
      {state.kind === "error" && (
        <p role="alert">
          Ranked history is unavailable right now. Your existing XP and matches are
          unchanged.
        </p>
      )}
      {state.kind === "ready" && (
        <>
          <div
            className="ranked-history-summary"
            aria-label="Recent Ranked match summary"
          >
            <div>
              <span>Recent matches</span>
              <strong>{matches.length}</strong>
            </div>
            <div>
              <span>Wins</span>
              <strong>{wins}</strong>
            </div>
            <div>
              <span>Losses</span>
              <strong>{losses}</strong>
            </div>
          </div>
          {matches.length === 0 ? (
            <p>
              No completed server-recorded Ranked matches to show yet.{" "}
              <Link href="/ranked">Play Ranked</Link>
            </p>
          ) : (
            <ol className="ranked-history-list">
              {matches.map((game, index) => (
                <li key={`${game.finishedAt}-${index}`}>
                  <div>
                    <strong
                      className={
                        game.outcome === "won"
                          ? "ranked-history-win"
                          : "ranked-history-loss"
                      }
                    >
                      {game.outcome === "won" ? "Victory" : "Defeat"}
                    </strong>
                    <span>
                      {game.rows} × {game.columns} · {game.mineCount} mines ·{" "}
                      {game.moveCount} moves
                    </span>
                    <time dateTime={game.finishedAt}>
                      {new Date(game.finishedAt).toLocaleString()}
                    </time>
                  </div>
                  <div className="ranked-history-values">
                    <strong>{formatRankedDuration(game.durationMs)}</strong>
                    {game.earnedXp === null ? (
                      <span>XP receipt not available</span>
                    ) : (
                      <span className="ranked-history-xp">
                        <ShieldCheck size={13} aria-hidden="true" /> +{game.earnedXp} XP
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className="ranked-history-footnote">
            Only your latest ten completed Intermediate matches are considered. These
            counts are not lifetime stats or RP. XP appears only when a matching database
            receipt exists.
          </p>
        </>
      )}
    </section>
  );
}
