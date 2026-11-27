import { createClient } from "@/lib/supabase/sever";
import { createAdminClient } from "@/lib/supabase/admin";
import { readVerifiedRankedSessionId } from "@/lib/ranked/session-claims";
import { guardRankedRateLimit } from "@/lib/ranked/api-rate-limit";
import { isAllowedRankedOrigin } from "@/lib/ranked/http-security";
import { isRankedRecordingId } from "@/lib/ranked/coaching-recording";
import { RANKED_HISTORY_LIMIT } from "@/lib/ranked/history";
import { serializeRankedCoachingHistory } from "@/lib/ranked/coaching-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) =>
  Response.json({ error }, { status, headers });

/** Metadata only. No layout or move reads; no grading; no provider calls. */
export async function GET(request: Request) {
  if (!isAllowedRankedOrigin(request)) return fail("Invalid request origin.", 403);
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    const userId = data?.claims?.sub;
    const sessionId = readVerifiedRankedSessionId(data?.claims);
    if (error || !sessionId || !isRankedRecordingId(userId))
      return fail("Sign in to review Ranked matches.", 401);
    const admin = createAdminClient();
    const { data: active, error: sessionError } = await admin.rpc(
      "ranked_session_is_active",
      { p_user_id: userId, p_session_id: sessionId },
    );
    if (sessionError) throw new Error("Ranked session check unavailable.");
    if (active !== true) return fail("Sign in to review Ranked matches.", 401);
    const limited = await guardRankedRateLimit(admin, userId, "read");
    if (limited) return limited;
    const { data: matches, error: matchError } = await admin
      .from("ranked_matches")
      .select(
        "id,user_id,status,rows,columns,mine_count,move_count,duration_ms,finished_at",
      )
      .eq("user_id", userId)
      .in("status", ["won", "lost"])
      .order("finished_at", { ascending: false })
      .limit(RANKED_HISTORY_LIMIT);
    if (matchError) throw new Error("Ranked history unavailable.");
    if (!matches?.length) return Response.json({ matches: [] }, { headers });
    const { data: verified, error: verifiedError } = await admin
      .from("ranked_verified_results")
      .select("match_id,user_id")
      .eq("user_id", userId)
      .in(
        "match_id",
        matches.map((match) => match.id),
      );
    if (verifiedError) throw new Error("Ranked verification unavailable.");
    return Response.json(
      { matches: serializeRankedCoachingHistory(matches, verified, userId) },
      { headers },
    );
  } catch {
    console.error("Ranked coaching history lookup failed.");
    return fail("Ranked coaching history is temporarily unavailable.", 503);
  }
}
