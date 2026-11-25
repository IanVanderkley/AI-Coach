/** Translate the private RPC envelope into the existing public move API contract. */
export function combinedMoveResponse(data: unknown, failed: boolean): Response {
  const headers = { "Cache-Control": "private, no-store" };
  const unavailable = () =>
    Response.json(
      { error: "Ranked service is temporarily unavailable." },
      { status: 503, headers: { ...headers, "Retry-After": "5" } },
    );
  if (failed || !data || typeof data !== "object" || Array.isArray(data)) {
    return unavailable();
  }
  const envelope = data as Record<string, unknown>;
  switch (envelope.status) {
    case "ok":
      if (
        !envelope.result ||
        typeof envelope.result !== "object" ||
        Array.isArray(envelope.result)
      ) {
        return unavailable();
      }
      return Response.json(envelope.result, { status: 200, headers });
    case "unauthorized":
      return Response.json(
        { error: "You must sign in to play Ranked." },
        { status: 401, headers },
      );
    case "rate_limited":
      return Response.json(
        { error: "Too many Ranked requests. Please try again shortly." },
        { status: 429, headers: { ...headers, "Retry-After": "60" } },
      );
    case "conflict":
      return Response.json(
        { error: "The Ranked board changed. Reloading the current match." },
        { status: 409, headers },
      );
    case "rejected":
      return Response.json(
        { error: "This move cannot be completed." },
        { status: 409, headers },
      );
    default:
      return unavailable();
  }
}
