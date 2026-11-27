"use client";

import Link from "next/link";
import { ArrowLeft, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PracticeDifficultyStats } from "@/components/profile/practice-difficulty-stats";
import {
  loadPracticeAccountTracking,
  type PracticeAccountTracking,
} from "@/lib/profile/practice-account-tracking";
import { summarizePracticeDifficulties } from "@/lib/profile/practice-difficulty";
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

/** Owner-recorded Practice totals are never presented as verified competitive scores. */
export function PracticeStatsPage() {
  const repository = useMemo(() => createPracticeRepository(), []);
  const [history, setHistory] = useState<HistoryState>({ kind: "loading" });
  const [tracking, setTracking] = useState<PracticeAccountTracking | null>(null);

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
          <p>Track your performance by difficulty.</p>
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
              <h2>{tracked ? "Lifetime Statistics" : "Recent saved results"}</h2>
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
          </section>
          <PracticeDifficultyStats
            breakdown={breakdown}
            scope={tracked ? "tracked" : "recent"}
          />
          <Link href="/coaching#coach-history-title" className="profile-detail-play-link">
            Review matches in Coaching
          </Link>
        </>
      )}
    </main>
  );
}
