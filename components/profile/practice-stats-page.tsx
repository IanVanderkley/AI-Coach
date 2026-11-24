"use client";

import Link from "next/link";
import { ArrowLeft, Clock3, Gamepad2, Play, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PracticeDifficultyStats } from "@/components/profile/practice-difficulty-stats";
import {
  loadPracticeAccountTracking,
  type PracticeAccountTracking,
} from "@/lib/profile/practice-account-tracking";
import {
  summarizePracticeDifficulties,
  PRACTICE_DIFFICULTIES,
  type PracticeDifficulty,
} from "@/lib/profile/practice-difficulty";
import {
  showRecentCount,
  showRecentWinRate,
  summarizeRecentOutcomes,
} from "@/lib/profile/player-dashboard";
import type { SavedPracticeSession } from "@/lib/practice/history";
import { createPracticeRepository } from "@/lib/practice/repository";

type HistoryState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; games: SavedPracticeSession[]; scope: "local" | "account" };

type DifficultyFilter = "All" | PracticeDifficulty;

function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Owner-recorded Practice totals are never presented as verified competitive scores. */
export function PracticeStatsPage() {
  const repository = useMemo(() => createPracticeRepository(), []);
  const [history, setHistory] = useState<HistoryState>({ kind: "loading" });
  const [tracking, setTracking] = useState<PracticeAccountTracking | null>(null);
  const [filter, setFilter] = useState<DifficultyFilter>("All");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        // listRecent also synchronizes pending browser recordings before reading cloud history.
        const games = await repository.listRecent();
        const scope = await repository.getStorageMode();
        if (!active) return;
        setHistory({ kind: "ready", games, scope });
        if (scope === "account") {
          try {
            const result = await loadPracticeAccountTracking();
            if (active) setTracking(result.kind === "ready" ? result.tracking : null);
          } catch {
            if (active) setTracking(null);
          }
        }
      } catch {
        if (active) setHistory({ kind: "error" });
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [repository]);

  const recent = history.kind === "ready" ? history.games : null;
  const savedSummary = useMemo(() => {
    if (recent === null) return null;
    return summarizeRecentOutcomes(recent.map((game) => game.outcome));
  }, [recent]);
  const savedBreakdown = useMemo(() => {
    if (recent === null) return null;
    try {
      return summarizePracticeDifficulties(recent);
    } catch {
      return null;
    }
  }, [recent]);
  const tracked =
    history.kind === "ready" && history.scope === "account" ? tracking : null;
  const stats = tracked?.overall ?? savedSummary;
  const breakdown = tracked?.breakdown ?? savedBreakdown;
  const filtered = useMemo(
    () => (recent ?? []).filter((game) => filter === "All" || game.difficulty === filter),
    [recent, filter],
  );

  return (
    <main className="page-shell profile-detail-page">
      <Link href="/profile" className="profile-detail-back">
        <ArrowLeft size={16} aria-hidden="true" /> Back to player dashboard
      </Link>
      <div className="profile-detail-hero practice-detail-hero">
        <div>
          <span className="player-dashboard-eyebrow">YOUR PRACTICE PERFORMANCE</span>
          <h1>
            Practice Statistics<span className="title-period">.</span>
          </h1>
          <p>Track your progress by difficulty and revisit recorded games.</p>
        </div>
        <Target size={38} aria-hidden="true" />
      </div>

      {history.kind === "loading" && <p role="status">Loading saved Practice games…</p>}
      {history.kind === "error" && (
        <p role="alert" className="profile-detail-message">
          Practice history is unavailable right now. Your results have not been changed.
        </p>
      )}
      {history.kind === "ready" && (
        <>
          <section
            className="profile-detail-panel"
            aria-label="Recorded Practice results"
          >
            <div className="profile-detail-panel-heading">
              <h2>{tracked ? "Tracked account results" : "Recent saved results"}</h2>
              <span>
                {tracked
                  ? "Account-recorded, not server-verified"
                  : "Retained games only"}
              </span>
            </div>
            <div className="profile-detail-metrics">
              <div>
                <span>Games played</span>
                <strong>{showRecentCount(stats?.games ?? null)}</strong>
              </div>
              <div>
                <span>Wins</span>
                <strong>{showRecentCount(stats?.wins ?? null)}</strong>
              </div>
              <div>
                <span>Losses</span>
                <strong>{showRecentCount(stats?.losses ?? null)}</strong>
              </div>
              <div>
                <span>Win rate</span>
                <strong>{showRecentWinRate(stats?.winRate)}</strong>
              </div>
            </div>
            <p className="profile-detail-note">
              {tracked
                ? "Tracking includes complete games retained at activation plus subsequent synced results. Games deleted before activation cannot be recovered."
                : "These numbers only cover saved games in this browser or account. Sign in for persistent tracked account totals."}
            </p>
          </section>
          <PracticeDifficultyStats
            breakdown={breakdown}
            scope={tracked ? "tracked" : "recent"}
          />
          <section
            className="profile-detail-history"
            aria-labelledby="practice-detail-history-title"
          >
            <div className="profile-detail-section-title">
              <div>
                <h2 id="practice-detail-history-title">Recent Practice matches</h2>
                <p>Only saved recordings are shown here. Tracked totals can be higher.</p>
              </div>
              <Link href="/" className="profile-detail-play-link">
                <Gamepad2 size={15} /> Play Practice
              </Link>
            </div>
            <div className="profile-detail-filter-row">
              <label htmlFor="practice-detail-filter">Difficulty</label>
              <select
                id="practice-detail-filter"
                value={filter}
                onChange={(event) => setFilter(event.target.value as DifficultyFilter)}
              >
                <option value="All">All difficulties</option>
                {PRACTICE_DIFFICULTIES.map((difficulty) => (
                  <option key={difficulty} value={difficulty}>
                    {difficulty}
                  </option>
                ))}
              </select>
              <span aria-live="polite">{filtered.length} matches</span>
            </div>
            {filtered.length === 0 ? (
              <p className="profile-detail-message">
                No saved matches for this difficulty yet.
              </p>
            ) : (
              <ol className="profile-detail-match-list">
                {filtered.map((game) => (
                  <li key={game.id}>
                    <span
                      className={
                        game.outcome === "win"
                          ? "detail-outcome-win"
                          : "detail-outcome-loss"
                      }
                    >
                      {game.outcome === "win" ? "Win" : "Loss"}
                    </span>
                    <span>
                      {game.difficulty} · {game.rows} × {game.columns}
                    </span>
                    <span>
                      <Clock3 size={14} aria-hidden="true" />{" "}
                      {formatSeconds(game.durationSeconds)}
                    </span>
                    <time dateTime={game.completedAt}>
                      {new Date(game.completedAt).toLocaleDateString()}
                    </time>
                    <Link
                      href={`/coaching?source=practice&gameId=${encodeURIComponent(game.id)}`}
                    >
                      <Play size={14} aria-hidden="true" /> Review
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </main>
  );
}
