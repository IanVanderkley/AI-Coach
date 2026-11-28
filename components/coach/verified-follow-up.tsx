"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, MessageCircleQuestion, ShieldCheck } from "lucide-react";
import { contextualFollowUpQuestions, GAME_FOLLOW_UP_ID, GAME_FOLLOW_UP_QUESTIONS, guidedFollowUpQuestions, plainFollowUpCoordinates, type FollowUpAnswer } from "@/lib/coach/verified-follow-up";
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
  const [momentId, setMomentId] = useState(report.moments[0]?.id ?? GAME_FOLLOW_UP_ID);
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
      !newGame && (current === GAME_FOLLOW_UP_ID || report.moments.some((moment) => moment.id === current))
        ? current
        : (restored.at(-1)?.momentId ?? report.moments[0]?.id ?? GAME_FOLLOW_UP_ID),
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
  const gameScope = momentId === GAME_FOLLOW_UP_ID;
  const latest = thread.at(-1);
  function chooseQuestion(scope: string, suggestion: string) {
    setMomentId(scope);
    setQuestion(suggestion);
    setNotice("");
  }
  function suggestionButton(suggestion: string) {
    return <button key={suggestion} type="button" disabled={!ready} onClick={() => chooseQuestion(momentId, suggestion)}>{suggestion}</button>;
  }
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
        Ask about the whole game or a verified move: why it was classified that way, what the clues prove,
        or what to do next. Choose a suggested question for a guided explanation.
        For a particular square, use the replay board. Answers are assembled
        locally from the recording, not generated by a language model.
      </p>
      {report.moments.length === 0 && <p>There are no verified teaching moments in this recording. You can still ask for a game summary or inspect its replay.</p>}
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
                  {answer.scope === "game" ? "Whole game" : `Move ${answer.moveNumber}`} · Verified response
                </span>
                <p className="follow-up-asked">“{answer.question}”</p>
                <h5>{answer.title}</h5>
                {answer.paragraphs.map((paragraph, i) => (
                  <p key={i} className="coach-follow-up-paragraph">
                    {paragraph}
                  </p>
                ))}
                {answer.moveNumber >= 0 && <button
                  type="button"
                  className="evidence-review-button"
                  onClick={() => onReviewMove(answer.moveNumber)}
                >
                  View move {answer.moveNumber} in replay
                </button>}
              </article>
            ))}
          </div>
          {latest && <div className="follow-up-suggestions" aria-label="Follow-up questions for the latest answer">
            {contextualFollowUpQuestions(latest).map(suggestion => <button key={suggestion} type="button" disabled={!ready} onClick={() => chooseQuestion(latest.momentId, suggestion)}>{suggestion}</button>)}
          </div>}
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
        <label htmlFor="follow-up-moment">What would you like to review?</label>
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
          <option value={GAME_FOLLOW_UP_ID}>Whole game</option>
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
          placeholder={gameScope ? "How did I do in this game?" : "Why was this decision classified this way?"}
          maxLength={240}
          rows={2}
          required
          disabled={!ready}
        />
        <div className="follow-up-suggestions" aria-label="Example questions">
          {gameScope ? GAME_FOLLOW_UP_QUESTIONS.map(suggestionButton) : guidedFollowUpQuestions(selected).map(suggestionButton)}
        </div>
        {selected && (
          <div className="coach-follow-up-thread-meta">
            <p className="follow-up-context">
              Selected: move {selected.moveNumber}, {plainFollowUpCoordinates(selected.location)}
            </p>
            <button type="button" className="evidence-review-button" onClick={() => onReviewMove(selected.moveNumber)}>
              Inspect move {selected.moveNumber} in replay
            </button>
          </div>
        )}
        {notice && (
          <p className="follow-up-notice" role="status">
            {notice}
          </p>
        )}
        <button
          className="follow-up-submit"
          type="submit"
          disabled={!ready || (!selected && !gameScope) || question.trim().length < 5}
        >
          {gameScope ? "Ask about this game" : "Ask about this move"} <ArrowRight size={16} aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
