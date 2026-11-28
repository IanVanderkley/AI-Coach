"use client";

import { useCoachingSections } from "@/lib/settings/coaching-sections";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  ChartNoAxesCombined,
  ChevronDown,
  Target,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  LESSONS,
  REVIEW_WINDOWS,
  type ReviewMode,
  type SavedReview,
} from "@/lib/coach/personalized-review";

import { buildLearningDashboard, formatLearningPercent, formatLearningChange, trendAvailability } from "@/lib/coach/learning-dashboard";
import { LearningDashboardDetail } from "./learning-dashboard-detail";

import {
  DEFAULT_LEARNING_VIEW,
  readLearningView,
  writeLearningView,
} from "@/lib/coach/learning-view-preferences";

export function SaveCoachingReview({
  mode,
  gameRef,
}: {
  mode: ReviewMode;
  gameRef: string | null;
}) {
  const [saved, setSaved] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const [failed, setFailed] = useState(false);
  const active = useRef<AbortController | null>(null);
  const owner = useRef<string | null>(null);
  useEffect(() => {
    if (!gameRef) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setSaved(null);
    setFailed(false);
    setMessage("");
    const query = new URLSearchParams({ mode, gameRef });
    void (async () => {
      try {
        const response = await fetch(`/api/coach/reports?${query}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok || typeof result.saved !== "boolean")
          throw new Error(result.error ?? "Could not check saved status.");
        setSaved(result.saved);
      } catch (error) {
        if (!controller.signal.aborted) {
          setFailed(true);
          setMessage(
            error instanceof Error ? error.message : "Could not check saved status.",
          );
        }
      } finally {
        if (active.current === controller) {
          active.current = null;
          setBusy(false);
        }
      }
    })();
    return () => {
      controller.abort();
      if (active.current === controller) active.current = null;
    };
  }, [mode, gameRef, revision]);
  useEffect(() => {
    const subscription = getSupabaseBrowserClient()?.auth.onAuthStateChange(
      (event, session) => {
        const next = session?.user.id ?? null;
        if (event === "INITIAL_SESSION") {
          owner.current = next;
          return;
        }
        if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && owner.current !== next)) {
          owner.current = next;
          active.current?.abort();
          active.current = null;
          setSaved(null);
          setBusy(false);
          setFailed(false);
          setMessage("");
          setRevision((value) => value + 1);
        }
      },
    ).data.subscription;
    return () => {
      active.current?.abort();
      subscription?.unsubscribe();
    };
  }, []);
  async function toggle() {
    if (!gameRef || active.current || saved === null) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const response = await fetch("/api/coach/reports", {
        method: saved ? "DELETE" : "POST",
        cache: "no-store",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, gameRef }),
      });
      const result = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok || result.saved !== !saved)
        throw new Error(result.error ?? "Could not change saved status.");
      setSaved(result.saved);
      setMessage(
        result.saved
          ? "Saved to your private learning history. Click again to unsave."
          : "Report removed from your learning history. The game and replay are unchanged.",
      );
    } catch (error) {
      if (!controller.signal.aborted) {
        setFailed(true);
        setMessage(
          error instanceof Error ? error.message : "Could not change saved status.",
        );
      }
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }
  if (!gameRef)
    return (
      <p className="verified-note">
        To save this review to your account, open its saved Practice match from history.
      </p>
    );
  return (
    <div className="coach-save-review">
      <button
        type="button"
        className={`coach-btn coach-history-action${saved ? " coach-review-is-saved" : ""}`}
        aria-pressed={saved === true}
        disabled={busy || saved === null}
        onClick={() => void toggle()}
      >
        {saved ? (
          <BookmarkCheck size={16} aria-hidden="true" />
        ) : (
          <Bookmark size={16} aria-hidden="true" />
        )}{" "}
        {busy
          ? saved === null
            ? "Checking saved status…"
            : saved
              ? "Removing…"
              : "Saving…"
          : saved
            ? "Report saved"
            : "Save coaching report"}
      </button>
      {saved && !busy && <span className="verified-note">Click again to unsave.</span>}
      {failed && saved === null && (
        <button
          type="button"
          className="coach-btn secondary"
          onClick={() => setRevision((value) => value + 1)}
        >
          Retry status
        </button>
      )}
      {message && (
        <p role="status" className={failed ? "coach-error" : "verified-note"}>
          {message}
        </p>
      )}
    </div>
  );
}

export function PersonalizedCoaching({
  onReview,
}: {
  onReview: (mode: ReviewMode, gameRef: string, move?: number) => void;
}) {
  const { sections } = useCoachingSections();
  const [reports, setReports] = useState<SavedReview[]>([]);
  const [status, setStatus] = useState<"loading" | "guest" | "ready" | "error">(
    "loading",
  );
  const [view, setView] = useState(DEFAULT_LEARNING_VIEW);
  const [viewReady, setViewReady] = useState(false);
  const { mode, difficulty, windowSize, expanded } = view;
  useEffect(() => {
    try {
      setView(readLearningView(window.localStorage));
    } catch {
      /* Optional browser storage. */
    }
    setViewReady(true);
  }, []);
  useEffect(() => {
    if (viewReady)
      try {
        writeLearningView(window.localStorage, view);
      } catch {
        /* Optional browser storage. */
      }
  }, [viewReady, view]);
  const [revision, setRevision] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const owner = useRef<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setReports([]);
    setStatus("loading");
    async function load() {
      try {
        const response = await fetch("/api/coach/reports", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          setStatus("guest");
          return;
        }
        if (!response.ok) throw new Error("History unavailable");
        const result = (await response.json()) as { reports?: SavedReview[] };
        if (controller.signal.aborted) return;
        if (!Array.isArray(result.reports)) throw new Error("Invalid reports");
        setReports(result.reports);
        setStatus("ready");
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }
    void load();
    const subscription = getSupabaseBrowserClient()?.auth.onAuthStateChange(
      (event, session) => {
        const next = session?.user.id ?? null;
        if (event === "INITIAL_SESSION") {
          owner.current = next;
          return;
        }
        if (event === "SIGNED_OUT") {
          owner.current = null;
          controller.abort();
          setReports([]);
          setStatus("guest");
        } else if (event === "SIGNED_IN" && owner.current !== next) {
          owner.current = next;
          controller.abort();
          setReports([]);
          setStatus("loading");
          setRevision((value) => value + 1);
        }
      },
    ).data.subscription;
    return () => {
      controller.abort();
      subscription?.unsubscribe();
    };
  }, [revision]);
  const actualDifficulty = mode === "ranked" ? "Intermediate" : difficulty;
  const dashboard = useMemo(() => buildLearningDashboard(reports, mode, actualDifficulty, windowSize), [reports, mode, actualDifficulty, windowSize]);
  const { learning, trends, recommendation } = dashboard;
  const lead = recommendation.focus;
  const accuracyChange = trends.comparison.accuracyChange;
  const lesson = LESSONS[lead?.key ?? "unnecessary-guess"];
  useEffect(() => { setAnswer(null); }, [mode, actualDifficulty, windowSize, lead?.key, revision, status]);
  function switchMode(value: ReviewMode) {
    setView((old) => ({ ...old, mode: value }));
    setAnswer(null);
  }
  return (
    <section className="coach-personalized" aria-label="Personalized coaching">
      <div className="coach-personalized-heading">
        <h2>
          <button
            type="button"
            className="profile-history-toggle"
            aria-expanded={expanded}
            aria-controls="personalized-coaching-body"
            onClick={() => setView((old) => ({ ...old, expanded: !old.expanded }))}
          >
            <ChartNoAxesCombined size={20} aria-hidden="true" /> Your learning progress{" "}
            <ChevronDown
              size={18}
              aria-hidden="true"
              className={
                expanded
                  ? "profile-history-chevron"
                  : "profile-history-chevron is-collapsed"
              }
            />
          </button>
        </h2>
        {status === "ready" && (
          <span className="coach-card-count">
            {reports.length} saved {reports.length === 1 ? "review" : "reviews"}
          </span>
        )}
      </div>
      <p className="verified-note">
        Learn from your saved reviews.
      </p>
      <div id="personalized-coaching-body" hidden={!expanded}>
        {status === "loading" ? (
          <p role="status">Loading saved reports…</p>
        ) : status === "guest" ? (
          <p>Sign in to track progress across devices.</p>
        ) : status === "error" ? (
          <div>
            <p role="alert">Saved reports could not be loaded.</p>
            <button
              type="button"
              className="coach-btn secondary"
              onClick={() => setRevision((value) => value + 1)}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="coach-learning-filters">
              <label>
                Mode
                <select
                  value={mode}
                  onChange={(event) => switchMode(event.target.value as ReviewMode)}
                >
                  <option value="practice">Practice</option>
                  <option value="ranked">Ranked</option>
                </select>
              </label>
              <label>
                Difficulty
                <select
                  value={actualDifficulty}
                  disabled={mode === "ranked"}
                  onChange={(event) => {
                    const difficulty = event.target.value;
                    setView((old) => ({ ...old, difficulty }));
                    setAnswer(null);
                  }}
                >
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Expert</option>
                </select>
              </label>
              <label>
                Reviewed games
                <select
                  value={windowSize}
                  onChange={(event) => {
                    const windowSize = Number(event.target.value);
                    setView((old) => ({ ...old, windowSize }));
                    setAnswer(null);
                  }}
                >
                  {REVIEW_WINDOWS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="verified-note">
              {learning.selected.length} of {windowSize} saved reviews
            </p>
            {!learning.selected.length ? (
              <p>
                No eligible saved reviews for this mode and difficulty yet. Open a completed game
                and select Save coaching report.
              </p>
            ) : (
              <>
                <div className="coach-learning-metrics">
                  <div>
                    <span>Proven decision accuracy</span>
                    <strong>
                      {formatLearningPercent(learning.evidence.decisionAccuracy.percent)}
                    </strong>
                    {learning.metrics.accuracy !== null && (
                      <progress className="coach-learning-metric-bar" aria-label="Proven decision accuracy" max={100} value={learning.metrics.accuracy} />
                    )}
                    <small>{learning.metrics.good} good · {learning.metrics.mistakes} mistakes</small>
                  </div>
                  <div>
                    <span>Average learning score</span>
                    <strong>
                      {learning.metrics.score === null
                        ? "—"
                        : `${learning.metrics.score}/100`}
                    </strong>
                    {learning.metrics.score !== null && (
                      <progress className="coach-learning-metric-bar" aria-label="Average learning score" max={100} value={learning.metrics.score} />
                    )}
                    <small>{learning.metrics.graded} graded {learning.metrics.graded === 1 ? "review" : "reviews"}</small>
                  </div>
                  <div>
                    <span>Accuracy change</span>
                    <strong className="coach-learning-change" data-direction={accuracyChange === null ? "unknown" : accuracyChange > 0 ? "up" : accuracyChange < 0 ? "down" : "flat"}>
                      {formatLearningChange(accuracyChange)}
                    </strong>
                    <small>{learning.selected.length < 10
                      ? "Needs at least 10 reviews of this mode and difficulty."
                      : trendAvailability(trends.comparison)}</small>
                  </div>
                </div>
                <LearningDashboardDetail dashboard={dashboard} />
                <details
                  className="coach-learning-disclosure coach-learning-method"
                  open={sections.method}
                >
                  <summary>How progress is measured</summary>
                  <p>
                    {learning.metrics.good} proven good moves ·{" "}
                    {learning.metrics.mistakes} proven mistakes ·{" "}
                    {learning.metrics.uncertain} uncertain moves (excluded from accuracy).
                  </p>
                  <p>
                    Practice evidence is player-recorded; Ranked recordings are
                    server-verified. Accuracy change compares equal halves of the
                    available window, with at least five assessed games and 20 assessed decisions per half.{" "}
                    {learning.metrics.graded} games have a learning score.
                  </p>
                </details>
                <div
                  className="coach-learning-plan"
                  key={`${mode}-${actualDifficulty}-${lead?.key ?? "starter"}`}
                >
                  <div className="coach-learning-focus">
                    <p className="coach-learning-kicker">
                      <Target size={17} aria-hidden="true" />{" "}
                      {lead
                        ? lead.games >= 2
                          ? "Your current focus"
                          : "Suggested focus (one game)"
                        : recommendation.kind === "reinforce" ? "Reinforce supported decisions" : "Starter practice focus"}
                    </p>
                    <h3>{recommendation.title}</h3>
                    <p>{recommendation.goal}</p>
                    <p className="verified-note">{recommendation.reason}</p>
                    {recommendation.history && <p className="verified-note">Earlier {recommendation.history.older.games} games: {recommendation.history.older.occurrences} verified instances. Recent {recommendation.history.recent.games} games: {recommendation.history.recent.occurrences} verified instances.</p>}
                    <p className="verified-note">
                      {lead
                        ? lead.games >= 2
                          ? `Observed in ${lead.games} saved games.`
                          : "A useful lesson from one game; not yet a recurring pattern."
                        : "General practice, not a diagnosis of your play."}
                    </p>
                    <div className="coach-review-actions">
                      {lead?.example && (
                        <button
                          type="button"
                          className="coach-btn"
                          onClick={() =>
                            onReview(mode, lead.example!.gameRef, lead.example!.move)
                          }
                        >
                          Review lesson
                        </button>
                      )}
                      <button
                        type="button"
                        className="coach-btn secondary"
                        onClick={() => {
                          const drill = document.getElementById(
                            "coach-quick-drill",
                          ) as HTMLDetailsElement | null;
                          if (drill) {
                            drill.open = true;
                            drill
                              .querySelector("summary")
                              ?.focus({ preventScroll: true });
                            drill.scrollIntoView({ block: "nearest" });
                          }
                        }}
                      >
                        Try quick drill
                      </button>
                    </div>
                  </div>
                  <details
                    className="coach-learning-disclosure"
                    id="coach-quick-drill"
                    open={sections.drill}
                  >
                    <summary>
                      Quick drill <span>{lead ? "1 question" : "General practice · 1 question"}</span>
                    </summary>
                    <div className="coach-learning-detail">
                      <p>{lesson.question}</p>
                      <div className="coach-drill-options">
                        {lesson.options.map((option, i) => (
                          <button
                            type="button"
                            className="coach-btn secondary"
                            key={option}
                            aria-pressed={answer === i}
                            onClick={() => setAnswer(i)}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                      {answer !== null && (
                        <div
                          role="status"
                          className="coach-drill-feedback"
                          data-correct={answer === lesson.answer}
                        >
                          <strong>
                            {answer === lesson.answer ? "Correct." : "Not quite."}
                          </strong>
                          <p>{lesson.explanation}</p>
                        </div>
                      )}
                    </div>
                  </details>
                  <details className="coach-learning-disclosure" open={sections.plan}>
                    <summary>
                      Your next three games <span>Training plan</span>
                    </summary>
                    <div className="coach-learning-detail">
                      <ol className="coach-training-steps">
                        <li>Play {recommendation.objective.practiceGames} {actualDifficulty} Practice games.</li>
                        <li>
                          {recommendation.objective.habit}
                        </li>
                        <li>{recommendation.objective.evaluation}</li>
                      </ol>
                      {mode === "ranked" && (
                        <p className="verified-note">
                          Practice the lesson outside Ranked. Compare future Ranked
                          reviews separately.
                        </p>
                      )}
                    </div>
                  </details>
                </div>
                <details className="coach-learning-disclosure" open={sections.patterns}>
                  <summary>
                    Mistake patterns{" "}
                    <span>
                      {learning.patterns.filter((pattern) => pattern.games > 0).length}{" "}
                      found
                    </span>
                  </summary>
                  <div className="coach-learning-detail">
                    {learning.patterns.some((pattern) => pattern.games > 0) ? (
                      <ul className="coach-learning-patterns">
                        {learning.patterns
                          .filter((pattern) => pattern.games > 0)
                          .map((pattern) => (
                            <li key={pattern.key}>
                              <div>
                                <strong>{LESSONS[pattern.key].title}</strong>
                                <p>
                                  {pattern.occurrences}{" "}
                                  {pattern.occurrences === 1 ? "move" : "moves"} in{" "}
                                  {pattern.games} {pattern.games === 1 ? "game" : "games"}
                                  {pattern.games < 2 ? " · not yet recurring" : ""}
                                </p>
                              </div>
                              {pattern.example && (
                                <button
                                  type="button"
                                  className="coach-btn secondary"
                                  onClick={() =>
                                    onReview(
                                      mode,
                                      pattern.example!.gameRef,
                                      pattern.example!.move,
                                    )
                                  }
                                >
                                  Review example
                                </button>
                              )}
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <p>
                        No proven mistakes in these reviews. Uncertain decisions are not
                        assumed safe, and zero mistakes does not establish mastery.
                      </p>
                    )}
                  </div>
                </details>
                <details
                  className="coach-saved-reports coach-learning-disclosure"
                  open={sections.saved}
                >
                  <summary>
                    Saved reports <span>{learning.selected.length} reviews</span>
                  </summary>
                  <ul className="coach-learning-patterns coach-saved-report-list">
                    {learning.selected.map((item) => (
                      <li key={item.gameRef}>
                        <div className="coach-saved-report-header">
                          <strong>
                            {item.difficulty} ·{" "}
                            {item.outcome === "win" ? "Victory" : "Loss"}
                          </strong>
                          <span>
                            {new Date(item.completedAt).toLocaleDateString()}
                          </span>
                          <span className="coach-learning-report-grade" data-grade={item.review.score.grade ?? "none"}>
                            <strong>{item.review.score.grade ?? "Ungraded"}</strong>
                            {item.review.score.score !== null && <small>{item.review.score.score}/100</small>}
                          </span>
                        </div>
                        <p>
                          {item.review.report.moments[0]?.category ??
                            "No proven teaching moment"}
                        </p>
                        <div className="coach-saved-report-actions">
                          <button
                            type="button"
                            className="coach-btn secondary"
                            onClick={() => onReview(item.mode, item.gameRef)}
                          >
                            Open replay
                          </button>
                          {item.review.report.moments[0] && (
                            <button
                              type="button"
                              className="coach-btn coach-history-action"
                              onClick={() =>
                                onReview(
                                  item.mode,
                                  item.gameRef,
                                  item.review.report.moments[0].moveNumber,
                                )
                              }
                            >
                              Review key move
                            </button>
                          )}
                        </div>
                        <details
                          className="coach-learning-findings"
                          open={sections.findings}
                        >
                          <summary>
                            Saved findings ({item.review.report.moments.length})
                          </summary>
                          <p>{item.review.report.takeaway}</p>
                          {item.review.report.moments.map((moment) => (
                            <div className="coach-saved-finding" key={moment.id}>
                              <strong>{moment.category}</strong>
                              <p>
                                {moment.finding} {moment.evidence}
                              </p>
                              <button
                                type="button"
                                className="coach-btn secondary"
                                onClick={() =>
                                  onReview(item.mode, item.gameRef, moment.moveNumber)
                                }
                              >
                                Review move
                              </button>
                            </div>
                          ))}
                        </details>
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
