import { createClient } from "@/lib/supabase/sever";
import { createAdminClient } from "@/lib/supabase/admin";
import { combinedMoveResponse } from "@/lib/ranked/combined-move-response";
import { createRankedMoveTiming } from "@/lib/ranked/move-timing";
import { readRankedMoveJson } from "@/lib/ranked/http-security";
import { isRankedMoveRevision } from "@/lib/ranked/move-revision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store",
};

// POST /api/ranked/matches/reveal
// Handles both the first reveal and subsequent reveals.
export async function POST(request: Request) {
  const timing = createRankedMoveTiming();
  // Block requests from other website origins.
  const parsed = await readRankedMoveJson(request);
  if (!parsed.ok) return parsed.response;
  const body: unknown = parsed.value;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid request body." }, { status: 400, headers });
  }

  const payload = body as Record<string, unknown>;
  const { matchId, row, column, expectedMoveCount, firstMoveDone } = payload;

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (
    (firstMoveDone !== undefined && typeof firstMoveDone !== "boolean") ||
    typeof matchId !== "string" ||
    !uuidPattern.test(matchId) ||
    typeof row !== "number" ||
    !Number.isInteger(row) ||
    row < 0 ||
    row > 15 ||
    typeof column !== "number" ||
    !Number.isInteger(column) ||
    column < 0 ||
    column > 15
  ) {
    return Response.json(
      { error: "Invalid match ID or board position." },
      { status: 400, headers },
    );
  }

  try {
    // Step 1: Verify the signed-in player.
    timing.startAuth();
    const supabase = await createClient();

    // AI_COACH_RANKED_DEV_CLAIMS_PROBE_V1: compare verified JWT claims with getUser in development.
    // Production may opt in with RANKED_AUTH_MODE=claims; default remains getUser().
    // Never trust cookies, request bodies, or unverified decoded tokens for identity.
    const useClaimsProbe =
      process.env.RANKED_AUTH_MODE === "claims" ||
      (process.env.NODE_ENV === "development" &&
        process.env.RANKED_AUTH_PROBE === "claims");
    let verifiedUserId: string | undefined;
    let authError: unknown = null;

    if (useClaimsProbe) {
      // getClaims verifies the JWT signature. Asymmetric keys may validate
      // locally after JWKS caching; symmetric keys fall back to online auth.
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

    timing.finishAuth();
    if (authError || !verifiedUserId) {
      return Response.json(
        { error: "You must sign in to play Ranked." },
        { status: 401, headers },
      );
    }

    // The browser supplies the revision it actually observed, not authority to move.
    if (!isRankedMoveRevision(expectedMoveCount)) {
      return Response.json(
        { error: "Refresh Ranked before sending another move." },
        { status: 400, headers },
      );
    }

    const admin = createAdminClient();
    // A single database request reserves quota and executes the revision-checked move.
    timing.startDatabase();
    const { data, error } = await admin.rpc("execute_ranked_move", {
      p_user_id: verifiedUserId,
      p_match_id: matchId,
      p_action: "reveal",
      p_row: row,
      p_column: column,
      p_expected_move_count: expectedMoveCount,
    });
    if (error) console.error("Ranked reveal RPC unavailable");
    return timing.attach(combinedMoveResponse(data, Boolean(error)));
  } catch (error) {
    console.error("Ranked reveal API error:");

    return Response.json(
      { error: "Ranked service is temporarily unavailable." },
      { status: 503, headers },
    );
  }
}
