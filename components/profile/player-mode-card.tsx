"use client";

import Link from "next/link";
import { ChevronDown, ShieldCheck, Target } from "lucide-react";
import { useState } from "react";

import {
  showRecentCount,
  showRecentWinRate,
  type RecentStats,
} from "@/lib/profile/player-dashboard";

type PlayerModeCardProps = {
  mode: "ranked" | "practice";
  stats: RecentStats | null;
  scope?: "recent" | "lifetime" | "tracked";
};

/** Both mode summaries can be collapsed without unmounting or reloading match history. */
export function PlayerModeCard({ mode, stats, scope = "recent" }: PlayerModeCardProps) {
  const [expanded, setExpanded] = useState(true);
  const ranked = mode === "ranked";
  const verifiedLifetime = ranked && scope === "lifetime";
  const trackedPractice = !ranked && scope === "tracked";
  const label = ranked ? "Ranked" : "Practice";
  const bodyId = `player-${mode}-summary-body`;
  const historyHref = ranked
    ? "/coaching#ranked-history-title"
    : "/coaching#coach-history-title";

  return (
    <section
      className={`player-mode-card player-mode-${mode}`}
      aria-label={`${label} ${verifiedLifetime ? "verified lifetime" : trackedPractice ? "tracked account" : "recent"} results`}
    >
      <div className="player-mode-header">
        <div className="player-mode-label">
          <span className="player-mode-icon" aria-hidden="true">
            {ranked ? <ShieldCheck size={19} /> : <Target size={19} />}
          </span>
          <div>
            <span className="player-mode-eyebrow">
              {verifiedLifetime
                ? "SERVER-VERIFIED LIFETIME"
                : trackedPractice
                  ? "ACCOUNT-RECORDED LIFETIME"
                  : "RECENT RECORDED RESULTS"}
            </span>
            <h3>{label}</h3>
          </div>
        </div>
        <button
          type="button"
          className="player-mode-toggle"
          aria-label={`${expanded ? "Collapse" : "Expand"} ${label} statistics`}
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setExpanded((current) => !current)}
        >
          <ChevronDown
            className={expanded ? "" : "is-collapsed"}
            size={18}
            aria-hidden="true"
          />
        </button>
      </div>
      <div id={bodyId} className="player-mode-body" hidden={!expanded}>
        <div className="player-mode-main-stat">
          <strong>{showRecentWinRate(stats?.winRate)}</strong>
          <span>Win rate</span>
          <div className="dashboard-meter-slot">
            {stats?.winRate != null && (
              <progress
                className="dashboard-win-meter"
                max={100}
                value={stats.winRate}
                aria-label={`${label} win rate`}
              />
            )}
          </div>
        </div>
        <div className="player-mode-secondary">
          <div>
            <strong>{showRecentCount(stats?.games ?? null)}</strong>
            <span>Games</span>
          </div>
          <div>
            <strong>{showRecentCount(stats?.wins ?? null)}</strong>
            <span>Wins</span>
          </div>
          <div>
            <strong>{showRecentCount(stats?.losses ?? null)}</strong>
            <span>Losses</span>
          </div>
        </div>
        <div className="player-mode-actions">
          <Link className="player-mode-link" href={historyHref}>
            View recent {label.toLowerCase()} matches
          </Link>
          <Link
            className="player-mode-full-link"
            href={ranked ? "/profile/ranked" : "/profile/practice"}
          >
            Full {label} statistics
          </Link>
        </div>
      </div>
    </section>
  );
}
