"use client";

import { RankedEloReveal } from "@/components/ranked/ranked-elo-reveal";
import { BarChart3, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  formatRatingDelta,
  parseRankedMatchRating,
  type RankedMatchRating,
} from "@/lib/leaderboard/match-rating";
import { RankEmblem } from "@/components/ranked/rank-emblem";
import { FeedbackNotice } from "@/components/ui/feedback-notice";
import {
  rankResultModel,
  rankTransitionSteps,
  RANK_PROMOTION_STEP_MS,
  RANK_DEMOTION_STEP_MS,
} from "@/lib/leaderboard/rank-result";

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
  const receiptKey = value
    ? `${matchId}:${value.ratingBefore}:${value.ratingAfter}:${revision}`
    : "";
  const [settledReceipt, setSettledReceipt] = useState<string | null>(null);
  const onEloSettled = useCallback(() => setSettledReceipt(receiptKey), [receiptKey]);

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
          <div className="ranked-rating-summary">
            <RankedEloReveal
              key={`${matchId}:${value.ratingBefore}:${value.ratingAfter}:${revision}`}
              before={value.ratingBefore}
              after={value.ratingAfter}
              deltaLabel={formatRatingDelta(value.ratingDelta, value.policyVersion)}
              onSettled={onEloSettled}
            />
          </div>
          {value.finalGuessCompensated && (
            <FeedbackNotice
              tone="reward"
              title="Verified final 50/50"
              description="Half victory Elo, rounded up."
              metric={{
                value: formatRatingDelta(value.ratingDelta, value.policyVersion),
                label: "Elo awarded",
              }}
              detail={
                value.ratingAfter === 10000
                  ? "Awards cannot raise rating above 10,000 Elo. This match still counts as a defeat."
                  : "This match still counts as a defeat."
              }
            />
          )}
          {model.demotionProtected && (
            <FeedbackNotice
              tone="protection"
              title="Demotion prevented"
              description="Another ordinary loss at this floor will demote you."
              metric={{
                value: value.ratingAfter.toLocaleString(),
                label: `${model.after.label} floor`,
              }}
            />
          )}
          <RankChangeCeremony
            key={receiptKey}
            value={value}
            model={model}
            eloSettled={settledReceipt === receiptKey}
          />
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
      <div
        className="ranked-rating-footer"
        hidden={state.kind === "ready" || state.kind === "loading"}
      >
        {(state.kind === "missing" || state.kind === "unavailable") && (
          <button type="button" onClick={() => setRevision((n) => n + 1)}>
            <RefreshCw size={13} aria-hidden="true" /> Retry
          </button>
        )}
      </div>
    </section>
  );
}

/** The receipt owns final values. A remount for each step restarts the distinct CSS ceremony. */
function RankChangeCeremony({
  value,
  model,
  eloSettled,
}: {
  value: RankedMatchRating;
  model: ReturnType<typeof rankResultModel>;
  eloSettled: boolean;
}) {
  const steps = useMemo(() => rankTransitionSteps(value), [value]);
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (phase >= steps.length) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => setPhase(steps.length);
    const onMotionChange = () => {
      if (motion.matches) finish();
    };
    motion.addEventListener("change", onMotionChange);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (motion.matches) finish();
    else if (eloSettled) {
      const duration =
        model.transition === "promotion" ? RANK_PROMOTION_STEP_MS : RANK_DEMOTION_STEP_MS;
      timer = setTimeout(
        () => setPhase((previous) => Math.min(previous + 1, steps.length)),
        duration,
      );
    }
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      motion.removeEventListener("change", onMotionChange);
    };
  }, [eloSettled, model.transition, phase, steps.length]);
  const step = steps[phase];
  const version = value.policyVersion === 4 ? 4 : 3;
  if (step) {
    if (!eloSettled)
      return (
        <div className="ranked-rating-transition" data-rank-phase="waiting">
          <p className="ranked-rating-transition-title">Applying verified Elo</p>
          <div className="ranked-rating-rank">
            <RankEmblem
              rating={value.ratingBefore}
              size={104}
              decorative
              policyVersion={version}
            />
            <strong style={{ color: model.before.color }}>{model.before.label}</strong>
          </div>
          <p>Rank change follows the Elo count.</p>
        </div>
      );
    return (
      <div
        className="ranked-rating-transition"
        data-transition={step.direction}
        data-rank-phase="step"
        key={phase}
      >
        <p className="ranked-rating-transition-title">
          {step.direction === "promotion" ? "Promotion!" : "Demotion"}
          {steps.length > 1 ? ` · ${phase + 1} of ${steps.length}` : ""}
        </p>
        <div className="ranked-rating-emblems">
          <div className="ranked-rating-rank">
            <RankEmblem
              rating={step.fromRating}
              size={112}
              decorative
              policyVersion={version}
            />
            <span style={{ color: step.from.color }}>{step.from.label}</span>
          </div>
          <span className="ranked-rating-arrow" aria-hidden="true">
            {step.direction === "promotion" ? "↑" : "↓"}
          </span>
          <div className="ranked-rating-rank ranked-rating-current">
            <RankEmblem
              rating={step.toRating}
              size={144}
              decorative
              policyVersion={version}
            />
            <strong style={{ color: step.to.color }}>{step.to.label}</strong>
          </div>
        </div>
        <p>
          {phase + 1 < steps.length
            ? "Another division to reveal…"
            : "Final rank revealed"}
        </p>
      </div>
    );
  }
  return (
    <div
      className="ranked-rating-transition"
      data-transition={model.transition}
      data-rank-phase="settled"
    >
      <p className="ranked-rating-transition-title" role="status">
        {model.transition === "promotion"
          ? steps.length > 1
            ? `Promoted ${steps.length} divisions!`
            : "Promoted!"
          : model.transition === "demotion"
            ? steps.length > 1
              ? `Demoted ${steps.length} divisions`
              : "Demoted"
            : "Current rank"}
      </p>
      <div className="ranked-rating-emblems">
        {model.transition !== "unchanged" && (
          <>
            <div className="ranked-rating-rank">
              <RankEmblem
                rating={value.ratingBefore}
                size={112}
                decorative
                policyVersion={value.policyVersion === 4 ? 4 : 3}
              />
              <span style={{ color: model.before.color }}>{model.before.label}</span>
            </div>
            <span className="ranked-rating-arrow" aria-hidden="true">
              →
            </span>
          </>
        )}
        <div className="ranked-rating-rank ranked-rating-current">
          <RankEmblem
            rating={value.ratingAfter}
            size={144}
            decorative
            policyVersion={value.policyVersion === 4 ? 4 : 3}
          />
          <strong style={{ color: model.after.color }}>{model.after.label}</strong>
        </div>
      </div>
      {model.after.progress !== null && (
        <div
          className="ranked-rating-progress"
          data-rating-change={
            value.ratingDelta > 0 ? "gain" : value.ratingDelta < 0 ? "loss" : "neutral"
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
      {model.after.progress === null && <p>Highest competitive rank</p>}
      {value.policyVersion === 1 && (
        <p>Historical Elo award (v1), displayed on the current rank scale.</p>
      )}
    </div>
  );
}
