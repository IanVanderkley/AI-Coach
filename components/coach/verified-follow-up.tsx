"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, MessageCircleQuestion, ShieldCheck } from "lucide-react";
import { guidedFollowUpQuestions, type FollowUpAnswer } from "@/lib/coach/verified-follow-up";
import {
  appendThreadAnswer,
  FOLLOW_UP_THREAD_LIMIT,
  latestFollowUpScrollTop,
  resolveThreadQuestion,
  restoreFollowUpThread,
  serializeFollowUpThread,
} from "@/lib/coach/follow-up-thread";
import type { EvidenceReport } from "@/lib/coach/evidence-report";
import type { PracticeSession } from "@/lib/practice/history";

// Same tab-local key as the earlier single-answer version. No provider calls.
const STORAGE_PREFIX = "mindsweeper.practice.verifiedFollowUp.v1.";

export function followUpGameKey(game: PracticeSession): string {
  // Non-security hash: a compact identifier for temporary session storage.
  const text = JSON.stringify(game);
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(16);
}

export function VerifiedFollowUp({
  report,
  game,
  persist = true,
  onReviewMove,
}: {
  report: EvidenceReport;
  game: PracticeSession;
  persist?: boolean;
  onReviewMove: (moveNumber: number) => void;
}) {
  const [momentId, setMomentId] = useState(report.moments[0]?.id ?? "");
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<FollowUpAnswer[]>([]);
  const [notice, setNotice] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const loadedKeyRef = useRef("");
  const threadRef = useRef<FollowUpAnswer[]>([]);
  const threadPanelRef = useRef<HTMLDivElement | null>(null);
  const revealLatestRef = useRef(false);
  const storageKey =
    (persist ? STORAGE_PREFIX : "ranked-memory-only.") + followUpGameKey(game);
  const ready = loadedKey === storageKey;

  useEffect(() => {
    const newGame = loadedKeyRef.current !== storageKey;
    let restored: FollowUpAnswer[] = [];
    if (newGame) {
      try {
        restored = restoreFollowUpThread(
          report,
          persist ? window.sessionStorage.getItem(storageKey) : null,
        );
      } catch {
        // The conversation still works when storage is unavailable.
      }
      setQuestion("");
      setNotice("");
      revealLatestRef.current = restored.length > 0;
    } else {
      // A recomputed report must not replace newer in-memory answers with stored data.
      // Revalidate against the current evidence while retaining any draft question.
      restored = restoreFollowUpThread(
        report,
        serializeFollowUpThread(threadRef.current),
      );
    }
    threadRef.current = restored;
    loadedKeyRef.current = storageKey;
    setThread(restored);
    setMomentId((current) =>
      !newGame && report.moments.some((moment) => moment.id === current)
        ? current
        : (restored.at(-1)?.momentId ?? report.moments[0]?.id ?? ""),
    );
    setLoadedKey(storageKey);
  }, [report, storageKey, persist]);

  useEffect(() => {
    if (!ready || !revealLatestRef.current) return;
    const panel = threadPanelRef.current;
    const latest = panel?.lastElementChild;
    if (!panel || !latest) return;
    revealLatestRef.current = false;
    const answerTop =
      panel.scrollTop +
      latest.getBoundingClientRect().top -
      panel.getBoundingClientRect().top;
    panel.scrollTop = latestFollowUpScrollTop(
      answerTop,
      panel.scrollHeight,
      panel.clientHeight,
    );
  }, [ready, thread]);

  if (report.moments.length === 0) {
    return (
      <section className="verified-follow-up" aria-label="Coaching follow-up">
        <h4>
          <MessageCircleQuestion size={19} aria-hidden="true" /> Ask about a verified move
        </h4>
        <p>
          There are no verified teaching moments in this recording. You can still inspect
          its replay.
        </p>
      </section>
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    const result = resolveThreadQuestion(report, momentId, question);
    if (!result.supported) {
      setNotice(
        result.message.replace(
          " Unsupported questions do not use your one follow-up.",
          "",
        ),
      );
      return;
    }
    const next = appendThreadAnswer(threadRef.current, result.answer);
    threadRef.current = next;
    revealLatestRef.current = true;
    setThread(next);
    setQuestion("");
    setNotice("");
    try {
      if (persist)
        window.sessionStorage.setItem(storageKey, serializeFollowUpThread(next));
    } catch {
      // Do not interrupt local coaching if tab storage is unavailable.
    }
  }

  function clearThread() {
    if (!ready) return;
    threadRef.current = [];
    revealLatestRef.current = false;
    setThread([]);
    setQuestion("");
    setNotice("");
    try {
      if (persist) window.sessionStorage.removeItem(storageKey);
    } catch {
      // The in-memory conversation has still been cleared.
    }
  }

  const selected = report.moments.find((item) => item.id === momentId);
  return (
    <section className="verified-follow-up" aria-label="Coaching conversation">
      <div className="follow-up-title-row">
        <h4>
          <MessageCircleQuestion size={19} aria-hidden="true" /> Ask your coach
        </h4>
        <span>
          <ShieldCheck size={13} aria-hidden="true" /> Verified rule answers
        </span>
      </div>
      <p>
        Ask about a verified move: why it was classified that way, what the clues prove,
        or what to do next. Choose a suggested question for a guided explanation.
        For a particular square, use the replay board. Answers are assembled
        locally from the recording, not generated by a language model.
      </p>
      {ready && thread.length > 0 && (
        <>
          <div
            ref={threadPanelRef}
            className="coach-follow-up-thread"
            role="log"
            tabIndex={0}
            aria-label="Coaching answers"
            aria-live="polite"
          >
            {thread.map((answer, index) => (
              <article
                className="follow-up-answer"
                key={`${answer.momentId}-${answer.intent}-${index}`}
              >
                <span className="subtle-label">
                  Move {answer.moveNumber} · Verified response
                </span>
                <p className="follow-up-asked">“{answer.question}”</p>
                <h5>{answer.title}</h5>
                {answer.paragraphs.map((paragraph, i) => (
                  <p key={i} className="coach-follow-up-paragraph">
                    {paragraph}
                  </p>
                ))}
                <button
                  type="button"
                  className="evidence-review-button"
                  onClick={() => onReviewMove(answer.moveNumber)}
                >
                  View move {answer.moveNumber} in replay
                </button>
              </article>
            ))}
          </div>
          <div className="coach-follow-up-thread-meta">
            <span className="follow-up-context">
              Latest {thread.length} of up to {FOLLOW_UP_THREAD_LIMIT} answers{" "}
              {persist ? "saved in this browser tab." : "in this review only."}
            </span>
            <button
              type="button"
              className="evidence-review-button"
              onClick={clearThread}
            >
              Clear conversation
            </button>
          </div>
        </>
      )}
      <form onSubmit={submit} className="follow-up-form">
        <label htmlFor="follow-up-moment">Which move?</label>
        <select
          id="follow-up-moment"
          value={momentId}
          disabled={!ready}
          onChange={(event) => {
            setMomentId(event.target.value);
            setQuestion("");
            setNotice("");
          }}
        >
          {report.moments.map((moment) => (
            <option key={moment.id} value={moment.id}>
              Move {moment.moveNumber} — {moment.category}
            </option>
          ))}
        </select>
        <label htmlFor="follow-up-question">Your question</label>
        <textarea
          id="follow-up-question"
          value={question}
          onChange={(event) => {
            setQuestion(event.target.value);
            setNotice("");
          }}
          placeholder="Why was this decision classified this way?"
          maxLength={240}
          rows={2}
          required
          disabled={!ready}
        />
        <div className="follow-up-suggestions" aria-label="Example questions">
          {guidedFollowUpQuestions(selected).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={!ready}
              onClick={() => {
                setQuestion(suggestion);
                setNotice("");
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
        {selected && (
          <p className="follow-up-context">
            Selected: move {selected.moveNumber}, {selected.location}
          </p>
        )}
        {notice && (
          <p className="follow-up-notice" role="status">
            {notice}
          </p>
        )}
        <button
          className="follow-up-submit"
          type="submit"
          disabled={!ready || !selected || question.trim().length < 5}
        >
          Ask about this move <ArrowRight size={16} aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
