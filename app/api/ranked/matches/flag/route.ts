import { createClient } from "@/lib/supabase/sever";
import { createAdminClient } from "@/lib/supabase/admin";
import { readRankedMoveJson } from "@/lib/ranked/http-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store",
};

// POST /api/ranked/matches/flag
// Places or removes a flag in an authenticated Ranked match.
export async function POST(request: Request) {
  const probeActionStartedMs = performance.now();
  // Only accept requests from our website.
  const parsed = await readRankedMoveJson(request);
  if (!parsed.ok) return parsed.response;
  const body: unknown = parsed.value;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid request body." }, { status: 400, headers });
  }

  const payload = body as Record<string, unknown>;
  const { matchId, row, column } = payload;

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Validate the match ID and square coordinates.
  if (
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

    // AI_COACH_RANKED_ACTION_CLAIMS_PROBE_V1: opt-in dev-only verified JWT claims.
    // Default and production requests still call getUser() for a fresh user record.
    // Never use decoded/unverified cookies, request payloads or getSession().user for identity.
    const useClaimsProbe =
      process.env.NODE_ENV === "development" &&
      process.env.RANKED_AUTH_PROBE === "claims";
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
    const probeActionAuthenticatedMs = performance.now();

    if (authError || !verifiedUserId) {
      return Response.json(
        { error: "You must sign in to play Ranked." },
        { status: 401, headers },
      );
    }

    // Step 2: Ask the database to toggle the flag.
    // The SQL function verifies match ownership,
    // checks the board rules, and records the move.
    const admin = createAdminClient();

    const { data, error: flagError } = await admin.rpc("toggle_ranked_flag", {
      p_match_id: matchId,
      p_user_id: verifiedUserId,
      p_row: row,
      p_column: column,
    });
    const probeActionRpcMs = performance.now();
    if (process.env.NODE_ENV === "development") {
      console.info(
        "[Ranked timing] flag " +
          `auth=${(probeActionAuthenticatedMs - probeActionStartedMs).toFixed(1)}ms ` +
          `rpc=${(probeActionRpcMs - probeActionAuthenticatedMs).toFixed(1)}ms ` +
          `total=${(probeActionRpcMs - probeActionStartedMs).toFixed(1)}ms`,
      );
    }

    if (flagError) {
      console.error("Ranked flag failed:", flagError);

      const rejected = flagError.code === "P0001";

      return Response.json(
        {
          error: rejected
            ? "This flag action is not allowed."
            : "Could not update the Ranked flag.",
        },
        { status: rejected ? 409 : 500, headers },
      );
    }

    if (!data) {
      return Response.json(
        { error: "No flag result was returned." },
        { status: 500, headers },
      );
    }

    // Return only the result of the flag action.
    return Response.json(data, { status: 200, headers });
  } catch (error) {
    console.error("Ranked flag API error:", error);

    return Response.json(
      { error: "Ranked service is temporarily unavailable." },
      { status: 503, headers },
    );
  }
}
