/** Compact, versioned coaching projection, not a competitive rating or reward.
 * Bump when the shared coaching analysis/scoring changes. No board data here.
 */
export const RANKED_HISTORY_GRADE_VERSION = 1;
export type RankedHistoryGrade = {
  matchId: string;
  version: typeof RANKED_HISTORY_GRADE_VERSION;
  grade: "S" | "A" | "B" | "C" | "D" | null;
  score: number | null;
};

export function parseRankedHistoryGrade(
  raw: unknown,
  matchId: string,
): RankedHistoryGrade {
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(matchId)
  ) {
    throw new Error("Invalid Ranked history grade.");
  }
  const r = raw as Record<string, unknown>;
  if (r.matchId !== matchId || r.version !== RANKED_HISTORY_GRADE_VERSION) {
    throw new Error("Invalid Ranked history grade identity or version.");
  }
  const score = r.score;
  if (
    score !== null &&
    (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > 100)
  ) {
    throw new Error("Invalid Ranked history score.");
  }
  const grade =
    score === null
      ? null
      : score >= 90
        ? "S"
        : score >= 78
          ? "A"
          : score >= 65
            ? "B"
            : score >= 50
              ? "C"
              : "D";
  if (r.grade !== grade) throw new Error("Inconsistent Ranked history grade.");
  return { matchId, version: RANKED_HISTORY_GRADE_VERSION, grade, score };
}
