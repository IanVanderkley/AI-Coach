import { isRankedRecordingId } from "../ranked/coaching-recording.ts";
import type { ReviewMode } from "./personalized-review.ts";

/** Accept an identifier only. Never accept a report, owner, score or hidden layout. */
export function parseReviewSave(
  value: unknown,
): { mode: ReviewMode; gameRef: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (
    Object.keys(body).length !== 2 ||
    (body.mode !== "practice" && body.mode !== "ranked")
  )
    return null;
  if (typeof body.gameRef !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(body.gameRef))
    return null;
  if (body.mode === "ranked" && !isRankedRecordingId(body.gameRef)) return null;
  return { mode: body.mode, gameRef: body.gameRef };
}
