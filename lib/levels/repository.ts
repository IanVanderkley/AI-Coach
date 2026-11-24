import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { parseAccountTotalXp } from "./progression";

export type PlayerLevelLookup = { state: "guest" } | { state: "ready"; totalXp: number };

/**
 * XP is read-only from the browser. Neither this module nor any
 * public endpoint can award XP; only the server-owned verified
 * Ranked result trigger can do so.
 */
export async function loadPlayerLevel(): Promise<PlayerLevelLookup> {
  const client = getSupabaseBrowserClient();

  if (!client) {
    return { state: "guest" };
  }

  // Verify the authenticated user instead of trusting a cached ID.
  const { data: auth, error: authError } = await client.auth.getUser();

  // A missing session is normal for guests.
  if (authError?.name === "AuthSessionMissingError") {
    return { state: "guest" };
  }

  // Other authentication errors should not be treated as guests.
  if (authError) {
    throw new Error("Unable to verify your account right now.");
  }

  if (!auth.user) {
    return { state: "guest" };
  }

  // Fetch the authenticated player's XP.
  // Row Level Security restricts access to their own record.
  const { data, error } = await client
    .from("player_xp_profiles")
    .select("total_xp")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    throw new Error("Account XP is unavailable. Check database deployment.");
  }

  // Players without an XP record start at zero.
  return {
    state: "ready",
    totalXp: parseAccountTotalXp(data?.total_xp ?? 0),
  };
}
