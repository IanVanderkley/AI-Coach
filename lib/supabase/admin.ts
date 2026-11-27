import "server-only";

import { createClient } from "@supabase/supabase-js";
import { ACTIVE_RANK_POLICY_VERSION } from "@/lib/leaderboard/active-rank-policy";

// Only backend code should use this client.
// It has privileged database access and bypasses Row Level Security.
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error("Missing Supabase server configuration.");
  }

  return createClient(supabaseUrl, secretKey, {
    global: {
      headers: {
        "x-ai-coach-ranked-policy": String(ACTIVE_RANK_POLICY_VERSION),
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
