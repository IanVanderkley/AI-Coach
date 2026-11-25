import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { checkPublicReadLimit, type PublicReadScope } from "./public-read-limit-core";

export function admitPublicRead(
  admin: ReturnType<typeof createAdminClient>,
  scope: PublicReadScope,
): Promise<Response | null> {
  return checkPublicReadLimit(async () => {
    const { data, error } = await admin.rpc("reserve_public_read_request", {
      p_scope: scope,
    });
    if (error) {
      console.error("Public leaderboard admission unavailable.");
      throw new Error("Public read admission unavailable.");
    }
    return data;
  });
}
