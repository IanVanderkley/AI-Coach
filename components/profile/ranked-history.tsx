"use client";

import Link from "next/link";
import { readCoachingSections } from "@/lib/settings/coaching-sections";
import { ChevronDown, Clock3, History, Play, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  parseRankedHistoryGrade,
  type RankedHistoryGrade,
} from "@/lib/ranked/history-grade";
import type { ReviewScore } from "@/lib/coach/review-score";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import type { RankedHistoryEntry } from "@/lib/ranked/history";
import type { RankedCoachingHistoryEntry } from "@/lib/ranked/coaching-history";
import { isRankedRecordingId } from "@/lib/ranked/coaching-recording";
import { formatRankedDuration } from "@/lib/ranked/result-summary";

type HistoryItem = RankedHistoryEntry | RankedCoachingHistoryEntry;
type GradeResult = Pick<ReviewScore, "grade" | "score"> | "unavailable";

function RankedGradeBadge({
  value,
  enabled,
  available,
}: {
  value?: GradeResult;
  enabled: boolean;
  available: boolean;
}) {
  return (
    <span className="coach-history-score">
      {value && value !== "unavailable" && value.grade ? (
        <span
          className="grade-badge"
          data-grade={value.grade}
          aria-label={`Coaching grade ${value.grade}, ${value.score} out of 100`}
        >
          <span className="grade-letter">{value.grade}</span>
          <span className="grade-score">{value.score}/100</span>
        </span>
      ) : (
        <span className="coach-history-ungraded">
          {value === "unavailable" || !available
            ? "Unavailable"
            : value
              ? "Not graded"
              : enabled
                ? "Grading…"
                : "Not reviewed"}
        </span>
      )}
    </span>
  );
}

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
  gradeEnabled = false,
  manualGrades,
}: {
  onRecentMatches?: (matches: RankedHistoryEntry[] | null) => void;
  summaryOnly?: boolean;
  onReviewMatch?: (matchId: string) => void;
  gradeEnabled?: boolean;
  manualGrades?: Record<string, Pick<ReviewScore, "grade" | "score">>;
}) {
  const [state, setState] = useState<HistoryState>({ kind: "loading" });
  const [revision, setRevision] = useState(0);
  const [grades, setGrades] = useState<
    Record<string, RankedHistoryGrade | "unavailable">
  >({});
  const gradesRef = useRef(grades);
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
      gradesRef.current = {};
      setGrades({});
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
        gradesRef.current = {};
        setGrades({});
        setState({ kind: "guest" });
      }
    }).data.subscription;
    return () => {
      live = false;
      controller.abort();
      subscription?.unsubscribe();
    };
  }, [revision, onReviewMatch]);

  // Keep metadata fast; grade only visible owner-authorized rows, one request at a time.
  // Cache hits are compact reads; neither this worker nor the endpoint uses paid AI.
  useEffect(() => {
    if (
      !gradeEnabled ||
      !rankedExpanded ||
      summaryOnly ||
      !onReviewMatch ||
      state.kind !== "ready"
    )
      return;
    const controller = new AbortController();
    let cancelled = false;
    async function populateRankedGrades() {
      if (state.kind !== "ready") return;
      let limited = false;
      let count = 0;
      for (const item of state.matches) {
        if (cancelled || count++ >= 10) break;
        if (
          !("matchId" in item) ||
          !item.reviewAvailable ||
          !isRankedRecordingId(item.matchId) ||
          manualGrades?.[item.matchId] ||
          gradesRef.current[item.matchId]
        )
          continue;
        let value: RankedHistoryGrade | "unavailable" = "unavailable";
        if (!limited) {
          try {
            const response = await fetch(
              `/api/ranked/coaching/grade?matchId=${encodeURIComponent(item.matchId)}`,
              {
                cache: "no-store",
                credentials: "same-origin",
                signal: controller.signal,
              },
            );
            if (response.status === 429 || response.status === 401) limited = true;
            if (response.ok)
              value = parseRankedHistoryGrade(await response.json(), item.matchId);
          } catch {
            /* A failed grade never breaks the metadata list. */
          }
        }
        if (cancelled) return;
        gradesRef.current = { ...gradesRef.current, [item.matchId]: value };
        setGrades(gradesRef.current);
      }
    }
    void populateRankedGrades();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [gradeEnabled, rankedExpanded, summaryOnly, onReviewMatch, state, manualGrades]);

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
      <div
        className={
          onReviewMatch
            ? "ranked-history-heading coach-history-heading"
            : "ranked-history-heading"
        }
      >
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
          {!onReviewMatch && (
            <p className="profile-history-match-count">
              {state.kind === "ready"
                ? String(matches.length) + " matches"
                : state.kind === "loading"
                  ? "Loading matches…"
                  : "Match history"}
            </p>
          )}
        </div>
        <div className="ranked-history-header-actions">
          {onReviewMatch && state.kind === "ready" && (
            <span className="coach-card-count">
              {matches.length} {matches.length === 1 ? "match" : "matches"}
            </span>
          )}
          {!onReviewMatch && (
            <button
              type="button"
              onClick={() => setRevision((current) => current + 1)}
              disabled={state.kind === "loading"}
            >
              <RefreshCw size={14} aria-hidden="true" /> Refresh
            </button>
          )}
        </div>
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
            {!onReviewMatch && (
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
            )}
            {matches.length === 0 ? (
              <p>
                No completed server-recorded Ranked matches to show yet.{" "}
                <Link href="/ranked">Play Ranked</Link>
              </p>
            ) : onReviewMatch ? (
              <ul className="coach-history-list" aria-label="Select a Ranked game">
                {matches.map((game) => {
                  if (!("matchId" in game)) return null;
                  const seconds =
                    game.durationMs === null ? null : Math.floor(game.durationMs / 1000);
                  const displayTime =
                    seconds === null
                      ? "—"
                      : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
                  const won = game.outcome === "won";
                  return (
                    <li className="coach-history-row" key={game.matchId}>
                      <span
                        className={`result-dot ${won ? "win" : "loss"}`}
                        aria-hidden="true"
                      />
                      <div className="coach-history-result">
                        <strong>{won ? "Win" : "Loss"} · Intermediate</strong>
                        <span>
                          {game.rows} × {game.columns} ·{" "}
                          {new Date(game.finishedAt).toLocaleString()}
                        </span>
                      </div>
                      <span
                        className="coach-history-detail"
                        title={formatRankedDuration(game.durationMs)}
                      >
                        <Clock3 size={14} aria-hidden="true" /> {displayTime}
                      </span>
                      <span className="coach-history-detail">
                        {game.moveCount} actions
                      </span>
                      <RankedGradeBadge
                        value={
                          manualGrades?.[game.matchId] ??
                          (gradeEnabled ? grades[game.matchId] : undefined)
                        }
                        enabled={gradeEnabled}
                        available={game.reviewAvailable}
                      />
                      <button
                        type="button"
                        className="practice-review-link coach-history-action"
                        disabled={
                          !game.reviewAvailable || !isRankedRecordingId(game.matchId)
                        }
                        aria-label={`Review Intermediate ${won ? "win" : "loss"} from ${new Date(game.finishedAt).toLocaleString()}`}
                        onClick={() => onReviewMatch(game.matchId)}
                      >
                        <Play size={14} aria-hidden="true" /> Review game
                      </button>
                    </li>
                  );
                })}
              </ul>
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
                      {"earnedXp" in game ? (
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
            {!onReviewMatch && (
              <p className="ranked-history-footnote">
                Only your latest ten completed Intermediate matches are considered. These
                counts are not lifetime stats or RP. XP appears only when a matching
                database receipt exists.
              </p>
            )}
          </>
        )}
        {onReviewMatch && state.kind !== "guest" && (
          <div className="coach-ranked-history-footer">
            <button
              type="button"
              className="coach-btn secondary"
              onClick={() => setRevision((current) => current + 1)}
              disabled={state.kind === "loading"}
            >
              <RefreshCw size={14} aria-hidden="true" /> Refresh matches
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
