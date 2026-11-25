import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { parseAccountTotalXp } from "./progression";

export type PlayerLevelLookup = { state: "guest" } | { state: "ready"; totalXp: number };

/**
 * XP is read-only from the browser. Neither this module nor any
 * public endpoint can award XP; only the server-owned verified
 * Ranked result trigger can do so.
 */
export async function loadPlayerLevel(
  expectedUserId?: string,
): Promise<PlayerLevelLookup> {
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

  if (!auth.user || (expectedUserId && auth.user.id !== expectedUserId)) {
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

/** The public receipt is owner-readable, but never writable, under database RLS. */
export type RankedMatchXpReceiptLookup =
  | { state: "guest" }
  | { state: "missing" }
  | { state: "earned"; outcome: "won" | "lost"; amount: number };

export async function loadRankedMatchXpReceipt(
  matchId: string,
): Promise<RankedMatchXpReceiptLookup> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchId)) {
    throw new Error("Invalid Ranked match ID.");
  }
  const client = getSupabaseBrowserClient();
  if (!client) return { state: "guest" };

  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError?.name === "AuthSessionMissingError") return { state: "guest" };
  if (authError || !auth.user) {
    throw new Error("Unable to verify your account right now.");
  }

  const { data, error } = await client
    .from("player_xp_match_receipts")
    .select("outcome, amount")
    .eq("match_id", matchId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) throw new Error("The verified match XP receipt is unavailable.");
  if (!data) return { state: "missing" };

  // Never fabricate reward amounts; reject unknown row shapes instead.
  if (
    (data.outcome !== "won" && data.outcome !== "lost") ||
    (data.outcome === "won" && data.amount !== 125) ||
    (data.outcome === "lost" && data.amount !== 10)
  ) {
    throw new Error("The database returned an unexpected XP receipt.");
  }
  return { state: "earned", outcome: data.outcome, amount: data.amount };
}
