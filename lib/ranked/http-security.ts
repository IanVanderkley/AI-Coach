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
  const origin = request.headers.get("origin");
  if (origin !== null) {
    try {
      return new URL(origin).origin === new URL(request.url).origin;
    } catch {
      return false;
    }
  }
  return request.headers.get("sec-fetch-site") !== "cross-site";
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
  if (!isAllowedRankedOrigin(request)) {
    return { ok: false, response: reject("Invalid request origin.", 403) };
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;|\s*$)/i.test(contentType)) {
    return { ok: false, response: reject("Send a JSON request body.", 415) };
  }

  const declared = declaredBodyLength(request);
  if (declared instanceof Response) return { ok: false, response: declared };
  if (declared !== null && declared > RANKED_MAX_MOVE_BODY_BYTES) {
    return { ok: false, response: reject("Request body is too large.", 413) };
  }
  if (!request.body) {
    return { ok: false, response: reject("A JSON request body is required.", 400) };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > RANKED_MAX_MOVE_BODY_BYTES) {
        void reader.cancel().catch(() => undefined);
        return { ok: false, response: reject("Request body is too large.", 413) };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, response: reject("Could not read the request body.", 400) };
  } finally {
    reader.releaseLock();
  }

  if (total === 0) {
    return { ok: false, response: reject("A JSON request body is required.", 400) };
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const value: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    return { ok: true, value };
  } catch {
    return {
      ok: false,
      response: reject("The request body must be valid UTF-8 JSON.", 400),
    };
  }
}
