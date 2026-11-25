import { createClient } from "@/lib/supabase/sever";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRankedRateLimit } from "@/lib/ranked/api-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
};

// GET /api/ranked/matches/current
// Restores the signed-in player's active Ranked game.
export async function GET(request: Request) {
  try {
    // Step 1: Verify the currently signed-in player.
    const supabase = await createClient();

    // AI_COACH_RANKED_RECOVERY_CLAIMS_PROBE_V1: opt-in development-only JWT-claims experiment.
    // Default mode still uses getUser(); production claims require explicit opt-in.
    const useClaimsProbe =
      process.env.RANKED_AUTH_MODE === "claims" ||
      (process.env.NODE_ENV === "development" &&
        process.env.RANKED_AUTH_PROBE === "claims");
    let verifiedUserId: string | undefined;
    let authError: unknown = null;
    if (useClaimsProbe) {
      const { data, error } = await supabase.auth.getClaims();
      authError = error;
      verifiedUserId =
        typeof data?.claims?.sub === "string" && data.claims.sub.length > 0
          ? data.claims.sub
          : undefined;
    } else {
      const { data, error } = await supabase.auth.getUser();
      authError = error;
      verifiedUserId = data.user?.id;
    }

    if (authError || !verifiedUserId) {
      return Response.json(
        { error: "You must sign in to play Ranked." },
        { status: 401, headers },
      );
    }

    // Step 2: Find the player's active Ranked match.
    const admin = createAdminClient();
    const rateLimited = await guardRankedRateLimit(admin, verifiedUserId, "read");
    if (rateLimited) return rateLimited;

    // AI_COACH_RANKED_CACHED_RECOVERY_V1: an optional opaque hint, never a source of identity.
    // The existing SQL function checks BOTH user ownership and active match state.
    // Invalid, expired or foreign match IDs fall through to the original lookup.
    const knownMatchId = request.headers.get("x-ranked-known-match");
    if (
      knownMatchId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(knownMatchId)
    ) {
      const { data: knownBoard, error: knownError } = await admin.rpc(
        "get_ranked_visible_board",
        {
          p_match_id: knownMatchId,
          p_user_id: verifiedUserId,
        },
      );
      if (
        !knownError &&
        knownBoard &&
        knownBoard.matchId === knownMatchId &&
        knownBoard.status === "active"
      ) {
        return Response.json(knownBoard, { status: 200, headers });
      }
    }

    const { data: match, error: matchError } = await admin
      .from("ranked_matches")
      .select("id")
      .eq("user_id", verifiedUserId)
      .eq("status", "active")
      .maybeSingle();

    if (matchError) {
      console.error("Ranked match lookup failed:", matchError);

      return Response.json(
        { error: "Could not load Ranked match." },
        { status: 500, headers },
      );
    }

    // The player might not have an unfinished match.
    if (!match) {
      return Response.json(
        { error: "No active Ranked match found." },
        { status: 404, headers },
      );
    }

    // Step 3: Ask Supabase for the player-visible board.
    // This function verifies ownership again.
    const { data, error: boardError } = await admin.rpc("get_ranked_visible_board", {
      p_match_id: match.id,
      p_user_id: verifiedUserId,
    });
    if (boardError) {
      console.error("Ranked board recovery failed:", boardError);

      return Response.json(
        { error: "Could not restore Ranked board." },
        { status: 500, headers },
      );
    }

    if (!data) {
      return Response.json(
        { error: "No Ranked board data was returned." },
        { status: 500, headers },
      );
    }

    // Step 4: Return only the visible board information.
    return Response.json(data, { status: 200, headers });
  } catch (error) {
    console.error("Ranked recovery API error:", error);

    return Response.json(
      { error: "Ranked service is temporarily unavailable." },
      { status: 503, headers },
    );
  }
}
