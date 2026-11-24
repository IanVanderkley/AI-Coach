import { getSupabaseBrowserClient } from "../supabase/client.ts";
import {
  parsePracticeAccountTotals,
  type PracticeTrackingLookup,
} from "./practice-account-tracking-core.ts";
export type { PracticeAccountTracking } from "./practice-account-tracking-core.ts";

/** Uses signed-in Supabase RLS only; never writes or calls privileged RPCs. */
export async function loadPracticeAccountTracking(): Promise<PracticeTrackingLookup> {
  const client = getSupabaseBrowserClient();
  if (!client) return { kind: "guest" };
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError?.name === "AuthSessionMissingError" || !auth.user) {
    if (authError && authError.name !== "AuthSessionMissingError") {
      throw new Error("Unable to verify the Practice account.");
    }
    return { kind: "guest" };
  }
  if (authError) throw new Error("Unable to verify the Practice account.");
  const { data, error } = await client
    .from("practice_account_totals")
    .select(
      "user_id,difficulty,games_played,wins,losses,fastest_win_seconds,tracking_activated_at",
    )
    .eq("user_id", auth.user.id);
  if (error) throw new Error("Tracked Practice totals are unavailable.");
  return { kind: "ready", tracking: parsePracticeAccountTotals(data, auth.user.id) };
}
