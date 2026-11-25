import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import { checkRankedRateLimit, type RankedRateScope } from "./api-rate-limit-core";

/** Call only after verifying the request's authenticated account. */
export async function guardRankedRateLimit(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  scope: RankedRateScope,
): Promise<Response | null> {
  return checkRankedRateLimit(async () => {
    const { data, error } = await admin.rpc("reserve_ranked_api_request", {
      p_user_id: userId,
      p_scope: scope,
    });
    if (error) {
      console.error("Ranked admission unavailable:", error.code ?? "rpc_error");
      return null;
    }
    return data;
  });
}
