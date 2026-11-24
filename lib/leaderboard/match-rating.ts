/** A read-only projection of a trusted private Elo event. No account identifiers. */
export type RankedMatchRating = {
  outcome: "won" | "lost";
  ratingBefore: number;
  ratingDelta: number;
  ratingAfter: number;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rating(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 100 &&
    value <= 10000
  );
}

export function parseRankedMatchRating(value: unknown): RankedMatchRating {
  if (!record(value)) throw new TypeError("Invalid Ranked rating receipt.");
  const outcome = value.outcome;
  const before = value.ratingBefore;
  const delta = value.ratingDelta;
  const after = value.ratingAfter;
  if (
    (outcome !== "won" && outcome !== "lost") ||
    !rating(before) ||
    !rating(after) ||
    typeof delta !== "number" ||
    !Number.isSafeInteger(delta) ||
    Math.abs(delta) > 32 ||
    before + delta !== after ||
    (outcome === "won" && delta < 0) ||
    (outcome === "lost" && delta > 0)
  ) {
    throw new TypeError("Invalid Ranked rating receipt.");
  }
  return { outcome, ratingBefore: before, ratingDelta: delta, ratingAfter: after };
}

export function formatRatingDelta(delta: number): string {
  if (!Number.isSafeInteger(delta) || Math.abs(delta) > 32) {
    throw new RangeError("Invalid rating change.");
  }
  return delta > 0 ? `+${delta}` : String(delta);
}
