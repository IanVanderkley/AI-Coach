import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { RankedRecordingStore } from "@/lib/ranked/coaching-recording";

/** Same trusted reader for the existing GET and explicit report saving. */
export function createRankedRecordingStore(
  admin: ReturnType<typeof createAdminClient>,
): RankedRecordingStore {
  return {
    async match(id, owner) {
      const { data, error } = await admin
        .from("ranked_matches")
        .select(
          "id,user_id,status,rows,columns,mine_count,move_count,duration_ms,started_at,finished_at",
        )
        .eq("id", id)
        .eq("user_id", owner)
        .in("status", ["won", "lost"])
        .maybeSingle();
      if (error) throw new Error("Ranked match lookup failed.");
      return data;
    },
    async verifiedResult(id, owner) {
      const { data, error } = await admin
        .from("ranked_verified_results")
        .select(
          "match_id,user_id,board_rows,board_columns,mine_count,duration_ms,finished_at",
        )
        .eq("match_id", id)
        .eq("user_id", owner)
        .maybeSingle();
      if (error) throw new Error("Ranked result lookup failed.");
      return data;
    },
    async state(id) {
      const { data, error } = await admin
        .from("ranked_match_state")
        .select(
          "match_id,mine_positions,revealed_positions,flagged_positions,first_move_done",
        )
        .eq("match_id", id)
        .maybeSingle();
      if (error) throw new Error("Ranked state lookup failed.");
      return data;
    },
    async moves(id, limit) {
      const { data, error, count } = await admin
        .from("ranked_match_moves")
        .select("match_id,move_number,action,row_index,column_index,received_at", {
          count: "exact",
        })
        .eq("match_id", id)
        .order("move_number", { ascending: true })
        .limit(limit);
      if (error) throw new Error("Ranked move lookup failed.");
      return count === limit ? data : null;
    },
  };
}
