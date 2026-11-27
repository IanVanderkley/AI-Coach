"use client";

import Link from "next/link";
import { BarChart3, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import {
  formatRatingDelta,
  parseRankedMatchRating,
  type RankedMatchRating,
} from "@/lib/leaderboard/match-rating";
import { RankEmblem } from "@/components/ranked/rank-emblem";
import { rankResultModel } from "@/lib/leaderboard/rank-result";

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
  const model = value ? rankResultModel(value) : null;

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
      {value && model && (
        <>
          <div className="ranked-rating-summary" role="status">
            <div>
              <span>Before</span>
              <strong>{value.ratingBefore.toLocaleString()}</strong>
            </div>
            <div>
              <span>Change</span>
              <strong className={value.ratingDelta >= 0 ? "rating-gain" : "rating-loss"}>
                {formatRatingDelta(value.ratingDelta, value.policyVersion)}
              </strong>
            </div>
            <div>
              <span>New rating</span>
              <strong>{value.ratingAfter.toLocaleString()}</strong>
            </div>
          </div>
          <div className="ranked-rating-transition" data-transition={model.transition}>
            <p className="ranked-rating-transition-title" role="status">
              {model.transition === "promotion"
                ? "Promoted!"
                : model.transition === "demotion"
                  ? "Demoted"
                  : "Rank after match"}
            </p>
            <div className="ranked-rating-emblems">
              {model.transition !== "unchanged" && (
                <>
                  <div className="ranked-rating-rank">
                    <RankEmblem rating={value.ratingBefore} size={112} decorative policyVersion={value.policyVersion === 4 ? 4 : 3} />
                    <span style={{ color: model.before.color }}>
                      {model.before.label}
                    </span>
                  </div>
                  <span className="ranked-rating-arrow" aria-hidden="true">
                    →
                  </span>
                </>
              )}
              <div className="ranked-rating-rank ranked-rating-current">
                <RankEmblem rating={value.ratingAfter} size={144} decorative policyVersion={value.policyVersion === 4 ? 4 : 3} />
                <strong style={{ color: model.after.color }}>{model.after.label}</strong>
              </div>
            </div>
            {model.after.progress !== null && (
              <div
                className="ranked-rating-progress"
                data-rating-change={
                  value.ratingDelta > 0
                    ? "gain"
                    : value.ratingDelta < 0
                      ? "loss"
                      : "neutral"
                }
              >
                <progress
                  max={100}
                  value={Math.round(model.after.progress * 100)}
                  aria-label="Progress to next division"
                />
                <p>
                  {model.after.eloToPromotion} Elo to {model.nextRank}
                </p>
              </div>
            )}
            {value.finalGuessCompensated && (
              <p role="status">Verified final 50/50 — half of the nominal victory Elo awarded, subject to the rating ceiling. This match still counts as a defeat.</p>
            )}
            {model.demotionProtected && <p role="status">Demotion prevented. Your rating stopped at the division floor. Another loss at this rating will demote you.</p>}
            {model.after.progress === null && <p>Highest competitive rank</p>}
            {value.policyVersion === 1 && (
              <p>Historical Elo award (v1), displayed on the current rank scale.</p>
            )}
          </div>
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
        <Link href="/ranked/rating-guide">How Elo works</Link>
        <div>
          <Link href="/leaderboard">Leaderboard</Link>
          {(state.kind === "missing" || state.kind === "unavailable") && (
            <button type="button" onClick={() => setRevision((n) => n + 1)}>
              <RefreshCw size={13} aria-hidden="true" /> Retry
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
