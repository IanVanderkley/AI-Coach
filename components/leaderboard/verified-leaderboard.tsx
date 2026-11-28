"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Clock3, Medal, RefreshCw, Trophy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatRankedDuration } from "@/lib/ranked/result-summary";
import { competitiveRank } from "@/lib/leaderboard/rank-policy";
import { displayRank, type RankDisplayVersion } from "@/lib/leaderboard/rank-display";
import {
  PUBLIC_RATING_SYSTEM_V4,
  PUBLIC_USERNAME_PATTERN,
} from "@/lib/leaderboard/public-standings";
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

function CompetitiveRankCell({
  rating,
  policyVersion,
}: {
  rating: number;
  policyVersion: RankDisplayVersion;
}) {
  const rank = policyVersion === 4 ? displayRank(rating, 4) : competitiveRank(rating);
  return (
    <span className="leaderboard-competitive-rank">
      <RankEmblem rating={rating} size={64} decorative policyVersion={policyVersion} />
      <span style={{ color: rank.color }}>{rank.label}</span>
    </span>
  );
}

function LeaderboardPodium({
  standings,
  tab,
  ownName,
}: {
  standings: PublicStandings;
  tab: "elo" | "fastest";
  ownName: string | null;
}) {
  const version: RankDisplayVersion =
    standings.ratingSystem === PUBLIC_RATING_SYSTEM_V4 ? 4 : 3;
  const leaders = standings[tab].slice(0, 3);
  return (
    <section
      className="leaderboard-podium"
      aria-label={tab === "elo" ? "Top Elo players" : "Fastest victories"}
    >
      {leaders.map((entry) => (
        <article
          key={entry.rank}
          className="leaderboard-podium-place"
          data-place={entry.rank}
          data-own={entry.username === ownName}
        >
          <span className="leaderboard-podium-position">
            <Medal size={17} aria-hidden="true" /> #{entry.rank}
          </span>
          {"rating" in entry ? (
            <>
              <RankEmblem
                rating={entry.rating}
                size={112}
                decorative
                policyVersion={version}
              />
              <strong className="leaderboard-podium-name">{entry.username}</strong>
              <span
                className="leaderboard-podium-rank"
                style={{ color: displayRank(entry.rating, version).color }}
              >
                {displayRank(entry.rating, version).label}
              </span>
              <strong className="leaderboard-podium-score">
                {entry.rating.toLocaleString()} <small>Elo</small>
              </strong>
            </>
          ) : (
            <>
              <Clock3 className="leaderboard-podium-clock" size={56} aria-hidden="true" />
              <strong className="leaderboard-podium-name">{entry.username}</strong>
              <strong className="leaderboard-podium-score">
                {formatRankedDuration(entry.durationMs)}
              </strong>
            </>
          )}
          {entry.username === ownName && <span className="leaderboard-you">You</span>}
        </article>
      ))}
    </section>
  );
}

/** Both boards are read-only, privacy-filtered, and server-derived. */
export function VerifiedLeaderboard() {
  const [board, setBoard] = useState<BoardState>({ kind: "loading" });
  const [tab, setTab] = useState<"elo" | "fastest">("elo");
  const controllerRef = useRef<AbortController | null>(null);
  const [ownName, setOwnName] = useState<string | null>(null);

  const loadResults = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setBoard({ kind: "loading" });
    setOwnName(null);
    // Optional private lookup never blocks the public standings or reveals hidden players.
    void (async () => {
      try {
        const response = await fetch("/api/leaderboard/preferences", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        if (
          !controller.signal.aborted &&
          data?.isAnonymous === false &&
          typeof data.username === "string" &&
          PUBLIC_USERNAME_PATTERN.test(data.username)
        ) {
          setOwnName(data.username);
        }
      } catch {
        /* Public standings are still usable. */
      }
    })();
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = getSupabaseBrowserClient()?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN" || event === "USER_UPDATED") {
        controllerRef.current?.abort();
        setOwnName(null);
        clearTimeout(timer);
        timer = setTimeout(() => void loadResults(), 0);
      }
    });
    const refresh = () => void loadResults();
    window.addEventListener("ai-coach:username-updated", refresh);
    return () => {
      clearTimeout(timer);
      subscription?.data.subscription.unsubscribe();
      window.removeEventListener("ai-coach:username-updated", refresh);
      controllerRef.current?.abort();
    };
  }, [loadResults]);

  const standings = board.kind === "ready" ? board.standings : null;
  const resultCount = standings ? standings[tab].length : 0;

  return (
    <section className="verified-board" aria-labelledby="verified-board-title">
      <div className="verified-board-heading">
        <div>
          <h2 id="verified-board-title">Ranked standings</h2>
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
          <LeaderboardPodium standings={standings} tab={tab} ownName={ownName} />
          <p className="verified-board-count" role="status">
            {resultCount} public {resultCount === 1 ? "player" : "players"}
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
                      <tr
                        key={`rating-${entry.rank}-${entry.username}`}
                        data-own={entry.username === ownName}
                      >
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
                        <td className="leaderboard-username">
                          {entry.username}
                          {entry.username === ownName && (
                            <span className="leaderboard-you">You</span>
                          )}
                        </td>
                        <td className="leaderboard-rating">
                          {entry.rating.toLocaleString()}
                        </td>
                        <td>
                          <CompetitiveRankCell
                            rating={entry.rating}
                            policyVersion={
                              standings.ratingSystem === PUBLIC_RATING_SYSTEM_V4 ? 4 : 3
                            }
                          />
                        </td>
                        <td>{entry.wins}</td>
                        <td>{entry.losses}</td>
                      </tr>
                    ))
                  : standings.fastest.map((entry) => (
                      <tr
                        key={`speed-${entry.rank}-${entry.username}`}
                        data-own={entry.username === ownName}
                      >
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
                        <td className="leaderboard-username">
                          {entry.username}
                          {entry.username === ownName && (
                            <span className="leaderboard-you">You</span>
                          )}
                        </td>
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
      {/* Visibility controls live in the page footer; ranking rules remain in the Ranked guide. */}
    </section>
  );
}
