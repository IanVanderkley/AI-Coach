import {
  PRACTICE_DIFFICULTIES,
  type PracticeDifficultySummary,
} from "./practice-difficulty.ts";
import type { RecentStats } from "./player-dashboard.ts";

export type PracticeAccountTracking = {
  overall: RecentStats;
  breakdown: PracticeDifficultySummary[];
  /** Account tracking starts at deployment, with retained complete games backfilled. */
  activatedAt: string | null;
};

export type PracticeTrackingLookup =
  | { kind: "guest" }
  | { kind: "ready"; tracking: PracticeAccountTracking };

type Row = Record<string, unknown>;

function safeNonnegativeInteger(value: unknown, label: string): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^(0|[1-9]\d*)$/.test(value)
        ? Number(value)
        : NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid tracked Practice ${label}.`);
  }
  return parsed;
}

function nonnegativeSeconds(value: unknown): number | null {
  if (value === null) return null;
  return safeNonnegativeInteger(value, "win duration");
}

/** Validate a read-only, owner-scoped response before displaying account totals. */
export function parsePracticeAccountTotals(
  data: unknown,
  verifiedUserId: string,
): PracticeAccountTracking {
  if (!Array.isArray(data) || data.length > 3 || !verifiedUserId) {
    throw new Error("Invalid tracked Practice response.");
  }
  const seen = new Map<string, PracticeDifficultySummary>();
  const activationDates: string[] = [];
  for (const raw of data) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("Invalid tracked Practice row.");
    }
    const row = raw as Row;
    if (
      row.user_id !== verifiedUserId ||
      !PRACTICE_DIFFICULTIES.some((value) => value === row.difficulty) ||
      typeof row.difficulty !== "string" ||
      seen.has(row.difficulty)
    ) {
      throw new Error("Invalid tracked Practice owner or difficulty.");
    }
    const games = safeNonnegativeInteger(row.games_played, "games");
    const wins = safeNonnegativeInteger(row.wins, "wins");
    const losses = safeNonnegativeInteger(row.losses, "losses");
    const best = nonnegativeSeconds(row.fastest_win_seconds);
    if (
      games !== wins + losses ||
      (wins === 0 && best !== null) ||
      (wins > 0 && best === null)
    ) {
      throw new Error("Inconsistent tracked Practice totals.");
    }
    if (
      typeof row.tracking_activated_at !== "string" ||
      !Number.isFinite(Date.parse(row.tracking_activated_at))
    ) {
      throw new Error("Invalid Practice tracking activation date.");
    }
    activationDates.push(row.tracking_activated_at);
    seen.set(row.difficulty, {
      difficulty: row.difficulty as (typeof PRACTICE_DIFFICULTIES)[number],
      stats: {
        games,
        wins,
        losses,
        winRate: games === 0 ? null : (wins / games) * 100,
      },
      fastestWinSeconds: best,
    });
  }
  const breakdown = PRACTICE_DIFFICULTIES.map(
    (difficulty) =>
      seen.get(difficulty) ?? {
        difficulty,
        stats: { games: 0, wins: 0, losses: 0, winRate: null },
        fastestWinSeconds: null,
      },
  );
  const games = breakdown.reduce((sum, item) => sum + item.stats.games, 0);
  const wins = breakdown.reduce((sum, item) => sum + item.stats.wins, 0);
  const losses = breakdown.reduce((sum, item) => sum + item.stats.losses, 0);
  if (![games, wins, losses].every(Number.isSafeInteger)) {
    throw new Error("Tracked Practice total exceeds safe display range.");
  }
  return {
    overall: {
      games,
      wins,
      losses,
      winRate: games === 0 ? null : (wins / games) * 100,
    },
    breakdown,
    activatedAt: activationDates.length
      ? activationDates.sort((a, b) => Date.parse(a) - Date.parse(b))[0]
      : null,
  };
}
