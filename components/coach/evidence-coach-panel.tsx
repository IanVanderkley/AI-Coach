"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BrainCircuit,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Target,
  TriangleAlert,
} from "lucide-react";

import {
  buildTeachingReview,
  displayMoveNumber,
  openingIndex,
} from "@/lib/coach/teaching-review";
import { TeachingProof } from "@/components/coach/teaching-proof";
import { VerifiedFollowUp, followUpGameKey } from "@/components/coach/verified-follow-up";
import type { PracticeSession } from "@/lib/practice/history";
import type { CoachPreferences } from "@/lib/settings/types";
import {
  coachingLead,
  practicePrompt,
  prioritizeMoments,
} from "@/lib/coach/visual-coaching";
import Link from "next/link";

type FocusResponse = {
  focusId: string | null;
  style: "direct" | "step-by-step";
  selectedBy: string;
  model: string | null;
  note: string;
};

export function EvidenceCoachPanel({
  game,
  onReviewMove,
  preferences,
  aiAvailable = false,
}: {
  game: PracticeSession;
  onReviewMove: (moveNumber: number) => void;
  preferences?: CoachPreferences | null;
  aiAvailable?: boolean;
}) {
  const prepared = useMemo(() => {
    try {
      return { review: buildTeachingReview(game), error: null };
    } catch (error) {
      return {
        review: null,
        error: error instanceof Error ? error.message : "Unable to verify this game.",
      };
    }
  }, [game]);
  const [focus, setFocus] = useState<FocusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null);

  useEffect(() => {
    pending.current?.abort();
    setFocus(null);
    setLoading(false);
    setError("");
    return () => pending.current?.abort();
  }, [game]);

  const report = prepared.review?.report;
  const explanations = prepared.review?.explanations;
  const displayedNumber = (raw: number) => displayMoveNumber(game.moves, raw);
  if (!report) {
    return (
      <section className="evidence-report" aria-label="Verified coaching">
        <h3>Evidence-based coaching</h3>
        <p role="alert">{prepared.error}</p>
      </section>
    );
  }

  async function requestAIFocus() {
    if (!report || !aiAvailable || loading || report.moments.length === 0) return;
    const controller = new AbortController();
    pending.current?.abort();
    pending.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/coach/verified", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(game),
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => null)) as
        | (FocusResponse & { error?: string })
        | null;
      if (!response.ok) throw new Error(body?.error ?? "Unable to request AI focus.");
      if (
        !body ||
        (body.focusId !== null &&
          !report.moments.some((item) => item.id === body.focusId))
      ) {
        throw new Error("The AI suggestion was not based on a verified moment.");
      }
      if (!controller.signal.aborted) {
        setFocus(body);
        const chosen = report.moments.find((moment) => moment.id === body.focusId);
        if (chosen) onReviewMove(chosen.moveNumber);
      }
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : "AI focus was unavailable.");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  const ordered = prioritizeMoments(report, preferences);
  const focused =
    report.moments.find((moment) => moment.id === focus?.focusId) ?? ordered[0];
  const detail = preferences?.explanationDetail ?? "standard";
  const isAI = focus && focus.selectedBy !== "rules";

  return (
    <section className="evidence-report" aria-label="Evidence-based coaching report">
      <div className="evidence-heading">
        <div>
          <span className="subtle-label">VERIFIED POST-GAME REPORT · PRACTICE</span>
          <h3>
            <BrainCircuit size={22} aria-hidden="true" /> Your next Practice lesson
          </h3>
        </div>
        <span className="evidence-lock">
          <ShieldCheck size={14} aria-hidden="true" /> Rule-verified
        </span>
      </div>

      <div className="coach-next-focus">
        <span className="subtle-label">{coachingLead(focused, preferences)}</span>
        {focused && (
          <>
            <h4>{focused.category}</h4>
            <p>{explanations?.get(focused.id)?.nextStep || focused.nextTime}</p>
            <button
              type="button"
              className="evidence-review-button"
              onClick={() => onReviewMove(focused.moveNumber)}
            >
              Review move {displayedNumber(focused.moveNumber)}
            </button>
          </>
        )}
        <p>{practicePrompt(preferences)}</p>
        <div className="coach-preference-summary">
          {preferences ? (
            <>
              Using {preferences.coachingStyle} tone · {detail} detail ·{" "}
              {preferences.experienceLevel} experience
              {preferences.selectedGoals.length
                ? ` · Goals: ${preferences.selectedGoals.join(", ")}`
                : ""}
              .
            </>
          ) : (
            "Using default coaching preferences."
          )}{" "}
          <Link href="/settings">Edit coaching preferences</Link>
        </div>
        {preferences?.customGoal && (
          <p className="coach-preference-summary">
            Your personal goal: {preferences.customGoal}
          </p>
        )}
      </div>
      <details className="evidence-focus-tools">
        <summary>Decision totals</summary>
        <div className="evidence-counts">
          <span>
            <strong>{report.recordedActions}</strong> review moves (opening excluded)
          </span>
          <span>
            <strong>{report.verifiedMistakes}</strong> verified mistakes
          </span>
          <span>
            <strong>{report.provenGood}</strong> proven good moves
          </span>
          <span>
            <strong>{report.uncertainActions}</strong> insufficient evidence
          </span>
        </div>
      </details>
      <details className="evidence-focus-tools">
        <summary>Optional AI focus</summary>
        <div className="evidence-focus-row">
          <div>
            <strong>Choose your next focus</strong>
            <p>
              The rule engine selects a starting point. AI can optionally prioritize one
              of these same verified moments; it cannot invent findings.
            </p>
          </div>
          <button
            type="button"
            className="evidence-ai-button"
            disabled={!aiAvailable || loading || report.moments.length === 0}
            onClick={() => void requestAIFocus()}
          >
            {loading ? (
              <Loader2 size={16} className="coach-spin" aria-hidden="true" />
            ) : (
              <Target size={16} aria-hidden="true" />
            )}
            {loading
              ? "Checking focus…"
              : aiAvailable
                ? "Ask AI to choose a focus"
                : "AI provider disabled or unavailable"}
          </button>
        </div>
        {focus && (
          <p className="evidence-ai-note" aria-live="polite">
            {isAI
              ? `AI-selected focus (${focus.selectedBy}${focus.model ? ` · ${focus.model}` : ""})`
              : "Rule-selected focus"}
            . {focus.note}
          </p>
        )}
        {error && (
          <p className="evidence-error" role="alert">
            <TriangleAlert size={14} aria-hidden="true" /> {error} The verified report is
            still available.
          </p>
        )}

        {!aiAvailable && (
          <p className="evidence-caveat">
            Local evidence-based coaching is fully available without an AI provider.
          </p>
        )}
      </details>
      {report.moments.length > 0 ? (
        <div className="evidence-moment-list">
          {ordered.map((moment) => (
            <article
              key={moment.id}
              className={
                focused?.id === moment.id ? "evidence-moment is-focus" : "evidence-moment"
              }
            >
              <div className="evidence-moment-title">
                <span
                  className={
                    moment.kind === "mistake"
                      ? "evidence-kind mistake"
                      : "evidence-kind good"
                  }
                >
                  {moment.kind === "mistake" ? (
                    <TriangleAlert size={14} aria-hidden="true" />
                  ) : (
                    <CheckCircle2 size={14} aria-hidden="true" />
                  )}
                  {moment.kind === "mistake" ? "Verified mistake" : "Proven good move"}
                </span>
                <span>
                  Move {displayedNumber(moment.moveNumber)} · {moment.location}
                  {moment.occurrences > 1
                    ? ` · repeated ${moment.occurrences} times`
                    : ""}
                </span>
              </div>
              <h4>{moment.category}</h4>
              {detail === "brief" ? null : (
                <p>
                  <strong>What happened:</strong>{" "}
                  {explanations?.get(moment.id)?.summary || moment.finding}
                </p>
              )}
              <TeachingProof
                explanation={explanations?.get(moment.id)}
                fallback={moment.evidence}
                expanded={detail !== "brief"}
                technical={detail === "detailed"}
              />
              <p>
                <strong>Use this in your next game:</strong>{" "}
                {explanations?.get(moment.id)?.nextStep || moment.nextTime}
              </p>
              <button
                type="button"
                className="evidence-review-button"
                onClick={() => onReviewMove(moment.moveNumber)}
              >
                View board at move {displayedNumber(moment.moveNumber)}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="evidence-empty">
          This game had no provable coaching moments under the current analysis rules. We
          will not invent five points just to fill the report.
        </p>
      )}
      <details className="evidence-focus-tools">
        <summary>Ask a follow-up question</summary>
        <VerifiedFollowUp
          key={followUpGameKey(game)}
          report={prepared.review!.followUpReport}
          game={game}
          onReviewMove={(displayed) =>
            onReviewMove(displayed + openingIndex(game.moves) + 1)
          }
        />
      </details>
      <p className="evidence-caveat">
        {report.caveat} AI prioritization is optional and only sends verified finding
        summaries to the provider, not the hidden mine layout.
      </p>
    </section>
  );
}
