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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

function failure(error: string, status: number) {
  return Response.json({ error }, { status, headers });
}

/** Only a completed match owned by the verified account can return a recording.
 * This endpoint never accepts client board data or exposes active match state.
 */
export async function GET(request: Request) {
  if (!isAllowedRankedOrigin(request)) return failure("Invalid request origin.", 403);
  const ids = new URL(request.url).searchParams.getAll("matchId");
  const matchId = ids[0]?.toLowerCase();
  if (ids.length !== 1 || !isRankedRecordingId(matchId)) {
    return failure("Invalid match ID.", 400);
  }
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    const sessionId = readVerifiedRankedSessionId(data?.claims);
    const userId = data?.claims?.sub;
    if (error || !sessionId || !isRankedRecordingId(userId)) {
      return failure("Sign in to review Ranked matches.", 401);
    }
    const admin = createAdminClient();
    const { data: active, error: sessionError } = await admin.rpc(
      "ranked_session_is_active",
      { p_user_id: userId, p_session_id: sessionId },
    );
    if (sessionError) throw new Error("Ranked session check unavailable.");
    if (active !== true) return failure("Sign in to review Ranked matches.", 401);
    const limited = await guardRankedRateLimit(admin, userId, "read");
    if (limited) return limited;

    const result = await readCompletedRankedRecording(
      createRankedRecordingStore(admin),
      matchId,
      userId,
      replayRecordedGame,
    );
    if (!result.ok) {
      return result.status === 404
        ? failure("Completed Ranked match not found.", 404)
        : failure("A complete verified recording is unavailable for this match.", 422);
    }
    const review = summarizeVerifiedRankedReview(result);
    return Response.json({ ...result.data, review }, { status: 200, headers });
  } catch {
    console.error("Ranked coaching recording lookup failed.");
    return failure("Ranked coaching is temporarily unavailable.", 503);
  }
}
