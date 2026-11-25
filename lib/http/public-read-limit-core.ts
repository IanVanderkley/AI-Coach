/** Database-backed admission for public leaderboard reads. */
export type PublicReadScope = "leaderboard" | "verified_results";

export async function checkPublicReadLimit(
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
        ? "Too many leaderboard requests. Please try again shortly."
        : "Leaderboard temporarily unavailable.",
    },
    {
      status: limited ? 429 : 503,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": limited ? "60" : "5",
      },
    },
  );
}
