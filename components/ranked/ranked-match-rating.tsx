"use client";

import Link from "next/link";
import { BarChart3, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import {
  formatRatingDelta,
  parseRankedMatchRating,
  type RankedMatchRating,
} from "@/lib/leaderboard/match-rating";
import { ratingTier, ratingTierClass } from "@/lib/leaderboard/rating-tier";

type RatingState =
  | { kind: "loading" }
  | { kind: "ready"; rating: RankedMatchRating }
  | { kind: "missing" }
  | { kind: "unavailable" };

export function RankedMatchRating({
  matchId,
  expectedOutcome,
}: {
  matchId: string;
  expectedOutcome: "won" | "lost";
}) {
  const [state, setState] = useState<RatingState>({ kind: "loading" });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    void (async () => {
      try {
        const response = await fetch(
          `/api/leaderboard/match-rating?matchId=${encodeURIComponent(matchId)}`,
          {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          },
        );
        if (controller.signal.aborted) return;
        if (response.status === 404) {
          setState({ kind: "missing" });
          return;
        }
        if (!response.ok) throw new Error("Rating lookup failed.");
        const value = parseRankedMatchRating(await response.json());
        if (!controller.signal.aborted) {
          setState(
            value.outcome === expectedOutcome
              ? { kind: "ready", rating: value }
              : { kind: "unavailable" },
          );
        }
      } catch {
        if (!controller.signal.aborted) setState({ kind: "unavailable" });
      }
    })();
    return () => controller.abort();
  }, [matchId, expectedOutcome, revision]);

  const value = state.kind === "ready" ? state.rating : null;
  const tier = value ? ratingTier(value.ratingAfter) : null;

  return (
    <section className="ranked-rating-receipt" aria-label="Verified Ranked rating change">
      <div className="ranked-rating-heading">
        <span>
          <BarChart3 size={18} aria-hidden="true" /> Elo-style rating
        </span>
        {value && (
          <span className="ranked-rating-trust">
            <ShieldCheck size={14} aria-hidden="true" /> Verified match
          </span>
        )}
      </div>
      {state.kind === "loading" && <p role="status">Loading saved rating change…</p>}
      {value && tier && (
        <>
          <div className="ranked-rating-summary" role="status">
            <div>
              <span>Before</span>
              <strong>{value.ratingBefore.toLocaleString()}</strong>
            </div>
            <div>
              <span>Change</span>
              <strong className={value.ratingDelta >= 0 ? "rating-gain" : "rating-loss"}>
                {formatRatingDelta(value.ratingDelta)}
              </strong>
            </div>
            <div>
              <span>New rating</span>
              <strong>{value.ratingAfter.toLocaleString()}</strong>
            </div>
          </div>
          <p className="ranked-rating-tier">
            Rating milestone:{" "}
            <span className={`rating-tier ${ratingTierClass(tier)}`}>{tier}</span>
          </p>
        </>
      )}
      {state.kind === "missing" && (
        <p role="status">No rating event is recorded for this match.</p>
      )}
      {state.kind === "unavailable" && (
        <p role="alert">
          Couldn’t verify this match’s rating change. No points have been assumed.
        </p>
      )}
      <div className="ranked-rating-footer">
        <span>Solo rating, not competitive RP or matchmaking tiers.</span>
        <div>
          <Link href="/leaderboard">Leaderboard</Link>
          {state.kind !== "loading" && (
            <button type="button" onClick={() => setRevision((n) => n + 1)}>
              <RefreshCw size={13} aria-hidden="true" /> Retry
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
