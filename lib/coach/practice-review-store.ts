import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { PracticeSession } from "@/lib/practice/history";
import type { GameplayMove } from "@/lib/coach/types";
import { preparePracticeAnalysis } from "@/lib/coach/practice-analysis";
import { DIFFICULTY_SETTINGS } from "@/lib/game-settings";

/** Account-owned Practice recordings are still client supplied, not official results.
 * Limit server replay work and reject incomplete or malformed move sequences. */
export async function readPracticeReview(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  gameRef: string,
) {
  const { data: row, error } = await admin
    .from("practice_games")
    .select(
      "id,user_id,client_record_id,game,difficulty,rows,columns,mine_count,outcome,duration_seconds,mine_indices,completed_at,move_count",
    )
    .eq("user_id", userId)
    .eq("client_record_id", gameRef)
    .maybeSingle();
  if (error) throw new Error("Practice lookup failed.");
  if (!row || row.user_id !== userId || row.client_record_id !== gameRef)
    return { ok: false, status: 404 } as const;
  const settings = Object.values(DIFFICULTY_SETTINGS).find(
    (item) => item.label === row.difficulty,
  );
  if (
    !settings ||
    settings.rows !== row.rows ||
    settings.columns !== row.columns ||
    settings.mines !== row.mine_count ||
    !Number.isSafeInteger(row.move_count) ||
    row.move_count < 1 ||
    row.move_count > 1000 ||
    !Number.isInteger(row.rows) ||
    !Number.isInteger(row.columns) ||
    row.rows * row.columns > 480 ||
    !Number.isSafeInteger(row.duration_seconds) ||
    row.duration_seconds < 0 ||
    !Number.isFinite(Date.parse(row.completed_at)) ||
    row.game !== "minesweeper" ||
    !["Beginner", "Intermediate", "Expert"].includes(row.difficulty)
  )
    return { ok: false, status: 422 } as const;
  const {
    data: moves,
    count,
    error: moveError,
  } = await admin
    .from("practice_game_moves")
    .select("game_id,move_number,row,column,action_type,at_ms,after_hash", {
      count: "exact",
    })
    .eq("game_id", row.id)
    .order("move_number", { ascending: true })
    .limit(row.move_count);
  if (moveError) throw new Error("Practice moves lookup failed.");
  if (
    count !== row.move_count ||
    !moves ||
    moves.length !== row.move_count ||
    moves.some((m, i) => m.game_id !== row.id || m.move_number !== i + 1)
  )
    return { ok: false, status: 422 } as const;
  const game: PracticeSession = {
    game: "minesweeper",
    difficulty: row.difficulty,
    rows: row.rows,
    columns: row.columns,
    mineCount: row.mine_count,
    outcome: row.outcome,
    durationSeconds: row.duration_seconds,
    mines: row.mine_indices,
    moves: moves.map(
      (m): GameplayMove => ({
        row: m.row,
        col: m.column,
        action: m.action_type,
        ...(m.at_ms === null ? {} : { atMs: m.at_ms }),
        ...(m.after_hash === null ? {} : { afterHash: m.after_hash }),
      }),
    ),
  };
  try {
    const analysis = preparePracticeAnalysis(game);
    if (analysis.replay.frames.some((frame) => !frame.changed))
      return { ok: false, status: 422 } as const;
    return {
      ok: true,
      gameId: row.id as string,
      completedAt: row.completed_at as string,
      analysis,
    } as const;
  } catch {
    return { ok: false, status: 422 } as const;
  }
}
