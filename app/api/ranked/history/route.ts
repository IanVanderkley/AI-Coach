import { createAdminClient } from "@/lib/supabase/admin";
import { guardRankedRateLimit } from "@/lib/ranked/api-rate-limit";
import { createClient } from "@/lib/supabase/sever";
import { RANKED_HISTORY_LIMIT, serializeRankedHistory } from "@/lib/ranked/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

/** Read-only history. No client-supplied ID, match result, or reward amount is accepted. */
export async function GET() {
  try {
    const client = await createClient();
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();
    if (authError || !user) {
      return Response.json(
        { error: "Sign in to view Ranked history." },
        { status: 401, headers },
      );
    }

    const admin = createAdminClient();
    const rateLimited = await guardRankedRateLimit(admin, user.id, "read");
    if (rateLimited) return rateLimited;
    const { data: matches, error: matchesError } = await admin
      .from("ranked_matches")
      .select(
        "id,user_id,status,rows,columns,mine_count,move_count,duration_ms,finished_at",
      )
      .eq("user_id", user.id)
      .in("status", ["won", "lost"])
      .order("finished_at", { ascending: false })
      .limit(RANKED_HISTORY_LIMIT);
    if (matchesError) throw new Error("Ranked match query failed.");

    const matchIds = (matches ?? []).map((match) => match.id);
    if (matchIds.length === 0) {
      return Response.json({ matches: [] }, { status: 200, headers });
    }

    const [verifiedQuery, receiptQuery] = await Promise.all([
      admin
        .from("ranked_verified_results")
        .select("match_id,user_id")
        .eq("user_id", user.id)
        .in("match_id", matchIds),
      client
        .from("player_xp_match_receipts")
        .select("match_id,user_id,outcome,amount")
        .eq("user_id", user.id)
        .in("match_id", matchIds),
    ]);
    if (verifiedQuery.error || receiptQuery.error) {
      throw new Error("Verified Ranked history data unavailable.");
    }

    const history = serializeRankedHistory(
      matches,
      verifiedQuery.data,
      receiptQuery.data,
      user.id,
    );
    // Omit account IDs, hidden mines, flags, and internal match UUIDs.
    return Response.json({ matches: history }, { status: 200, headers });
  } catch (error) {
    console.error("Ranked history lookup failed:");
    return Response.json(
      { error: "Ranked history is temporarily unavailable." },
      { status: 503, headers },
    );
  }
}
