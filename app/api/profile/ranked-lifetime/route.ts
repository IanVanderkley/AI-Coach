import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/sever";
import { summarizeRankedLifetime } from "@/lib/profile/ranked-lifetime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

/** Only official, account-owned Intermediate results count. No request body or user ID accepted. */
export async function GET() {
  try {
    const client = await createClient();
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();
    if (authError || !user) {
      return Response.json(
        { error: "Sign in to view your Ranked lifetime statistics." },
        { status: 401, headers },
      );
    }

    const admin = createAdminClient();
    const [wins, losses, fastest] = await Promise.all([
      admin
        .from("ranked_verified_results")
        .select("match_id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("board_rows", 16)
        .eq("board_columns", 16)
        .eq("mine_count", 40),
      admin
        .from("ranked_matches")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "lost")
        .eq("rows", 16)
        .eq("columns", 16)
        .eq("mine_count", 40),
      admin
        .from("ranked_verified_results")
        .select("duration_ms")
        .eq("user_id", user.id)
        .eq("board_rows", 16)
        .eq("board_columns", 16)
        .eq("mine_count", 40)
        .order("duration_ms", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (wins.error || losses.error || fastest.error) {
      throw new Error("Unable to read verified Ranked lifetime statistics.");
    }
    // PostgREST's exact count is required. Never substitute an empty result on a failed query.
    const stats = summarizeRankedLifetime(
      wins.count,
      losses.count,
      fastest.data?.duration_ms ?? null,
    );
    return Response.json(
      { scope: "verified-intermediate-lifetime", stats },
      { status: 200, headers },
    );
  } catch (error) {
    console.error("Ranked lifetime statistics lookup failed:");
    return Response.json(
      { error: "Ranked lifetime statistics are temporarily unavailable." },
      { status: 503, headers },
    );
  }
}
