import type { EvidenceReport } from "./evidence-report.ts";
import {
  answerVerifiedFollowUp,
  type FollowUpAnswer,
  type FollowUpResult,
} from "./verified-follow-up.ts";

export const FOLLOW_UP_THREAD_LIMIT = 12;

/** Reveal the latest answer; if it is tall, keep its beginning in view. */
export function latestFollowUpScrollTop(
  answerTop: number,
  scrollHeight: number,
  clientHeight: number,
): number {
  return Math.max(0, Math.min(answerTop, scrollHeight - clientHeight));
}

/** The selected recorded move is the scope; do not silently answer about another move. */
export function resolveThreadQuestion(
  report: EvidenceReport,
  momentId: string,
  question: string,
): FollowUpResult {
  const selected = report.moments.find((moment) => moment.id === momentId);
  const references = [...question.matchAll(/\bmove\s*#?\s*(\d+)\b/gi)];
  if (selected && references.some((match) => Number(match[1]) !== selected.moveNumber)) {
    return {
      supported: false,
      message:
        "Select the move you want to ask about. Questions comparing multiple moves are not supported yet.",
    };
  }
  if (
    /\b(?:probabilit\w*|odds|chance\w*|percentage chance|what if|would have|could have won)\b/i.test(
      question,
    )
  ) {
    return {
      supported: false,
      message:
        "This replay does not establish probabilities or hypothetical outcomes. Ask about the visible proof or the recommended next move.",
    };
  }
  return answerVerifiedFollowUp(report, momentId, question);
}

export function appendThreadAnswer(
  thread: readonly FollowUpAnswer[],
  answer: FollowUpAnswer,
) {
  return [...thread, answer].slice(-FOLLOW_UP_THREAD_LIMIT);
}

/** Store only the selected move and question; never trust persisted answer text. */
export function serializeFollowUpThread(thread: readonly FollowUpAnswer[]) {
  return JSON.stringify(
    thread
      .slice(-FOLLOW_UP_THREAD_LIMIT)
      .map(({ momentId, question }) => ({ momentId, question })),
  );
}

export function restoreFollowUpThread(
  report: EvidenceReport,
  raw: string | null,
): FollowUpAnswer[] {
  if (!raw || raw.length > 32_000) return [];
  try {
    const saved: unknown = JSON.parse(raw);
    // Earlier releases stored one object instead of an array.
    const entries: unknown[] = Array.isArray(saved)
      ? saved.slice(-FOLLOW_UP_THREAD_LIMIT)
      : [saved];
    const answers: FollowUpAnswer[] = [];
    for (const item of entries) {
      if (!item || typeof item !== "object") continue;
      const entry = item as { momentId?: unknown; question?: unknown };
      if (
        typeof entry.momentId !== "string" ||
        typeof entry.question !== "string" ||
        entry.question.length > 240
      )
        continue;
      const result = resolveThreadQuestion(report, entry.momentId, entry.question);
      if (result.supported) answers.push(result.answer);
    }
    return answers;
  } catch {
    return [];
  }
}
