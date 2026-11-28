import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/sever";
import { createAdminClient } from "@/lib/supabase/admin";
import { readVerifiedRankedSessionId } from "@/lib/ranked/session-claims";
import {
  isRankedRecordingId,
  readCompletedRankedRecording,
} from "@/lib/ranked/coaching-recording";
import { createRankedRecordingStore } from "@/lib/ranked/coaching-store";
import { replayRecordedGame } from "@/lib/coach/verified-replay";
import { guardRankedRateLimit } from "@/lib/ranked/api-rate-limit";
import { isAllowedRequestOrigin, readBoundedJson } from "@/lib/http/request-security";
import {
  PRACTICE_ANALYSIS_VERSION,
  projectCompletedAnalysis,
} from "@/lib/coach/practice-analysis";
import { readPracticeReview } from "@/lib/coach/practice-review-store";
import { buildSavedReview, type SavedReview } from "@/lib/coach/personalized-review";
import { collectSkillEvidence } from "@/lib/coach/skill-evidence";
import { parseReviewSave } from "@/lib/coach/review-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
function fail(error: string, status: number) {
  return Response.json({ error }, { status, headers });
}

async function authorize() {
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  const sessionId = readVerifiedRankedSessionId(data?.claims);
  const userId = data?.claims?.sub;
  if (error || !sessionId || !isRankedRecordingId(userId)) return null;
  const admin = createAdminClient();
  const { data: active, error: sessionError } = await admin.rpc(
    "ranked_session_is_active",
    { p_user_id: userId, p_session_id: sessionId },
  );
  if (sessionError) throw new Error("Session check unavailable.");
  if (active !== true) return null;
  return { admin, userId };
}

/** Read bounded current-version snapshots; no replay or provider call on history load. */
export async function GET(request: Request) {
  if (!isAllowedRequestOrigin(request)) return fail("Invalid request origin.", 403);
  try {
    const auth = await authorize();
    if (!auth) return fail("Sign in to use saved coaching reports.", 401);
    const { admin, userId } = auth;
    const limited = await guardRankedRateLimit(admin, userId, "read");
    if (limited) return limited;
    const params = new URL(request.url).searchParams;
    if (params.size > 0) {
      if (
        params.size !== 2 ||
        params.getAll("mode").length !== 1 ||
        params.getAll("gameRef").length !== 1
      )
        return fail("Invalid report selection.", 400);
      const input = parseReviewSave({
        mode: params.get("mode"),
        gameRef: params.get("gameRef"),
      });
      if (!input) return fail("Invalid report selection.", 400);
      const { data, error } = await admin
        .from("coaching_reviews")
        .select("id")
        .eq("user_id", userId)
        .eq("mode", input.mode)
        .eq("game_ref", input.gameRef)
        .eq("analysis_version", PRACTICE_ANALYSIS_VERSION)
        .maybeSingle();
      if (error) throw new Error("Report status lookup failed.");
      return Response.json({ saved: data !== null }, { headers });
    }
    const reports: SavedReview[] = [];
    for (const mode of ["practice", "ranked"] as const) {
      const { data, error } = await admin
        .from("coaching_reviews")
        .select("game_ref,difficulty,outcome,completed_at,analysis_version,review")
        .eq("user_id", userId)
        .eq("mode", mode)
        .eq("analysis_version", PRACTICE_ANALYSIS_VERSION)
        .order("completed_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(100);
      if (error) throw new Error("Saved review lookup failed.");
      for (const row of data ?? []) {
        reports.push({
          mode,
          gameRef: row.game_ref,
          difficulty: row.difficulty,
          outcome: row.outcome,
          completedAt: row.completed_at,
          version: row.analysis_version,
          review: row.review,
        });
      }
    }
    return Response.json({ reports }, { headers });
  } catch {
    console.error("Saved coaching reports lookup failed.");
    return fail("Saved coaching reports are temporarily unavailable.", 503);
  }
}

/** Explicit owner-authorized save. Client supplies only mode and game identifier. */
export async function POST(request: Request) {
  const parsed = await readBoundedJson(request, 1024, true);
  if (!parsed.ok) return parsed.response;
  const input = parseReviewSave(parsed.value);
  if (!input) return fail("Invalid report selection.", 400);
  try {
    const auth = await authorize();
    if (!auth) return fail("Sign in to save coaching reports.", 401);
    const { admin, userId } = auth;
    const { data: admitted, error: quotaError } = await admin.rpc(
      "reserve_coaching_review_save",
      { p_user_id: userId },
    );
    if (quotaError || typeof admitted !== "boolean")
      return fail("Report saving is temporarily unavailable.", 503);
    if (!admitted)
      return Response.json(
        { error: "Too many report saves. Please try again shortly." },
        { status: 429, headers: { ...headers, "Retry-After": "60" } },
      );
    let analysis;
    let completedAt: string;
    let practiceGameId: string | null = null;
    let rankedMatchId: string | null = null;
    if (input.mode === "ranked") {
      const result = await readCompletedRankedRecording(
        createRankedRecordingStore(admin),
        input.gameRef,
        userId,
        replayRecordedGame,
      );
      if (!result.ok)
        return fail("A completed reviewable recording is unavailable.", result.status);
      analysis = projectCompletedAnalysis(result.data.recording, result.replay);
      completedAt = result.data.completedAt;
      rankedMatchId = result.data.matchId;
    } else {
      const result = await readPracticeReview(admin, userId, input.gameRef);
      if (!result.ok)
        return fail(
          "A completed account recording is unavailable. Save your Practice game first; report saving supports up to 1,000 moves.",
          result.status,
        );
      analysis = result.analysis;
      completedAt = result.completedAt;
      practiceGameId = result.gameId;
    }
    const review = { ...buildSavedReview(analysis), skillEvidence: collectSkillEvidence(analysis) };
    const recordingHash = createHash("sha256")
      .update(JSON.stringify(analysis.game))
      .digest("hex");
    const { error } = await admin.from("coaching_reviews").upsert(
      {
        user_id: userId,
        mode: input.mode,
        game_ref: input.gameRef,
        practice_game_id: practiceGameId,
        ranked_match_id: rankedMatchId,
        analysis_version: analysis.version,
        difficulty: analysis.game.difficulty,
        outcome: analysis.game.outcome,
        completed_at: completedAt,
        saved_at: new Date().toISOString(),
        recording_hash: recordingHash,
        review,
      },
      { onConflict: "user_id,mode,game_ref,analysis_version" },
    );
    if (error) throw new Error("Report save failed.");
    return Response.json({ saved: true, version: analysis.version }, { headers });
  } catch {
    console.error("Coaching report save failed.");
    return fail(
      "Could not save this coaching report. Your replay is still available.",
      503,
    );
  }
}

/** Remove the owner's saved snapshots for this game, never the original game.
 * Missing/foreign reports are indistinguishable from an already-unsaved report. */
export async function DELETE(request: Request) {
  const parsed = await readBoundedJson(request, 1024, true);
  if (!parsed.ok) return parsed.response;
  const input = parseReviewSave(parsed.value);
  if (!input) return fail("Invalid report selection.", 400);
  try {
    const auth = await authorize();
    if (!auth) return fail("Sign in to remove saved coaching reports.", 401);
    const { admin, userId } = auth;
    const { data: admitted, error: quotaError } = await admin.rpc(
      "reserve_coaching_review_save",
      { p_user_id: userId },
    );
    if (quotaError || typeof admitted !== "boolean")
      return fail("Report changes are temporarily unavailable.", 503);
    if (!admitted)
      return Response.json(
        { error: "Too many report changes. Please try again shortly." },
        { status: 429, headers: { ...headers, "Retry-After": "60" } },
      );
    const { error } = await admin
      .from("coaching_reviews")
      .delete()
      .eq("user_id", userId)
      .eq("mode", input.mode)
      .eq("game_ref", input.gameRef);
    if (error) throw new Error("Report removal failed.");
    return Response.json({ saved: false }, { headers });
  } catch {
    console.error("Coaching report removal failed.");
    return fail(
      "Could not remove this coaching report. Your replay is still available.",
      503,
    );
  }
}
