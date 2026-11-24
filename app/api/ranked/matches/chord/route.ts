import { createClient } from "@/lib/supabase/sever";
import { createAdminClient } from "@/lib/supabase/admin";
import { readRankedMoveJson } from "@/lib/ranked/http-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
};

// POST /api/ranked/matches/chord
// Chords a revealed numbered square in a Ranked match.
export async function POST(request: Request) {
  const probeActionStartedMs = performance.now();
  // Only allow requests from our own website.
  const parsed = await readRankedMoveJson(request);
  if (!parsed.ok) return parsed.response;
  const body: unknown = parsed.value;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid request body." }, { status: 400, headers });
  }

  const payload = body as Record<string, unknown>;
  const { matchId, row, column } = payload;

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Verify the match ID and board coordinates.
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
    // Step 1: Verify the player is signed in.
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

    // Step 2: Call the server-controlled chording function.
    // Supabase checks ownership, flags, and game rules.
    const admin = createAdminClient();

    const { data, error: chordError } = await admin.rpc("chord_ranked_cell", {
      p_match_id: matchId,
      p_user_id: verifiedUserId,
      p_row: row,
      p_column: column,
    });
    const probeActionRpcMs = performance.now();
    if (process.env.NODE_ENV === "development") {
      console.info(
        "[Ranked timing] chord " +
          `auth=${(probeActionAuthenticatedMs - probeActionStartedMs).toFixed(1)}ms ` +
          `rpc=${(probeActionRpcMs - probeActionAuthenticatedMs).toFixed(1)}ms ` +
          `total=${(probeActionRpcMs - probeActionStartedMs).toFixed(1)}ms`,
      );
    }

    if (chordError) {
      console.error("Ranked chord failed:", chordError);

      const rejected = chordError.code === "P0001";

      return Response.json(
        {
          error: rejected
            ? "This chord action is not allowed."
            : "Could not process the Ranked chord.",
        },
        { status: rejected ? 409 : 500, headers },
      );
    }

    if (!data) {
      return Response.json(
        { error: "No chord result was returned." },
        { status: 500, headers },
      );
    }

    // Return the verified move result.
    return Response.json(data, { status: 200, headers });
  } catch (error) {
    console.error("Ranked chord API error:", error);

    return Response.json(
      { error: "Ranked service is temporarily unavailable." },
      { status: 503, headers },
    );
  }
}
