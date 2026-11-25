import { createClient } from "@/lib/supabase/sever";
import { createAdminClient } from "@/lib/supabase/admin";
import { readVerifiedRankedSessionId } from "@/lib/ranked/session-claims";
import { combinedMoveResponse } from "@/lib/ranked/combined-move-response";
import { createRankedMoveTiming } from "@/lib/ranked/move-timing";
import { readRankedMoveJson } from "@/lib/ranked/http-security";
import { isRankedMoveRevision } from "@/lib/ranked/move-revision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
};

// POST /api/ranked/matches/chord
// Chords a revealed numbered square in a Ranked match.
export async function POST(request: Request) {
  const timing = createRankedMoveTiming();
  // Only allow requests from our own website.
  const parsed = await readRankedMoveJson(request);
  if (!parsed.ok) return parsed.response;
  const body: unknown = parsed.value;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid request body." }, { status: 400, headers });
  }

  const payload = body as Record<string, unknown>;
  const { matchId, row, column, expectedMoveCount } = payload;

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
    timing.startAuth();
    const supabase = await createClient();

    // AI_COACH_RANKED_ACTION_CLAIMS_PROBE_V1: opt-in dev-only verified JWT claims.
    // Default requests still call getUser(); production claims require explicit opt-in.
    // Never use decoded/unverified cookies, request payloads or getSession().user for identity.
    const useClaimsProbe =
      process.env.RANKED_AUTH_MODE === "claims" ||
      (process.env.NODE_ENV === "development" &&
        process.env.RANKED_AUTH_PROBE === "claims");
    let verifiedUserId: string | undefined;
    let verifiedSessionId: string | undefined;
    let authError: unknown = null;
    if (useClaimsProbe) {
      const { data, error } = await supabase.auth.getClaims();
      authError = error;
      verifiedSessionId = readVerifiedRankedSessionId(data?.claims);
      if (!verifiedSessionId) authError = new Error("Invalid Ranked session claims");
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

    // Step 2: Call the server-controlled chording function.
    // Supabase checks ownership, flags, and game rules.
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
      ...(useClaimsProbe ? { p_session_id: verifiedSessionId } : {}),
      p_match_id: matchId,
      p_action: "chord",
      p_row: row,
      p_column: column,
      p_expected_move_count: expectedMoveCount,
    });
    if (error) console.error("Ranked chord RPC unavailable");
    return timing.attach(combinedMoveResponse(data, Boolean(error)));
  } catch (error) {
    console.error("Ranked chord API error:");

    return Response.json(
      { error: "Ranked service is temporarily unavailable." },
      { status: 503, headers },
    );
  }
}
