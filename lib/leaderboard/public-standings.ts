/** Public standings are privacy-filtered in PostgreSQL before ranking or limiting. */
export const PUBLIC_LEADERBOARD_ENDPOINT = "/api/leaderboard";
export const PUBLIC_LEADERBOARD_LIMIT = 50;
export const PUBLIC_RATING_SYSTEM = "solo-elo-benchmark-v3" as const;
export const PUBLIC_RATING_SYSTEM_V4 = "solo-tier-rating-v4" as const;
export type PublicRatingSystem =
  | typeof PUBLIC_RATING_SYSTEM
  | typeof PUBLIC_RATING_SYSTEM_V4;
export const PUBLIC_USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

export type EloStanding = {
  rank: number;
  username: string;
  rating: number;
  games: number;
  wins: number;
  losses: number;
};

export type SpeedStanding = {
  rank: number;
  username: string;
  durationMs: number;
  finishedAt: string;
};

export type PublicStandings = {
  source: "server-verified";
  ratingSystem: PublicRatingSystem;
  board: "intermediate-16x16-40";
  elo: EloStanding[];
  fastest: SpeedStanding[];
};

type UnknownRow = Record<string, unknown>;
const isRow = (value: unknown): value is UnknownRow =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const validUsername = (value: unknown): value is string =>
  typeof value === "string" && PUBLIC_USERNAME_PATTERN.test(value);

const validInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= min &&
  value <= max;

/** Server-side projection: never pass through user IDs, e-mails, or match IDs. */
export function projectPublicStandings(
  eloRows: unknown,
  fastestRows: unknown,
  ratingSystem: PublicRatingSystem = PUBLIC_RATING_SYSTEM,
): PublicStandings {
  if (
    (ratingSystem !== PUBLIC_RATING_SYSTEM && ratingSystem !== PUBLIC_RATING_SYSTEM_V4) ||
    !Array.isArray(eloRows) ||
    !Array.isArray(fastestRows) ||
    eloRows.length > PUBLIC_LEADERBOARD_LIMIT ||
    fastestRows.length > PUBLIC_LEADERBOARD_LIMIT
  ) {
    throw new TypeError("Invalid public leaderboard rows.");
  }
  let previousRating = Infinity;
  let previousWins = Infinity;
  const elo = eloRows.map((value: unknown, index): EloStanding => {
    if (
      !isRow(value) ||
      !validUsername(value.username) ||
      !validInt(
        value.rating,
        ratingSystem === PUBLIC_RATING_SYSTEM_V4 ? -2147483648 : 100,
        10000,
      ) ||
      !validInt(value.games, 1, 100000000) ||
      !validInt(value.wins, 0, 100000000) ||
      !validInt(value.losses, 0, 100000000) ||
      value.games !== value.wins + value.losses ||
      value.rating > previousRating ||
      (value.rating === previousRating && value.wins > previousWins)
    ) {
      throw new TypeError("Invalid public Elo standings.");
    }
    previousRating = value.rating;
    previousWins = value.wins;
    return {
      rank: index + 1,
      username: value.username,
      rating: value.rating,
      games: value.games,
      wins: value.wins,
      losses: value.losses,
    };
  });

  let previousDuration = 0;
  let previousFinishedAt = "";
  const fastest = fastestRows.map((value: unknown, index): SpeedStanding => {
    if (
      !isRow(value) ||
      !validUsername(value.username) ||
      !validInt(value.duration_ms, 1, Number.MAX_SAFE_INTEGER) ||
      typeof value.finished_at !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T/.test(value.finished_at) ||
      !Number.isFinite(Date.parse(value.finished_at)) ||
      value.duration_ms < previousDuration ||
      (value.duration_ms === previousDuration && value.finished_at < previousFinishedAt)
    ) {
      throw new TypeError("Invalid public speed standings.");
    }
    previousDuration = value.duration_ms;
    previousFinishedAt = value.finished_at;
    return {
      rank: index + 1,
      username: value.username,
      durationMs: value.duration_ms,
      finishedAt: value.finished_at,
    };
  });
  return {
    source: "server-verified",
    ratingSystem,
    board: "intermediate-16x16-40",
    elo,
    fastest,
  };
}

/** Client-side strict parsing and stripping of unexpected API properties. */
export function parsePublicStandings(value: unknown): PublicStandings {
  if (
    !isRow(value) ||
    value.source !== "server-verified" ||
    (value.ratingSystem !== PUBLIC_RATING_SYSTEM &&
      value.ratingSystem !== PUBLIC_RATING_SYSTEM_V4) ||
    value.board !== "intermediate-16x16-40" ||
    !Array.isArray(value.elo) ||
    !Array.isArray(value.fastest)
  ) {
    throw new TypeError("Invalid public leaderboard response.");
  }
  const eloRows = value.elo.map((entry: unknown, index: number) => {
    if (!isRow(entry) || entry.rank !== index + 1) {
      throw new TypeError("Invalid public leaderboard rank.");
    }
    return {
      username: entry.username,
      rating: entry.rating,
      games: entry.games,
      wins: entry.wins,
      losses: entry.losses,
    };
  });
  const speedRows = value.fastest.map((entry: unknown, index: number) => {
    if (!isRow(entry) || entry.rank !== index + 1) {
      throw new TypeError("Invalid public leaderboard rank.");
    }
    return {
      username: entry.username,
      duration_ms: entry.durationMs,
      finished_at: entry.finishedAt,
    };
  });
  return projectPublicStandings(eloRows, speedRows, value.ratingSystem);
}
