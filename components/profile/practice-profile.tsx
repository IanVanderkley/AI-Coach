"use client";

import Link from "next/link";
import { Gamepad2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { RankedHistory } from "@/components/profile/ranked-history"; // AI_COACH_RANKED_HISTORY_V1
import { PlayerModeCard } from "@/components/profile/player-mode-card";
import { ProfileLevelCard } from "@/components/profile/profile-level-card";
import { CompetitiveRankCard } from "@/components/profile/competitive-rank-card";
import { PracticeDifficultyStats } from "@/components/profile/practice-difficulty-stats";
import {
  parseRankedLifetimeResponse,
  type RankedLifetimeStats,
} from "@/lib/profile/ranked-lifetime";
import { summarizePracticeDifficulties } from "@/lib/profile/practice-difficulty";
import {
  loadPracticeAccountTracking,
  type PracticeAccountTracking,
} from "@/lib/profile/practice-account-tracking";
import type { RankedHistoryEntry } from "@/lib/ranked/history";
import {
  summarizeRecentOutcomes,
  combineRecentStats,
  showRecentCount,
  showRecentWinRate,
} from "@/lib/profile/player-dashboard";
import type { SavedPracticeSession } from "@/lib/practice/history";
import { createPracticeRepository } from "@/lib/practice/repository";

// The revised MVP intentionally does not pretend to have permanent player
// rankings, lifetime statistics, improvement trends or verified mistake rates.
export function PracticeProfile() {
  const [games, setGames] = useState<SavedPracticeSession[] | null>(null);
  const [storageMode, setStorageMode] = useState<"local" | "account">("local");
  const [loadError, setLoadError] = useState(false);
  // AI_COACH_PLAYER_DASHBOARD_V1: these stats describe available recent records, never all-time results.
  const [rankedMatches, setRankedMatches] = useState<RankedHistoryEntry[] | null>(null);
  // AI_COACH_LIFETIME_RANKED_V1: the lifetime total comes only from an authenticated server endpoint.
  const [rankedLifetime, setRankedLifetime] = useState<RankedLifetimeStats | null>(null);
  // AI_COACH_PRACTICE_TRACKED_V1: owner-scoped, self-recorded Practice totals.
  const [practiceTracking, setPracticeTracking] =
    useState<PracticeAccountTracking | null>(null);
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

  useEffect(() => {
    let active = true;
    setPracticeTracking(null);
    if (storageMode === "account" && games !== null && !loadError) {
      void loadPracticeAccountTracking()
        .then((lookup) => {
          if (active)
            setPracticeTracking(lookup.kind === "ready" ? lookup.tracking : null);
        })
        .catch(() => {
          // No fabricated totals if the database migration is not installed.
          if (active) setPracticeTracking(null);
        });
    }
    return () => {
      active = false;
    };
  }, [storageMode, games, loadError]);

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

  const accountPracticeTracking = storageMode === "account" ? practiceTracking : null;
  const trackedOverallStats =
    accountPracticeTracking && rankedLifetime
      ? combineRecentStats(accountPracticeTracking.overall, rankedLifetime)
      : null;
  const displayOverallStats = trackedOverallStats ?? overallStats;

  return (
    <main className="page-shell profile-page player-dashboard-page">
      <div className="profile-heading">
        <div>
          <h1>
            Player Dashboard<span className="title-period">.</span>
          </h1>
        </div>
        <div className="profile-heading-side">
          <ProfileLevelCard compact />
          <div className="profile-actions">
            <Link className="profile-play-link" href="/">
              <Gamepad2 size={17} aria-hidden="true" /> Back to Play
            </Link>
          </div>
        </div>
      </div>

      <CompetitiveRankCard />

      <section
        className="player-dashboard-overview"
        aria-labelledby="player-overall-title"
      >
        <div className="player-dashboard-heading">
          <div>
            <h2 id="player-overall-title">Overall Statistics</h2>
          </div>
          <span className="player-dashboard-status">
            <ShieldCheck size={14} aria-hidden="true" />{" "}
            {trackedOverallStats ? "Lifetime recorded results" : "Recent records only"}
          </span>
        </div>
        <div className="player-dashboard-metrics">
          <div className="player-dashboard-metric">
            <span>Games played</span>
            <strong>{showRecentCount(displayOverallStats?.games ?? null)}</strong>
          </div>
          <div className="player-dashboard-metric">
            <span>Wins</span>
            <strong>{showRecentCount(displayOverallStats?.wins ?? null)}</strong>
          </div>
          <div className="player-dashboard-metric">
            <span>Losses</span>
            <strong>{showRecentCount(displayOverallStats?.losses ?? null)}</strong>
          </div>
          <div className="player-dashboard-metric">
            <span>Win rate</span>
            <strong className="metric-accent">
              {showRecentWinRate(displayOverallStats?.winRate)}
            </strong>
          </div>
        </div>
      </section>

      <div
        className="player-dashboard-mode-grid"
        aria-label="Recent results by game mode"
      >
        <PlayerModeCard
          mode="ranked"
          stats={rankedLifetime}
          scope="lifetime"
        />
        <PlayerModeCard
          mode="practice"
          stats={accountPracticeTracking?.overall ?? practiceStats}
          scope={accountPracticeTracking ? "tracked" : "recent"}
        />
      </div>

      <PracticeDifficultyStats
        breakdown={accountPracticeTracking?.breakdown ?? practiceDifficulties}
        scope={accountPracticeTracking ? "tracked" : "recent"}
      />

      <RankedHistory onRecentMatches={setRankedMatches} summaryOnly />

    </main>
  );
}
