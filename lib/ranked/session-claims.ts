// Only call with claims returned by successful cryptographic verification via getClaims().
// This checks shape and expiry; it does not verify the token signature itself.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readVerifiedRankedSessionId(
  claims: unknown,
  nowMs = Date.now(),
): string | undefined {
  if (!claims || typeof claims !== "object" || Array.isArray(claims)) return undefined;
  const c = claims as Record<string, unknown>;
  if (
    c.role !== "authenticated" ||
    typeof c.sub !== "string" ||
    !uuid.test(c.sub) ||
    typeof c.session_id !== "string" ||
    !uuid.test(c.session_id) ||
    typeof c.exp !== "number" ||
    !Number.isFinite(c.exp) ||
    c.exp <= nowMs / 1000
  )
    return undefined;
  return c.session_id;
}
