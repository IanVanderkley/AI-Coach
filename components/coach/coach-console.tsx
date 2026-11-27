"use client";

import Link from "next/link";
import { RankedHistory } from "@/components/profile/ranked-history";
import { prepareRankedReviewResponse } from "@/lib/ranked/coaching-client";
import { isRankedRecordingId } from "@/lib/ranked/coaching-recording";
import {
  ArrowLeft,
  ChevronDown,
  Clock3,
  History,
  Loader2,
  Play,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CoachReportView } from "@/components/coach/coach-report-view";
import { EvidenceCoachPanel } from "@/components/coach/evidence-coach-panel";
import { VerifiedReplayPanel } from "@/components/coach/verified-replay-panel";
import { ReviewOverview } from "@/components/coach/review-overview";
import { prioritizeMoments } from "@/lib/coach/visual-coaching";
import { analyzeGameplay, toRuleReport } from "@/lib/coach/analyze";
import { loadLastGame } from "@/lib/coach/last-game";
import { loadPracticeReviewHandoff } from "@/lib/practice/review-handoff";
import { shapeReportForPreferences } from "@/lib/coach/preferences";
import { loadCoachPreferences } from "@/lib/settings/coach-preferences";
import { createSettingsRepository } from "@/lib/settings/repository";
import type { CoachPreferences } from "@/lib/settings/types";
import { SAMPLE_LOSS_SESSION, SAMPLE_WIN_SESSION } from "@/lib/coach/sample-session";
import type { CoachResult, GameplaySession } from "@/lib/coach/types";
import type { PracticeSession } from "@/lib/practice/history";
import {
  createPracticeRepository,
  type PracticeReviewSummary,
} from "@/lib/practice/repository";
import { useHistoryGrades } from "@/lib/settings/history-grades";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  scorePracticeReview,
  scorePreparedPracticeReview,
  type ReviewScore,
} from "@/lib/coach/review-score";
import {
  preparePracticeAnalysis,
  type PracticeAnalysis,
} from "@/lib/coach/practice-analysis";

type ProviderStatus = {
  configured: boolean;
  provider: { id: string; model: string } | null;
};
type Selection = {
  mode: "practice" | "ranked";
  id: string;
  game: PracticeSession;
  review: ReviewScore;
  analysis: PracticeAnalysis;
};
const SAMPLES = [
  { key: "loss", label: "Analyze a loss", session: SAMPLE_LOSS_SESSION },
  { key: "win", label: "Analyze a win", session: SAMPLE_WIN_SESSION },
];

function timeLabel(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function CoachConsole() {
  const repository = useMemo(() => createPracticeRepository(), []);
  const [games, setGames] = useState<PracticeReviewSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [practiceExpanded, setPracticeExpanded] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { enabled: autoGrades, ready: gradesReady } = useHistoryGrades();
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const [unavailableGrades, setUnavailableGrades] = useState<Record<string, boolean>>({});
  const [scores, setScores] = useState<Record<string, ReviewScore>>({});
  const [preferences, setPreferences] = useState<CoachPreferences | null>(null);
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [replayFocus, setReplayFocus] = useState<{
    moveNumber: number;
    request: number;
  } | null>(null);
  const [result, setResult] = useState<CoachResult | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const request = useRef(0);
  const demoRequest = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const lastView = useRef(false);
  const reviewing =
    pendingId !== null || selection !== null || loadingKey !== null || result !== null;
  useEffect(() => {
    if (lastView.current !== reviewing) {
      lastView.current = reviewing;
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "start" });
    }
  }, [reviewing]);

  function backToGames() {
    ++request.current;
    ++demoRequest.current;
    setSelection(null);
    setPendingId(null);
    setReplayFocus(null);
    setResult(null);
    setLoadingKey(null);
    setError("");
    // A return from a direct review link should stay on history after refresh.
    const url = new URL(window.location.href);
    url.searchParams.delete("gameId");
    url.searchParams.delete("reviewId");
    url.searchParams.delete("matchId");
    if (["practice", "ranked"].includes(url.searchParams.get("source") ?? ""))
      url.searchParams.delete("source");
    if (url.href !== window.location.href)
      window.history.replaceState(window.history.state, "", url);
  }
  const chooseReplayMove = useCallback((moveNumber: number) => {
    setReplayFocus((previous) => ({ moveNumber, request: (previous?.request ?? 0) + 1 }));
    const workspace = document.getElementById("coach-replay-workspace");
    workspace?.focus({ preventScroll: true });
    workspace?.scrollIntoView({ block: "start" });
  }, []);

  // This function is the only path that generates a main review. It runs after
  // an explicit game selection (or an explicit review link from Play/Profile).
  const openGame = useCallback(
    async (id: string, handoff?: PracticeSession) => {
      const token = ++request.current;
      ++demoRequest.current;
      setPendingId(id);
      setError("");
      setSelection(null);
      setReplayFocus(null);
      setResult(null);
      setLoadingKey(null);
      try {
        const game = handoff ?? (await repository.loadReview(id));
        if (token !== request.current) return;
        if (!game)
          throw new Error("This game is no longer available in your recent recordings.");
        const analysis = preparePracticeAnalysis(game);
        const review = scorePreparedPracticeReview(analysis);
        setScores((previous) => ({ ...previous, [id]: review }));
        setReviewed((previous) => ({ ...previous, [id]: true }));
        setSelection({ mode: "practice", id, game, review, analysis });
      } catch (reason) {
        if (token === request.current)
          setError(
            reason instanceof Error ? reason.message : "Could not load this game.",
          );
      } finally {
        if (token === request.current) setPendingId(null);
      }
    },
    [repository],
  );

  const openRankedGame = useCallback(async (matchId: string) => {
    const token = ++request.current;
    ++demoRequest.current;
    setSelection(null);
    setReplayFocus(null);
    setResult(null);
    setLoadingKey(null);
    setError("");
    setPendingId(`ranked-${matchId}`);
    try {
      if (!isRankedRecordingId(matchId)) throw new Error("Invalid Ranked match ID.");
      const response = await fetch(
        `/api/ranked/coaching/recording?matchId=${encodeURIComponent(matchId)}`,
        { cache: "no-store" },
      );
      if (token !== request.current) return;
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Sign in to review Ranked matches."
            : response.status === 404
              ? "Completed Ranked match not found."
              : response.status === 422
                ? "A complete verified recording is unavailable for this match."
                : response.status === 429
                  ? "Too many Ranked requests. Please try again shortly."
                  : "Ranked coaching is temporarily unavailable.",
        );
      const raw: unknown = await response.json();
      if (token !== request.current) return;
      const prepared = prepareRankedReviewResponse(raw, matchId);
      setSelection({ mode: "ranked", id: `ranked-${matchId}`, ...prepared });
    } catch (reason) {
      if (token === request.current)
        setError(
          reason instanceof Error ? reason.message : "Could not load Ranked review.",
        );
    } finally {
      if (token === request.current) setPendingId(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const reviewId = params.get("reviewId");
    const gameId = params.get("gameId");
    if (params.get("source") === "ranked") {
      const matchId = params.get("matchId");
      if (params.getAll("matchId").length === 1 && isRankedRecordingId(matchId))
        void openRankedGame(matchId);
      else setError("Invalid Ranked match link. Choose a completed match below.");
    } else if (params.get("source") === "practice" && reviewId) {
      let storage: Storage | null = null;
      try {
        storage = window.sessionStorage;
      } catch {
        /* Browser storage blocked. */
      }
      const handoff = loadPracticeReviewHandoff(storage, reviewId);
      if (handoff) void openGame(`handoff-${reviewId}`, handoff);
      else
        setError(
          "This completed game's replay is unavailable in this tab. Choose a saved game below.",
        );
    } else if (gameId) {
      void openGame(gameId);
    }
    const initialRequest = request.current;
    // A plain visit only reads metadata; no replay, grade, or provider call.
    void repository
      .listReviewSummaries()
      .then((recent) => {
        if (!active) return;
        setGames(recent);
        if (
          request.current === initialRequest &&
          params.get("source") === "practice" &&
          !reviewId &&
          !gameId &&
          recent[0]
        )
          void openGame(recent[0].id);
      })
      .catch(() => {
        if (active)
          setHistoryError(
            "Could not load your recent Practice games. Refresh to try again.",
          );
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
      ++request.current;
      ++demoRequest.current;
    };
  }, [repository, openGame, openRankedGame]);

  useEffect(() => {
    let active = true;
    void loadCoachPreferences(createSettingsRepository())
      .then((value) => {
        if (active) setPreferences(value);
      })
      .catch(() => {});
    // Configuration status is not a coaching request; GET does not invoke a provider.
    void fetch("/api/coach")
      .then((response) => (response.ok ? response.json() : null))
      .then((value: ProviderStatus | null) => {
        if (active) setStatus(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT") return;
      ++request.current;
      ++demoRequest.current;
      setSelection(null);
      setPendingId(null);
      setReplayFocus(null);
      setResult(null);
      setLoadingKey(null);
      setError("");
    });
    return () => subscription.unsubscribe();
  }, []);

  const scoreSnapshot = useRef(scores);
  useEffect(() => {
    scoreSnapshot.current = scores;
  }, [scores]);
  const unavailableSnapshot = useRef(unavailableGrades);
  useEffect(() => {
    unavailableSnapshot.current = unavailableGrades;
  }, [unavailableGrades]);
  // Grade only one saved recording at a time. No report components or provider calls.
  // Pause while a player is reviewing a game; yield between recordings.
  useEffect(() => {
    if (!gradesReady || !autoGrades || reviewing || historyLoading) return;
    let cancelled = false;
    async function populateGrades() {
      for (const item of games) {
        if (cancelled) return;
        if (scoreSnapshot.current[item.id] || unavailableSnapshot.current[item.id])
          continue;
        try {
          const recording = await repository.loadReview(item.id);
          if (cancelled) return;
          if (!recording) throw new Error("Missing recording");
          const score = scorePracticeReview(recording);
          if (!cancelled) setScores((previous) => ({ ...previous, [item.id]: score }));
        } catch {
          if (!cancelled)
            setUnavailableGrades((previous) => ({ ...previous, [item.id]: true }));
        }
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }
    }
    void populateGrades();
    return () => {
      cancelled = true;
    };
  }, [gradesReady, autoGrades, reviewing, historyLoading, games, repository]);
  const selectedReplay = selection?.game ?? null;
  const suggestedLesson = selection
    ? prioritizeMoments(selection.analysis.report, preferences)[0]
    : undefined;
  const analyze = async (key: string, session: GameplaySession) => {
    const token = ++demoRequest.current;
    const payload = preferences ? { ...session, preferences } : session;
    setLoadingKey(key);
    setResult(null);
    setError("");
    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (token !== demoRequest.current) return;
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (token === demoRequest.current)
          setError(body?.error ?? `The coaching API replied with ${response.status}.`);
        return;
      }
      const value = (await response.json()) as CoachResult;
      if (token === demoRequest.current) setResult(value);
    } catch {
      if (token === demoRequest.current)
        setResult({
          report: preferences
            ? shapeReportForPreferences(
                toRuleReport(analyzeGameplay(payload)),
                preferences,
              )
            : toRuleReport(analyzeGameplay(payload)),
          fallbackReason:
            "The coaching API could not be reached, so the built-in rule coach ran in your browser.",
        });
    } finally {
      if (token === demoRequest.current) setLoadingKey(null);
    }
  };
  function openDemo(key: string, session: GameplaySession) {
    ++request.current;
    setSelection(null);
    setPendingId(null);
    setReplayFocus(null);
    void analyze(key, session);
  }

  return (
    <div className="coach-visual-layout coach-full-page">
      {!reviewing ? (
        <section className="coach-history-screen" aria-labelledby="coach-history-title">
          <div className="coach-history-heading">
            <div>
              <h2 id="coach-history-title" ref={heading} tabIndex={-1}>
                <button
                  type="button"
                  className="profile-history-toggle"
                  aria-expanded={practiceExpanded}
                  aria-controls="coach-practice-history-body"
                  onClick={() => setPracticeExpanded((current) => !current)}
                >
                  <History size={20} aria-hidden="true" /> Recent Practice Matches
                  <ChevronDown
                    size={18}
                    aria-hidden="true"
                    className={
                      practiceExpanded
                        ? "profile-history-chevron"
                        : "profile-history-chevron is-collapsed"
                    }
                  />
                </button>
              </h2>
              <p>
                Choose a saved game to review your performance and learn from your moves.
              </p>
            </div>
            {!historyLoading && !historyError && (
              <span>
                {games.length} {games.length === 1 ? "match" : "matches"}
              </span>
            )}
          </div>
          {error && (
            <p className="coach-error" role="alert">
              <TriangleAlert size={15} aria-hidden="true" />
              {error}
            </p>
          )}
          <div
            id="coach-practice-history-body"
            className="profile-history-body coach-practice-history-body"
            hidden={!practiceExpanded}
          >
            {historyLoading ? (
              <p role="status">Loading recent games…</p>
            ) : historyError ? (
              <p className="coach-error" role="alert">
                {historyError}
              </p>
            ) : !games.length ? (
              <div className="coach-empty-guide">
                <p>No saved Practice games yet.</p>
                <Link className="coach-btn" href="/">
                  Play a Practice game
                </Link>
              </div>
            ) : (
              <>
                <ul className="coach-history-list" aria-label="Select a saved game">
                  {games.map((game) => {
                    const score =
                      autoGrades || reviewed[game.id] ? scores[game.id] : undefined;
                    return (
                      <li className="coach-history-row" key={game.id}>
                        <span
                          className={`result-dot ${game.outcome}`}
                          aria-hidden="true"
                        />
                        <div className="coach-history-result">
                          <strong>
                            {game.outcome === "win" ? "Win" : "Loss"} · {game.difficulty}
                          </strong>
                          <span>
                            {game.rows} × {game.columns} ·{" "}
                            {new Date(game.completedAt).toLocaleString()}
                          </span>
                        </div>
                        <span className="coach-history-detail">
                          <Clock3 size={14} aria-hidden="true" />{" "}
                          {timeLabel(game.durationSeconds)}
                        </span>
                        <span className="coach-history-detail">
                          {game.moveCount} actions
                        </span>
                        <span className="coach-history-score">
                          {score?.grade ? (
                            <span
                              className="grade-badge"
                              data-grade={score.grade}
                              aria-label={`Coaching grade ${score.grade}, ${score.score} out of 100`}
                            >
                              <span className="grade-letter">{score.grade}</span>
                              <span className="grade-score">{score.score}/100</span>
                            </span>
                          ) : (
                            <span className="coach-history-ungraded">
                              {score
                                ? "Not graded"
                                : gradesReady && autoGrades
                                  ? unavailableGrades[game.id]
                                    ? "Unavailable"
                                    : "Grading…"
                                  : "Not reviewed"}
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          className="practice-review-link coach-history-action"
                          onClick={() => void openGame(game.id)}
                          aria-label={`Review ${game.difficulty} ${game.outcome === "win" ? "win" : "loss"} from ${new Date(game.completedAt).toLocaleString()}`}
                        >
                          <Play size={14} aria-hidden="true" /> Review game
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="verified-note">
                  Showing your saved Practice recordings.{" "}
                  {autoGrades
                    ? "Grades are calculated as recordings load; detailed lessons open on request."
                    : "Grades appear after you review a game."}
                </p>
              </>
            )}
          </div>
          <div className="coach-ranked-history">
            <p className="verified-note">
              Review completed Ranked matches using server-recorded gameplay. Your
              learning score never changes Elo or XP.
            </p>
            <RankedHistory onReviewMatch={openRankedGame} />
          </div>
          <details className="coach-demo-tests">
            <summary>More tools and sample reports</summary>
            <p className="verified-note">
              Earlier experimental reports are separate from verified lessons.
            </p>
            <div className="coach-actions">
              <button
                type="button"
                className="coach-btn secondary"
                disabled={loadingKey !== null}
                onClick={() => {
                  const classic = loadLastGame();
                  if (classic) openDemo("classic", classic.session);
                  else setError("No classic recording is available.");
                }}
              >
                <History size={15} aria-hidden="true" /> Run classic report (experimental)
              </button>
              {SAMPLES.map(({ key, label, session }) => (
                <button
                  key={key}
                  type="button"
                  className="coach-btn secondary"
                  disabled={loadingKey !== null}
                  onClick={() => openDemo(key, session)}
                >
                  {label} (demo)
                </button>
              ))}
            </div>
          </details>
          <details className="coach-extra-info">
            <summary>How accurate is this review?</summary>
            <p className="verified-note">
              The replay and visual lessons use visible-board evidence. The coaching score
              is a learning aid, not a Ranked result.{" "}
              {status?.configured
                ? "Optional AI focus is available to eligible signed-in users."
                : "External AI is optional; the rule coach works without it."}
            </p>
          </details>
        </section>
      ) : (
        <section aria-label="Coaching report" className="coach-selected-review">
          <div className="coach-review-navigation">
            <button
              type="button"
              className="coach-btn coach-history-action"
              onClick={backToGames}
            >
              <ArrowLeft size={16} aria-hidden="true" /> Back to games
            </button>
            <h2 ref={heading} tabIndex={-1}>
              {selectedReplay
                ? `${selectedReplay.difficulty} ${selection?.mode === "ranked" ? "Ranked" : "Practice"} · ${selectedReplay.outcome === "win" ? "Victory" : "Loss"}`
                : pendingId
                  ? "Game review"
                  : "Sample report"}
            </h2>
          </div>
          {error && (
            <p className="coach-error" role="alert">
              <TriangleAlert size={15} aria-hidden="true" />
              {error}
            </p>
          )}
          {pendingId ? (
            <div className="coach-placeholder" role="status">
              <Loader2 className="coach-spin" size={22} aria-hidden="true" /> Preparing
              your selected game…
            </div>
          ) : selectedReplay && selection ? (
            <div key={selection.id}>
              {selection.mode === "ranked" && (
                <p className="verified-note">
                  Server-verified Ranked recording · Completed match · Private learning
                  review
                </p>
              )}
              <ReviewOverview
                mode={selection.mode}
                review={selection.review}
                preferences={preferences}
                focus={suggestedLesson}
                onReviewMove={chooseReplayMove}
              />
              <VerifiedReplayPanel
                game={selectedReplay}
                analysis={selection.analysis}
                preferences={preferences}
                focusMoveNumber={replayFocus?.moveNumber}
                focusRequestId={replayFocus?.request}
              />
              <EvidenceCoachPanel
                mode={selection.mode}
                game={selectedReplay}
                analysis={selection.analysis}
                onReviewMove={chooseReplayMove}
                preferences={preferences}
                aiAvailable={
                  selection.mode === "practice" &&
                  status?.configured === true &&
                  status.provider !== null
                }
              />
            </div>
          ) : result ? (
            <>
              <p className="verified-note">
                Experimental report — not a verified coaching lesson.
              </p>
              <div className="coach-report-panel">
                <CoachReportView
                  report={result.report}
                  fallbackReason={result.fallbackReason}
                />
              </div>
            </>
          ) : (
            <div className="coach-placeholder" role="status">
              <Loader2 className="coach-spin" size={22} aria-hidden="true" /> Analyzing a
              sample game…
            </div>
          )}
        </section>
      )}
    </div>
  );
}
