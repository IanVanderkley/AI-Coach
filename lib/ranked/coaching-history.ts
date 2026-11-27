import {
  RANKED_HISTORY_LIMIT,
  serializeRankedHistory,
  type RankedHistoryEntry,
} from "./history.ts";
import { isRankedRecordingId, RANKED_COACHING_MAX_MOVES } from "./coaching-recording.ts";

export type RankedCoachingHistoryEntry = Omit<RankedHistoryEntry, "earnedXp"> & {
  matchId: string;
  reviewAvailable: boolean;
};

/** The normal profile history still omits internal IDs. Only this private
 * coaching projection includes an owner-scoped ID for selecting a recording. */
export function serializeRankedCoachingHistory(
  matches: unknown,
  verified: unknown,
  owner: string,
): RankedCoachingHistoryEntry[] {
  if (
    !Array.isArray(matches) ||
    matches.length > RANKED_HISTORY_LIMIT ||
    !Array.isArray(verified)
  )
    throw new Error("Invalid coaching history.");
  // Reuse the existing validation, ownership and official-win filtering rules.
  serializeRankedHistory(matches, verified, [], owner);
  const result: RankedCoachingHistoryEntry[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    if (!isRankedRecordingId(match.id) || seen.has(match.id))
      throw new Error("Invalid match ID.");
    seen.add(match.id);
    const item = serializeRankedHistory([match], verified, [], owner)[0];
    if (!item) continue;
    const { earnedXp: _receipt, ...summary } = item;
    result.push({
      ...summary,
      matchId: match.id,
      reviewAvailable:
        item.durationMs !== null && item.moveCount <= RANKED_COACHING_MAX_MOVES,
    });
  }
  return result;
}
