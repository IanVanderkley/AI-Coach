export type RankedRateScope = "start" | "move" | "read";

/** Null means admitted. An unavailable or unexpected quota response fails closed. */
export async function checkRankedRateLimit(
  reserve: () => Promise<unknown>,
): Promise<Response | null> {
  let result: unknown;
  try {
    result = await reserve();
  } catch {
    result = null;
  }
  if (result === true) return null;
  const limited = result === false;
  return Response.json(
    {
      error: limited
        ? "Too many Ranked requests. Please try again shortly."
        : "Ranked service is temporarily unavailable.",
    },
    {
      status: limited ? 429 : 503,
      headers: {
        "Cache-Control": "private, no-store",
        "Retry-After": limited ? "60" : "5",
      },
    },
  );
}
