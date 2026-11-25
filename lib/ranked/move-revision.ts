// PostgreSQL's move_count is a nonnegative signed integer.
export function isRankedMoveRevision(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 2_147_483_647
  );
}
