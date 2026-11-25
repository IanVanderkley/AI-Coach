import { isAllowedRequestOrigin, readBoundedJson } from "../http/request-security.ts";

// Security boundary for browser-facing Ranked game requests.
// This module deliberately has no dependency on Next.js or Supabase so it can
// be regression-tested without a database or credentials.

export const RANKED_MAX_MOVE_BODY_BYTES = 1_024;

type JsonResult = { ok: true; value: unknown } | { ok: false; response: Response };

function reject(message: string, status: number): Response {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/** Reject cross-site browser requests, even if they omit the Origin header. */
export function isAllowedRankedOrigin(request: Request): boolean {
  return isAllowedRequestOrigin(request);
}

function declaredBodyLength(request: Request): number | null | Response {
  const contentLength = request.headers.get("content-length");
  if (contentLength === null) return null;
  if (!/^\d+$/.test(contentLength) || !Number.isSafeInteger(Number(contentLength))) {
    return reject("Invalid Content-Length header.", 400);
  }
  return Number(contentLength);
}

/** A Ranked start request must contain zero body bytes. */
export async function validateRankedStartRequest(
  request: Request,
): Promise<Response | null> {
  if (!isAllowedRankedOrigin(request)) {
    return reject("Invalid request origin.", 403);
  }
  const declared = declaredBodyLength(request);
  if (declared instanceof Response) return declared;
  if (declared !== null && declared > 0) {
    return reject("Ranked match start does not accept a request body.", 400);
  }
  // Next.js may expose a stream even for a zero-byte POST.
  if (!request.body) return null;
  const reader = request.body.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return null;
      // Reject actual data, even if Content-Length incorrectly claims zero.
      if (value.byteLength > 0) {
        void reader.cancel().catch(() => undefined);
        return reject("Ranked match start does not accept a request body.", 400);
      }
    }
  } catch {
    return reject("Could not read the request body.", 400);
  } finally {
    reader.releaseLock();
  }
}

/**
 * Bound request parsing while reading, not after request.json(). This also
 * handles missing/incorrect Content-Length, invalid UTF-8, and malformed JSON.
 */
export async function readRankedMoveJson(request: Request): Promise<JsonResult> {
  return readBoundedJson(request, RANKED_MAX_MOVE_BODY_BYTES);
}
