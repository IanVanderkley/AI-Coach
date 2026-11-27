"use client";

import Link from "next/link";
import { readCoachingSections } from "@/lib/settings/coaching-sections";
import { ChevronDown, History, Play, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import type { RankedHistoryEntry } from "@/lib/ranked/history";
import type { RankedCoachingHistoryEntry } from "@/lib/ranked/coaching-history";
import { isRankedRecordingId } from "@/lib/ranked/coaching-recording";
import { formatRankedDuration } from "@/lib/ranked/result-summary";

type HistoryItem = RankedHistoryEntry | RankedCoachingHistoryEntry;

type HistoryState =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "error" }
  | { kind: "ready"; matches: HistoryItem[] };

// AI_COACH_PLAYER_DASHBOARD_V1: share only the same already-validated recent rows with the overview.
export function RankedHistory({
  onRecentMatches,
  summaryOnly = false,
  onReviewMatch,
}: {
  onRecentMatches?: (matches: RankedHistoryEntry[] | null) => void;
  summaryOnly?: boolean;
  onReviewMatch?: (matchId: string) => void;
}) {
  const [state, setState] = useState<HistoryState>({ kind: "loading" });
  const [revision, setRevision] = useState(0);
  // AI_COACH_COLLAPSIBLE_HISTORY_V1
  const [rankedExpanded, setRankedExpanded] = useState(true);
  useEffect(() => {
    if (onReviewMatch) setRankedExpanded(readCoachingSections().ranked);
  }, [onReviewMatch]);

  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    async function load() {
      setState({ kind: "loading" });
      try {
        const options = { cache: "no-store" as const, signal: controller.signal };
        const response = onReviewMatch
          ? await fetch("/api/ranked/coaching/history", options)
          : await fetch("/api/ranked/history", options);
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
            matches: (result as { matches: HistoryItem[] }).matches,
          });
      } catch {
        if (live) setState({ kind: "error" });
      }
    }
    void load();
    const client = getSupabaseBrowserClient();
    const subscription = client?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        live = false;
        controller.abort();
        setState({ kind: "guest" });
      }
    }).data.subscription;
    return () => {
      live = false;
      controller.abort();
      subscription?.unsubscribe();
    };
  }, [revision, onReviewMatch]);

  // Updating dashboard stats never fetches or changes match data.
  useEffect(() => {
    onRecentMatches?.(
      state.kind === "ready" && !onReviewMatch
        ? state.matches.filter((item): item is RankedHistoryEntry => "earnedXp" in item)
        : null,
    );
  }, [state, onRecentMatches, onReviewMatch]);

  if (summaryOnly) return null;

  const matches = state.kind === "ready" ? state.matches : [];
  const wins = matches.filter((game) => game.outcome === "won").length;
  const losses = matches.filter((game) => game.outcome === "lost").length;

  return (
    <section className="ranked-history-card" aria-labelledby="ranked-history-title">
      <div className="ranked-history-heading">
        <div>
          <span className="ranked-history-eyebrow">RANKED ACTIVITY</span>
          <h2 id="ranked-history-title">
            <button
              type="button"
              className="profile-history-toggle"
              aria-expanded={rankedExpanded}
              aria-controls="ranked-history-body"
              onClick={() => setRankedExpanded((current) => !current)}
            >
              <History size={20} aria-hidden="true" /> Recent Ranked Matches
              <ChevronDown
                size={18}
                aria-hidden="true"
                className={
                  rankedExpanded
                    ? "profile-history-chevron"
                    : "profile-history-chevron is-collapsed"
                }
              />
            </button>
          </h2>
          {onReviewMatch && (
            <p className="coach-ranked-description">
              Review completed server-recorded matches.
            </p>
          )}
          <p className="profile-history-match-count">
            {state.kind === "ready"
              ? String(matches.length) + " matches"
              : state.kind === "loading"
                ? "Loading matches…"
                : "Match history"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRevision((current) => current + 1)}
          disabled={state.kind === "loading"}
        >
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </div>
      <div
        id="ranked-history-body"
        hidden={!rankedExpanded}
        className="profile-history-body"
      >
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
                      {onReviewMatch ? (
                        "matchId" in game &&
                        isRankedRecordingId(game.matchId) &&
                        game.reviewAvailable ? (
                          <button
                            type="button"
                            className="practice-review-link coach-history-action"
                            onClick={() => onReviewMatch(game.matchId)}
                          >
                            <Play size={14} aria-hidden="true" /> Review game
                          </button>
                        ) : (
                          <span>Review unavailable</span>
                        )
                      ) : "earnedXp" in game ? (
                        game.earnedXp === null ? (
                          <span>XP receipt not available</span>
                        ) : (
                          <span className="ranked-history-xp">
                            <ShieldCheck size={13} aria-hidden="true" /> +{game.earnedXp}{" "}
                            XP
                          </span>
                        )
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <p className="ranked-history-footnote">
              Only your latest ten completed Intermediate matches are considered. These
              counts are not lifetime stats or RP.{" "}
              {onReviewMatch
                ? "Review availability is confirmed when you select a match."
                : "XP appears only when a matching database receipt exists."}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
