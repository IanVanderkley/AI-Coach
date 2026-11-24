/** Server-confirmed personal Ranked history, never a client-submitted result. */
export const RANKED_HISTORY_LIMIT = 10;

export type RankedHistoryEntry = {
  outcome: "won" | "lost";
  rows: number;
  columns: number;
  mineCount: number;
  moveCount: number;
  durationMs: number | null;
  finishedAt: string;
  earnedXp: number | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function row(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid Ranked history row.");
  }
  return value as Record<string, unknown>;
}

function safeInt(value: unknown, minimum: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
}

/**
 * The API has already queried each table using its verified account ID.
 * Recheck ownership and exact outcome/receipt matching to fail closed on bad data.
 * Win history requires an official verified-results row; losses come from server-only matches.
 */
export function serializeRankedHistory(
  matches: unknown,
  verifiedResults: unknown,
  xpReceipts: unknown,
  verifiedUserId: string,
): RankedHistoryEntry[] {
  if (!UUID.test(verifiedUserId)) throw new Error("Invalid account ID.");
  if (
    !Array.isArray(matches) ||
    !Array.isArray(verifiedResults) ||
    !Array.isArray(xpReceipts) ||
    matches.length > RANKED_HISTORY_LIMIT
  ) {
    throw new Error("Invalid Ranked history response.");
  }

  const verified = new Set<string>();
  for (const item of verifiedResults) {
    const value = row(item);
    if (
      value.user_id !== verifiedUserId ||
      typeof value.match_id !== "string" ||
      !UUID.test(value.match_id)
    ) {
      throw new Error("Invalid verified Ranked outcome.");
    }
    verified.add(value.match_id);
  }

  const receiptMap = new Map<string, { outcome: "won" | "lost"; amount: number }>();
  for (const item of xpReceipts) {
    const value = row(item);
    if (
      value.user_id !== verifiedUserId ||
      typeof value.match_id !== "string" ||
      !UUID.test(value.match_id) ||
      (value.outcome !== "won" && value.outcome !== "lost") ||
      !safeInt(value.amount, 0) ||
      value.amount !== (value.outcome === "won" ? 125 : 10) ||
      receiptMap.has(value.match_id)
    ) {
      throw new Error("Invalid Ranked XP receipt.");
    }
    receiptMap.set(value.match_id, { outcome: value.outcome, amount: value.amount });
  }

  const output: RankedHistoryEntry[] = [];
  for (const item of matches) {
    const value = row(item);
    if (
      value.user_id !== verifiedUserId ||
      typeof value.id !== "string" ||
      !UUID.test(value.id) ||
      (value.status !== "won" && value.status !== "lost") ||
      value.rows !== 16 ||
      value.columns !== 16 ||
      value.mine_count !== 40 ||
      !safeInt(value.move_count, 1) ||
      (value.duration_ms !== null && !safeInt(value.duration_ms, 0)) ||
      typeof value.finished_at !== "string" ||
      !Number.isFinite(Date.parse(value.finished_at))
    ) {
      throw new Error("Invalid server-owned Ranked match history.");
    }
    // An unverified 'won' row must never appear as an official Ranked victory.
    if (value.status === "won" && !verified.has(value.id)) continue;

    const receipt = receiptMap.get(value.id);
    if (receipt && receipt.outcome !== value.status) {
      throw new Error("Mismatched Ranked XP receipt.");
    }
    output.push({
      outcome: value.status,
      rows: 16,
      columns: 16,
      mineCount: 40,
      moveCount: value.move_count,
      durationMs: value.duration_ms as number | null,
      finishedAt: value.finished_at,
      earnedXp: receipt?.amount ?? null,
    });
  }
  return output;
}
