/** Browser-local Practice times are personal milestones, never verified Ranked results. */
export type PracticeBoardSize = {
  rows: number;
  columns: number;
  mines: number;
};

export type PracticeBestUpdate = {
  kind: "first" | "improved" | "existing" | "unavailable";
  bestSeconds: number | null;
  previousSeconds: number | null;
};

type BestTimeStorage = Pick<Storage, "getItem" | "setItem">;

export function practiceBestKey({ rows, columns, mines }: PracticeBoardSize): string {
  if (
    !Number.isSafeInteger(rows) ||
    !Number.isSafeInteger(columns) ||
    !Number.isSafeInteger(mines) ||
    rows < 2 ||
    columns < 2 ||
    mines < 1 ||
    mines >= rows * columns
  ) {
    throw new RangeError("Invalid Practice board dimensions.");
  }
  return `mindsweeper.practice.bestTime.v1.${rows}x${columns}.${mines}`;
}

function parseSavedTime(value: string | null): number | null {
  if (value === null || !/^(0|[1-9][0-9]*)$/.test(value)) return null;
  const seconds = Number(value);
  return Number.isSafeInteger(seconds) ? seconds : null;
}

/** Only call this after a completed Practice win. Returns a result only if the save succeeds. */
export function recordPracticeBest(
  storage: BestTimeStorage | null,
  board: PracticeBoardSize,
  durationSeconds: number,
): PracticeBestUpdate {
  if (!Number.isSafeInteger(durationSeconds) || durationSeconds < 0) {
    throw new RangeError("Practice time must be a nonnegative whole number.");
  }

  const unavailable: PracticeBestUpdate = {
    kind: "unavailable",
    bestSeconds: null,
    previousSeconds: null,
  };
  const key = practiceBestKey(board);
  if (!storage) return unavailable;

  try {
    const previousSeconds = parseSavedTime(storage.getItem(key));
    if (previousSeconds !== null && durationSeconds >= previousSeconds) {
      return { kind: "existing", bestSeconds: previousSeconds, previousSeconds };
    }
    storage.setItem(key, String(durationSeconds));
    return {
      kind: previousSeconds === null ? "first" : "improved",
      bestSeconds: durationSeconds,
      previousSeconds,
    };
  } catch {
    // Storage can be blocked in private browsing or by privacy settings.
    return unavailable;
  }
}
