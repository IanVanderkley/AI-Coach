import { createAdminClient } from "@/lib/supabase/admin";
import { admitPublicRead } from "@/lib/http/public-read-limit";
import {
  projectPublicStandings,
  PUBLIC_RATING_SYSTEM_V4,
} from "@/lib/leaderboard/public-standings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "public, no-store" };

/** PUBLIC: only opt-in usernames and database-verified results leave this route. */
export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return Response.json({ error: "Leaderboard unavailable." }, { status: 503, headers });
  }
  try {
    const admin = createAdminClient();
    const denied = await admitPublicRead(admin, "leaderboard");
    if (denied) return denied;
    const [elo, speed] = await Promise.all([
      admin
        .from("ranked_public_elo")
        .select("username,rating,games,wins,losses")
        .order("rating", { ascending: false })
        .order("wins", { ascending: false })
        .order("username", { ascending: true })
        .limit(50),
      admin
        .from("ranked_public_fastest")
        .select("username,duration_ms,finished_at")
        .order("duration_ms", { ascending: true })
        .order("finished_at", { ascending: true })
        .order("username", { ascending: true })
        .limit(50),
    ]);
    if (elo.error || speed.error) {
      console.error("Ranked leaderboard database view unavailable.");
      throw new Error("Leaderboard is unavailable.");
    }
    return Response.json(
      projectPublicStandings(elo.data, speed.data, PUBLIC_RATING_SYSTEM_V4),
      {
        status: 200,
        headers,
      },
    );
  } catch {
    return Response.json({ error: "Leaderboard unavailable." }, { status: 503, headers });
  }
}
