"use client";

import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  Gamepad2,
  Play,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { RankedHistory } from "@/components/profile/ranked-history"; // AI_COACH_RANKED_HISTORY_V1
import { PlayerModeCard } from "@/components/profile/player-mode-card";
import { PracticeDifficultyStats } from "@/components/profile/practice-difficulty-stats";
import {
  parseRankedLifetimeResponse,
  type RankedLifetimeStats,
} from "@/lib/profile/ranked-lifetime";
import { summarizePracticeDifficulties } from "@/lib/profile/practice-difficulty";
import type { RankedHistoryEntry } from "@/lib/ranked/history";
import {
  summarizeRecentOutcomes,
  combineRecentStats,
  showRecentCount,
  showRecentWinRate,
} from "@/lib/profile/player-dashboard";
import type { SavedPracticeSession } from "@/lib/practice/history";
import { createPracticeRepository } from "@/lib/practice/repository";

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// The revised MVP intentionally does not pretend to have permanent player
// rankings, lifetime statistics, improvement trends or verified mistake rates.
export function PracticeProfile() {
  const [games, setGames] = useState<SavedPracticeSession[] | null>(null);
  const [storageMode, setStorageMode] = useState<"local" | "account">("local");
  const [loadError, setLoadError] = useState(false);
  // AI_COACH_COLLAPSIBLE_HISTORY_V1
  const [practiceExpanded, setPracticeExpanded] = useState(true);
  // AI_COACH_PLAYER_DASHBOARD_V1: these stats describe available recent records, never all-time results.
  const [rankedMatches, setRankedMatches] = useState<RankedHistoryEntry[] | null>(null);
  // AI_COACH_LIFETIME_RANKED_V1: the lifetime total comes only from an authenticated server endpoint.
  const [rankedLifetime, setRankedLifetime] = useState<RankedLifetimeStats | null>(null);
  const repository = useMemo(() => createPracticeRepository(), []);

  useEffect(() => {
    let active = true;
    void Promise.all([repository.listRecent(), repository.getStorageMode()])
      .then(([recentGames, mode]) => {
        if (!active) return;
        setGames(recentGames);
        setStorageMode(mode);
      })
      .catch(() => {
        if (active) {
          setGames([]);
          setLoadError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [repository]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function loadRankedLifetime() {
      try {
        const response = await fetch("/api/profile/ranked-lifetime", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Ranked lifetime unavailable");
        const payload: unknown = await response.json();
        const verified = parseRankedLifetimeResponse(payload);
        if (active) setRankedLifetime(verified);
      } catch {
        if (active) setRankedLifetime(null);
      }
    }
    void loadRankedLifetime();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const summary = useMemo(() => {
    const current = games ?? [];
    return {
      wins: current.filter((game) => game.outcome === "win").length,
      losses: current.filter((game) => game.outcome === "loss").length,
      total: current.length,
    };
  }, [games]);

  const practiceStats = useMemo(() => {
    if (games === null || loadError) return null;
    return summarizeRecentOutcomes(games.map((game) => game.outcome));
  }, [games, loadError]);
  const rankedStats = useMemo(() => {
    if (rankedMatches === null) return null;
    return summarizeRecentOutcomes(rankedMatches.map((game) => game.outcome));
  }, [rankedMatches]);
  const overallStats = combineRecentStats(practiceStats, rankedStats);
  const practiceDifficulties = useMemo(() => {
    if (games === null || loadError) return null;
    try {
      return summarizePracticeDifficulties(games);
    } catch {
      return null;
    }
  }, [games, loadError]);

  return (
    <main className="page-shell profile-page player-dashboard-page">
      <div className="profile-heading">
        <div>
          <p className="eyebrow">YOUR PLAYER OVERVIEW</p>
          <h1>
            Player Dashboard<span className="title-period">.</span>
          </h1>
          <p className="page-subtitle">
            Your recent results, mode performance, and match history in one place.
          </p>
        </div>
        <div className="profile-actions">
          <span className="preview-badge">
            {storageMode === "account"
              ? "Practice synced to your account"
              : "Practice history on this device"}
          </span>
          <Link className="profile-play-link" href="/">
            <Gamepad2 size={17} aria-hidden="true" /> Back to Play
          </Link>
        </div>
      </div>

      <section
        className="player-dashboard-overview"
        aria-labelledby="player-overall-title"
      >
        <div className="player-dashboard-heading">
          <div>
            <span className="player-dashboard-eyebrow">YOUR PERFORMANCE</span>
            <h2 id="player-overall-title">Overall snapshot</h2>
          </div>
          <span className="player-dashboard-status">
            <ShieldCheck size={14} aria-hidden="true" /> Recent records only
          </span>
        </div>
        <div className="player-dashboard-metrics">
          <div className="player-dashboard-metric">
            <span>Games played</span>
            <strong>{showRecentCount(overallStats?.games ?? null)}</strong>
          </div>
          <div className="player-dashboard-metric">
            <span>Wins</span>
            <strong>{showRecentCount(overallStats?.wins ?? null)}</strong>
          </div>
          <div className="player-dashboard-metric">
            <span>Losses</span>
            <strong>{showRecentCount(overallStats?.losses ?? null)}</strong>
          </div>
          <div className="player-dashboard-metric">
            <span>Win rate</span>
            <strong className="metric-accent">
              {showRecentWinRate(overallStats?.winRate)}
            </strong>
          </div>
        </div>
        <p className="player-dashboard-honesty">
          Recent saved records, not lifetime statistics. Overall numbers appear after both
          mode histories load successfully. Ranked covers up to 10 completed Intermediate
          matches; Practice history follows its account or browser retention limit.
        </p>
      </section>

      <div
        className="player-dashboard-mode-grid"
        aria-label="Recent results by game mode"
      >
        <PlayerModeCard
          mode="ranked"
          stats={rankedLifetime}
          scope="lifetime"
          fastestWinMs={rankedLifetime?.fastestWinMs ?? null}
        />
        <PlayerModeCard mode="practice" stats={practiceStats} />
      </div>

      <PracticeDifficultyStats breakdown={practiceDifficulties} />

      <div className="player-dashboard-history-heading">
        <h2>Recent matches</h2>
        <p>Expand each mode's history for recorded games. These lists remain separate.</p>
      </div>
      <RankedHistory onRecentMatches={setRankedMatches} />

      <section
        className="profile-panel practice-session-card"
        aria-labelledby="practice-history-title"
      >
        <div className="panel-heading-row">
          <div>
            <span className="profile-label">
              RECORDED PRACTICE GAMES · Recent completed Practice games
            </span>
            <h2 id="practice-history-title">
              <button
                type="button"
                className="profile-history-toggle"
                aria-expanded={practiceExpanded}
                aria-controls="practice-history-body"
                onClick={() => setPracticeExpanded((current) => !current)}
              >
                Recent Practice Matches
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
            <p className="profile-history-match-count">
              {games === null ? "Loading matches…" : String(summary.total) + " matches"}
            </p>
          </div>
          <CalendarDays size={24} aria-hidden="true" />
        </div>

        <div
          id="practice-history-body"
          hidden={!practiceExpanded}
          className="profile-history-body"
        >
          {loadError ? (
            <div className="practice-empty-history" role="alert">
              <p>
                Could not load Practice history. Check your connection and refresh this
                page.
              </p>
            </div>
          ) : games && games.length > 0 ? (
            <div className="recent-games">
              {games.map((game) => (
                <div className="recent-game practice-recent-game" key={game.id}>
                  <span className={`result-dot ${game.outcome}`} aria-hidden="true" />
                  <div className="recent-result">
                    <strong>{game.outcome === "win" ? "Win" : "Loss"}</strong>
                    <span>
                      {game.difficulty} · {game.rows} × {game.columns} ·{" "}
                      {formatDate(game.completedAt)}
                    </span>
                  </div>
                  <span className="recent-detail">
                    <Clock3 size={14} aria-hidden="true" />{" "}
                    {formatTime(game.durationSeconds)}
                  </span>
                  <span className="recent-detail">{game.moves.length} actions</span>
                  {/* Verified replay supports both square and rectangular Practice boards. */}
                  <a
                    className="practice-review-link"
                    href={
                      "/coaching?source=practice&gameId=" + encodeURIComponent(game.id)
                    }
                  >
                    <Play size={14} aria-hidden="true" /> Review game
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="practice-empty-history">
              <p>Finish a Practice game and it will appear here.</p>
              <Link className="profile-play-link" href="/">
                <Gamepad2 size={16} aria-hidden="true" /> Start a Practice Game
              </Link>
            </div>
          )}
        </div>
      </section>

      <p className="profile-disclaimer">
        {storageMode === "account"
          ? "Your account keeps up to 100 recent completed Practice games. Practice records are separate from Ranked results. This is not a lifetime win rate or an improvement claim. Coaching decisions are verified from the recorded board and actions."
          : "Up to five recent completed games are kept in this browser tab until you close it. They are not synced to an account or used for Ranked. This is not a lifetime win rate or an improvement claim. Coaching decisions are verified from the recorded board and actions."}
      </p>
    </main>
  );
}
