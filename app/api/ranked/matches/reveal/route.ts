import { createClient } from "@/lib/supabase/sever";
import { createAdminClient } from "@/lib/supabase/admin";
import { readRankedMoveJson } from "@/lib/ranked/http-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store",
};

// POST /api/ranked/matches/reveal
// Handles both the first reveal and subsequent reveals.
export async function POST(request: Request) {
  // Block requests from other website origins.
  const parsed = await readRankedMoveJson(request);
  if (!parsed.ok) return parsed.response;
  const body: unknown = parsed.value;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid request body." }, { status: 400, headers });
  }

  const payload = body as Record<string, unknown>;
  const { matchId, row, column, firstMoveDone } = payload;

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

    if (authError || !verifiedUserId) {
      return Response.json(
        { error: "You must sign in to play Ranked." },
        { status: 401, headers },
      );
    }

    const admin = createAdminClient();

    // AI_COACH_RANKED_FAST_REVEAL_HINT_V1: the browser only supplies a routing hint.
    // SQL RPCs independently verify ownership, active status, and first-move state.
    // Older clients without the hint retain the original guarded lookup path.
    let functionName: "reveal_ranked_cell" | "reveal_first_ranked_cell";
    if (typeof firstMoveDone === "boolean") {
      functionName = firstMoveDone ? "reveal_ranked_cell" : "reveal_first_ranked_cell";
    } else {
      // AI_COACH_RANKED_PARALLEL_LOOKUPS_V1: overlap independent reads, keeping all existing checks.
      // Both responses remain server-only; the move RPC rechecks ownership.
      const [{ data: match, error: matchError }, { data: state, error: stateError }] =
        await Promise.all([
          admin
            .from("ranked_matches")
            .select("id")
            .eq("id", matchId)
            .eq("user_id", verifiedUserId)
            .eq("status", "active")
            .maybeSingle(),
          admin
            .from("ranked_match_state")
            .select("first_move_done")
            .eq("match_id", matchId)
            .maybeSingle(),
        ]);

      // Preserve the original error precedence and HTTP statuses.
      if (matchError) {
        console.error("Ranked match lookup failed:", matchError);

        return Response.json(
          { error: "Could not load Ranked match." },
          { status: 500, headers },
        );
      }

      if (!match) {
        return Response.json(
          { error: "Active Ranked match not found." },
          { status: 404, headers },
        );
      }

      if (stateError || !state) {
        console.error("Ranked state lookup failed:", stateError);

        return Response.json(
          { error: "Could not load Ranked board." },
          { status: 500, headers },
        );
      }

      // Step 4: Choose the appropriate database function.
      functionName = state.first_move_done
        ? "reveal_ranked_cell"
        : "reveal_first_ranked_cell";
    }

    // Both database functions verify ownership again
    // and lock the match before updating it.
    const { data, error: revealError } = await admin.rpc(functionName, {
      p_match_id: matchId,
      p_user_id: verifiedUserId,
      p_row: row,
      p_column: column,
    });

    if (revealError) {
      console.error("Ranked reveal failed:", revealError);

      const rejected = revealError.code === "P0001";

      return Response.json(
        {
          error: rejected
            ? "This move cannot be completed."
            : "Could not process the Ranked move.",
        },
        { status: rejected ? 409 : 500, headers },
      );
    }

    if (!data) {
      return Response.json(
        { error: "No Ranked move result was returned." },
        { status: 500, headers },
      );
    }

    // Return the verified move result.
    return Response.json(data, { status: 200, headers });
  } catch (error) {
    console.error("Ranked reveal API error:", error);

    return Response.json(
      { error: "Ranked service is temporarily unavailable." },
      { status: 503, headers },
    );
  }
}
