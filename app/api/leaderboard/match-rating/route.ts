import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/sever";
import { parseRankedMatchRating } from "@/lib/leaderboard/match-rating";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Owner-only private rating receipt; never accepts or computes client-supplied rating. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const matchIds = url.searchParams.getAll("matchId");
  if (
    matchIds.length !== 1 ||
    !UUID.test(matchIds[0]) ||
    [...url.searchParams.keys()].some((key) => key !== "matchId")
  ) {
    return Response.json({ error: "Invalid match reference." }, { status: 400, headers });
  }

  try {
    const client = await createClient();
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();
    if (authError || !user) {
      return Response.json(
        { error: "Sign in to view your match rating." },
        { status: 401, headers },
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ranked_elo_events")
      .select("outcome,rating_before,rating_delta,rating_after,policy_version,final_guess_compensated")
      .eq("match_id", matchIds[0])
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return Response.json(
        { error: "Match rating not found." },
        { status: 404, headers },
      );

    if (typeof data.final_guess_compensated !== "boolean") throw new Error("Invalid receipt marker");
    const receipt = parseRankedMatchRating({
      ...(data.final_guess_compensated ? { finalGuessCompensated: true } : {}),
      outcome: data.outcome,
      policyVersion: data.policy_version,
      ratingBefore: data.rating_before,
      ratingDelta: data.rating_delta,
      ratingAfter: data.rating_after,
    });
    return Response.json(receipt, { status: 200, headers });
  } catch (error) {
    console.error(
      "Owner-scoped Ranked rating lookup failed:",
      error instanceof Error ? error.name : "unknown",
    );
    return Response.json(
      { error: "Match rating unavailable." },
      { status: 503, headers },
    );
  }
}
