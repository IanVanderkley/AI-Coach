import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/sever";
import { guardRankedRateLimit } from "@/lib/ranked/api-rate-limit";
import { projectRankedLobbyRating } from "@/lib/leaderboard/rank-lobby";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

/** Private, owner-scoped read. No client-supplied rating, identity or match outcome. */
export async function GET() {
  try {
    const client = await createClient();
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();
    if (authError || !user)
      return Response.json(
        { error: "Sign in to view your rank." },
        { status: 401, headers },
      );
    const admin = createAdminClient();
    const rateLimited = await guardRankedRateLimit(admin, user.id, "read");
    if (rateLimited) return rateLimited;
    const [profile, before, after] = await Promise.all([
      admin
        .from("ranked_leaderboard_profiles")
        .select("rating")
        .eq("user_id", user.id)
        .single(),
      // Selecting policy_version also requires the Batch 23B schema. An older
      // database must not silently display v2 reward estimates.
      admin
        .from("ranked_elo_events")
        .select("rating_before,policy_version")
        .eq("user_id", user.id)
        .order("rating_before", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("ranked_elo_events")
        .select("rating_after,policy_version")
        .eq("user_id", user.id)
        .order("rating_after", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (profile.error || before.error || after.error || !profile.data)
      throw new Error("Rating history unavailable.");
    return Response.json(
      projectRankedLobbyRating(
        profile.data.rating,
        before.data?.rating_before ?? null,
        after.data?.rating_after ?? null,
      ),
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Rank progression is temporarily unavailable." },
      { status: 503, headers },
    );
  }
}
