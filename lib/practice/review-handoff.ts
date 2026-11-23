import { replayRecordedGame } from "../coach/verified-replay.ts";
import type { PracticeSession } from "./history";

// Same-tab handoff for a just-completed Practice game. Not a public replay link.
export const PRACTICE_REVIEW_HANDOFF_KEY = "ai-coach:practice-review-handoff:v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
type HandoffStorage = Pick<Storage, "getItem" | "setItem">;

export function savePracticeReviewHandoff(
  storage: HandoffStorage | null,
  session: PracticeSession,
  now = Date.now(),
): string | null {
  if (!storage || !Number.isSafeInteger(now)) return null;
  try {
    const id = crypto.randomUUID();
    storage.setItem(
      PRACTICE_REVIEW_HANDOFF_KEY,
      JSON.stringify({ id, createdAt: now, session }),
    );
    return id;
  } catch {
    return null;
  }
}

export function loadPracticeReviewHandoff(
  storage: HandoffStorage | null,
  id: string,
  now = Date.now(),
): PracticeSession | null {
  if (!storage || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const raw = storage.getItem(PRACTICE_REVIEW_HANDOFF_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const record = data as Record<string, unknown>;
    if (
      record.id !== id ||
      typeof record.createdAt !== "number" ||
      !Number.isSafeInteger(record.createdAt) ||
      !Number.isSafeInteger(now) ||
      now < record.createdAt ||
      now - record.createdAt > MAX_AGE_MS
    )
      return null;
    const session = record.session as PracticeSession;
    if (
      !session ||
      session.game !== "minesweeper" ||
      !["win", "loss"].includes(session.outcome) ||
      !Array.isArray(session.moves) ||
      session.moves.length === 0 ||
      session.moves.length > 5000 ||
      session.moves.some((move) => !/^[0-9a-f]{8}$/.test(move?.afterHash ?? ""))
    )
      return null;
    // Session storage is untrusted. Verify every recorded move and board checkpoint.
    const replay = replayRecordedGame(session);
    if (replay.status !== (session.outcome === "win" ? "won" : "lost")) return null;
    return session;
  } catch {
    return null;
  }
}
