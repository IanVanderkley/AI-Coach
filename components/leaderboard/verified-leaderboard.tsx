"use client";

import Link from "next/link";
import { Clock3, Medal, RefreshCw, ShieldCheck, Trophy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatRankedDuration } from "@/lib/ranked/result-summary";
import { competitiveRank } from "@/lib/leaderboard/rank-policy";
import { displayRank, type RankDisplayVersion } from "@/lib/leaderboard/rank-display";
import { PUBLIC_RATING_SYSTEM_V4 } from "@/lib/leaderboard/public-standings";
import { RankEmblem } from "@/components/ranked/rank-emblem";
import {
  PUBLIC_LEADERBOARD_ENDPOINT,
  parsePublicStandings,
  type PublicStandings,
} from "@/lib/leaderboard/public-standings";

type BoardState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; standings: PublicStandings };

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function CompetitiveRankCell({ rating, policyVersion }: { rating: number; policyVersion: RankDisplayVersion }) {
  const rank = policyVersion === 4 ? displayRank(rating, 4) : competitiveRank(rating);
  return (
    <span className="leaderboard-competitive-rank">
      <RankEmblem rating={rating} size={64} decorative policyVersion={policyVersion} />
      <span style={{ color: rank.color }}>{rank.label}</span>
    </span>
  );
}

/** Both boards are read-only, privacy-filtered, and server-derived. */
export function VerifiedLeaderboard() {
  const [board, setBoard] = useState<BoardState>({ kind: "loading" });
  const [tab, setTab] = useState<"elo" | "fastest">("elo");
  const controllerRef = useRef<AbortController | null>(null);

  const loadResults = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setBoard({ kind: "loading" });
    try {
      const response = await fetch(PUBLIC_LEADERBOARD_ENDPOINT, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Failed to load standings.");
      const payload: unknown = await response.json();
      const standings = parsePublicStandings(payload);
      if (!controller.signal.aborted) setBoard({ kind: "ready", standings });
    } catch {
      if (!controller.signal.aborted) setBoard({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    void loadResults();
    return () => controllerRef.current?.abort();
  }, [loadResults]);

  const standings = board.kind === "ready" ? board.standings : null;
  const resultCount = standings ? standings[tab].length : 0;

  return (
    <section className="verified-board" aria-labelledby="verified-board-title">
      <div className="verified-board-heading">
        <div>
          <span className="verified-board-kicker">
            <ShieldCheck size={15} aria-hidden="true" /> Server-verified results
          </span>
          <h2 id="verified-board-title">Ranked standings</h2>
          <p>Intermediate · 16 × 16 · 40 mines · Up to 50 players per board</p>
        </div>
        <button
          type="button"
          className="verified-board-refresh"
          disabled={board.kind === "loading"}
          onClick={() => void loadResults()}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {board.kind === "loading" ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div className="leaderboard-tabs" role="group" aria-label="Leaderboard category">
        <button
          type="button"
          aria-pressed={tab === "elo"}
          className={tab === "elo" ? "leaderboard-tab active" : "leaderboard-tab"}
          onClick={() => setTab("elo")}
        >
          Elo-style rating
        </button>
        <button
          type="button"
          aria-pressed={tab === "fastest"}
          className={tab === "fastest" ? "leaderboard-tab active" : "leaderboard-tab"}
          onClick={() => setTab("fastest")}
        >
          Fastest Wins
        </button>
      </div>

      {board.kind === "loading" && (
        <div className="verified-board-message" role="status" aria-live="polite">
          Loading public Ranked standings…
        </div>
      )}
      {board.kind === "error" && (
        <div className="verified-board-message" role="alert">
          <strong>Leaderboard unavailable</strong>
          <p>
            We couldn’t load the server-verified standings. No scores have been guessed.
          </p>
          <button type="button" onClick={() => void loadResults()}>
            Try again
          </button>
        </div>
      )}
      {standings && resultCount === 0 && (
        <div className="verified-board-message verified-board-empty" role="status">
          <Trophy size={28} aria-hidden="true" />
          <strong>
            No public {tab === "elo" ? "ratings" : "verified victories"} yet
          </strong>
          <p>
            No eligible public results yet. Players can hide their results in Settings.
          </p>
        </div>
      )}
      {standings && resultCount > 0 && (
        <>
          <p className="verified-board-count" role="status">
            Showing {resultCount} public {resultCount === 1 ? "player" : "players"}.
            {tab === "elo"
              ? " Highest rating first. Ranks are determined by Elo rating."
              : " Fastest verified times first."}
          </p>
          <div className="verified-board-overflow">
            <table className="verified-board-table">
              <caption className="sr-only">
                {tab === "elo"
                  ? "Solo Elo-style ratings from server-recorded Ranked wins and losses"
                  : "Fastest verified Ranked win per publicly visible player"}
              </caption>
              <thead>
                {tab === "elo" ? (
                  <tr>
                    <th scope="col">Position</th>
                    <th scope="col">Player</th>
                    <th scope="col">Elo</th>
                    <th scope="col">Rank</th>
                    <th scope="col">Wins</th>
                    <th scope="col">Losses</th>
                  </tr>
                ) : (
                  <tr>
                    <th scope="col">Position</th>
                    <th scope="col">Player</th>
                    <th scope="col">Verified time</th>
                    <th scope="col">Completed</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {tab === "elo"
                  ? standings.elo.map((entry) => (
                      <tr key={`rating-${entry.rank}-${entry.username}`}>
                        <td>
                          <span
                            className={`verified-board-rank${entry.rank <= 3 ? ` verified-board-rank-top-${entry.rank}` : ""}`}
                          >
                            #{entry.rank}
                            {entry.rank <= 3 && (
                              <Medal size={14} aria-label="Top three" />
                            )}
                          </span>
                        </td>
                        <td className="leaderboard-username">{entry.username}</td>
                        <td className="leaderboard-rating">
                          {entry.rating.toLocaleString()}
                        </td>
                        <td>
                          <CompetitiveRankCell rating={entry.rating} policyVersion={standings.ratingSystem === PUBLIC_RATING_SYSTEM_V4 ? 4 : 3} />
                        </td>
                        <td>{entry.wins}</td>
                        <td>{entry.losses}</td>
                      </tr>
                    ))
                  : standings.fastest.map((entry) => (
                      <tr key={`speed-${entry.rank}-${entry.username}`}>
                        <td>
                          <span
                            className={`verified-board-rank${entry.rank <= 3 ? ` verified-board-rank-top-${entry.rank}` : ""}`}
                          >
                            #{entry.rank}
                            {entry.rank <= 3 && (
                              <Medal size={14} aria-label="Top three" />
                            )}
                          </span>
                        </td>
                        <td className="leaderboard-username">{entry.username}</td>
                        <td>
                          <span className="verified-board-time">
                            <Clock3 size={15} aria-hidden="true" />
                            {formatRankedDuration(entry.durationMs)}
                          </span>
                        </td>
                        <td>
                          <time dateTime={entry.finishedAt}>
                            {formatDate(entry.finishedAt)}
                          </time>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="verified-board-footnote">
        {tab === "elo"
          ? "Competitive ranks and divisions reflect saved Elo. This is solo progression, not player-versus-player matchmaking."
          : "One best server-verified victory per visible player. Times use the server clock."}{" "}
        {tab === "elo" && (
          <>
            <Link href="/ranked/rating-guide">How Elo works</Link>.{" "}
          </>
        )}
        New players are public by default; Anonymous mode hides your name and results.
        <Link href="/settings">Manage visibility</Link>.
      </p>
    </section>
  );
}
