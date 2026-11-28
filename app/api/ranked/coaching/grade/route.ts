import { createClient } from "@/lib/supabase/sever";
import { createAdminClient } from "@/lib/supabase/admin";
import { readVerifiedRankedSessionId } from "@/lib/ranked/session-claims";
import { guardRankedRateLimit } from "@/lib/ranked/api-rate-limit";
import { isAllowedRankedOrigin } from "@/lib/ranked/http-security";
import {
  isRankedRecordingId,
  readCompletedRankedRecording,
} from "@/lib/ranked/coaching-recording";
import { createRankedRecordingStore } from "@/lib/ranked/coaching-store";
import { replayRecordedGame } from "@/lib/coach/verified-replay";
import { summarizeVerifiedRankedReview } from "@/lib/ranked/coaching-analysis";
import {
  parseRankedHistoryGrade,
  RANKED_HISTORY_GRADE_VERSION,
} from "@/lib/ranked/history-grade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) =>
  Response.json({ error }, { status, headers });

/** One owner-scoped completed match per request. Cache only the compact learning
 * grade, never a board, move sequence or personalized saved coaching report.
 */
export async function GET(request: Request) {
  if (!isAllowedRankedOrigin(request)) return fail("Invalid request origin.", 403);
  const params = new URL(request.url).searchParams;
  const ids = params.getAll("matchId");
  const matchId = ids[0]?.toLowerCase();
  if (
    ids.length !== 1 ||
    [...params.keys()].some((key) => key !== "matchId") ||
    !isRankedRecordingId(matchId)
  ) {
    return fail("Invalid match ID.", 400);
  }
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    const userId = data?.claims?.sub;
    const sessionId = readVerifiedRankedSessionId(data?.claims);
    if (error || !sessionId || !isRankedRecordingId(userId))
      return fail("Sign in to view Ranked grades.", 401);
    const admin = createAdminClient();
    const { data: active, error: sessionError } = await admin.rpc(
      "ranked_session_is_active",
      {
        p_user_id: userId,
        p_session_id: sessionId,
      },
    );
    if (sessionError) throw new Error("Ranked session check unavailable.");
    if (active !== true) return fail("Sign in to view Ranked grades.", 401);
    const limited = await guardRankedRateLimit(admin, userId, "read");
    if (limited) return limited;

    const { data: saved, error: cacheError } = await admin
      .from("ranked_history_grades")
      .select("match_id,user_id,analysis_version,grade,score")
      .eq("user_id", userId)
      .eq("match_id", matchId)
      .eq("analysis_version", RANKED_HISTORY_GRADE_VERSION)
      .maybeSingle();
    if (cacheError) throw new Error("Ranked grade cache unavailable.");
    if (saved) {
      if (saved.user_id !== userId) throw new Error("Invalid grade owner.");
      const grade = parseRankedHistoryGrade(
        {
          matchId: saved.match_id,
          version: saved.analysis_version,
          grade: saved.grade,
          score: saved.score,
        },
        matchId,
      );
      return Response.json(grade, { headers });
    }

    // Cache hits do not consume the separate expensive-computation allowance.
    const { data: reserved, error: reservationError } = await admin.rpc(
      "reserve_ranked_history_grade",
      { p_user_id: userId },
    );
    if (reservationError || (reserved !== true && reserved !== false))
      throw new Error("Ranked grade admission unavailable.");
    if (!reserved)
      return Response.json(
        { error: "Ranked grade limit reached. Refresh shortly." },
        {
          status: 429,
          headers: { ...headers, "Retry-After": "60" },
        },
      );
    const result = await readCompletedRankedRecording(
      createRankedRecordingStore(admin),
      matchId,
      userId,
      replayRecordedGame,
    );
    if (!result.ok)
      return fail(
        result.status === 404
          ? "Completed Ranked match not found."
          : "Verified recording unavailable.",
        result.status,
      );
    const review = summarizeVerifiedRankedReview(result);
    const grade = parseRankedHistoryGrade(
      {
        matchId,
        version: review.version,
        grade: review.score.grade,
        score: review.score.score,
      },
      matchId,
    );
    const { error: writeError } = await admin.from("ranked_history_grades").insert({
      match_id: matchId,
      user_id: userId,
      analysis_version: grade.version,
      grade: grade.grade,
      score: grade.score,
    });
    // Identical concurrent computations can race on the immutable cache key.
    // A failed write other than duplicate is not a valid persistent grade.
    if (writeError && writeError.code !== "23505")
      throw new Error("Ranked grade cache write failed.");
    return Response.json(grade, { headers });
  } catch {
    console.error("Ranked history grade lookup failed.");
    return fail("Ranked grade temporarily unavailable.", 503);
  }
}
