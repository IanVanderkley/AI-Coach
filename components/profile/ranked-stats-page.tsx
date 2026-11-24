"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck, Trophy } from "lucide-react";
import { useEffect, useState } from "react";

import { RankedHistory } from "@/components/profile/ranked-history";
import { showRecentCount, showRecentWinRate } from "@/lib/profile/player-dashboard";
import {
  parseRankedLifetimeResponse,
  type RankedLifetimeStats,
} from "@/lib/profile/ranked-lifetime";
import { formatRankedDuration } from "@/lib/ranked/result-summary";

type StatsState =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "error" }
  | { kind: "ready"; stats: RankedLifetimeStats };

/** Only real server-verified Intermediate results; no speculative RP/placements. */
export function RankedStatsPage() {
  const [state, setState] = useState<StatsState>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function loadStats() {
      try {
        const response = await fetch("/api/profile/ranked-lifetime", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!active) return;
        if (response.status === 401) {
          setState({ kind: "guest" });
          return;
        }
        if (!response.ok) throw new Error("Ranked statistics unavailable");
        const payload: unknown = await response.json();
        const stats = parseRankedLifetimeResponse(payload);
        if (active) setState({ kind: "ready", stats });
      } catch {
        if (active) setState({ kind: "error" });
      }
    }
    void loadStats();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const stats = state.kind === "ready" ? state.stats : null;
  return (
    <main className="page-shell profile-detail-page">
      <Link href="/profile" className="profile-detail-back">
        <ArrowLeft size={16} aria-hidden="true" /> Back to player dashboard
      </Link>
      <div className="profile-detail-hero">
        <div>
          <span className="player-dashboard-eyebrow">SERVER-VERIFIED PERFORMANCE</span>
          <h1>
            Ranked Statistics<span className="title-period">.</span>
          </h1>
          <p>Lifetime results for the currently playable Intermediate Ranked board.</p>
        </div>
        <ShieldCheck size={38} aria-hidden="true" />
      </div>

      {state.kind === "loading" && <p role="status">Loading verified Ranked stats…</p>}
      {state.kind === "guest" && (
        <p role="status" className="profile-detail-message">
          <Link href="/sign-in">Sign in</Link> to see your private Ranked statistics.
        </p>
      )}
      {state.kind === "error" && (
        <p role="alert" className="profile-detail-message">
          Ranked statistics are unavailable right now. No values have been guessed.
        </p>
      )}
      {stats && (
        <>
          <section
            className="profile-detail-panel"
            aria-label="Lifetime verified Ranked results"
          >
            <div className="profile-detail-panel-heading">
              <h2>Verified career snapshot</h2>
              <span>Intermediate · 16 × 16 · 40 mines</span>
            </div>
            <div className="profile-detail-metrics">
              <div>
                <span>Games played</span>
                <strong>{showRecentCount(stats.games)}</strong>
              </div>
              <div>
                <span>Wins</span>
                <strong>{showRecentCount(stats.wins)}</strong>
              </div>
              <div>
                <span>Losses</span>
                <strong>{showRecentCount(stats.losses)}</strong>
              </div>
              <div>
                <span>Win rate</span>
                <strong>{showRecentWinRate(stats.winRate)}</strong>
              </div>
            </div>
          </section>
          <section
            className="profile-detail-best"
            aria-label="Fastest verified Ranked win"
          >
            <Trophy size={24} aria-hidden="true" />
            <div>
              <span>Fastest verified victory</span>
              <strong>
                {stats.fastestWinMs === null
                  ? "—"
                  : formatRankedDuration(stats.fastestWinMs)}
              </strong>
            </div>
            <Link href="/ranked">Play Ranked</Link>
          </section>
          <p className="profile-detail-note">
            These totals include all server-verified Intermediate wins and server-recorded
            terminal losses. Beginner and Expert Ranked are not yet playable; RP and
            placements are not active.
          </p>
        </>
      )}
      <div className="profile-detail-section-title">
        <h2>Recent Ranked matches</h2>
        <p>Your latest completed games appear below, separately from lifetime totals.</p>
      </div>
      <RankedHistory />
    </main>
  );
}
