// Shared HTTP boundary for browser-facing mutation requests.
export type JsonReadResult =
  | { ok: true; value: unknown }
  | { ok: false; response: Response };

function reject(error: string, status: number): JsonReadResult {
  return {
    ok: false,
    response: Response.json(
      { error },
      { status, headers: { "Cache-Control": "no-store" } },
    ),
  };
}

export function isAllowedRequestOrigin(request: Request, requireOrigin = false): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site" || site === "same-site") return false;
  const origin = request.headers.get("origin");
  if (origin === null) return !requireOrigin;
  const target = new URL(request.url);
  // Next can normalize the loopback request URL to localhost even when the
  // browser is using 127.0.0.1. Only the fixed local launcher/database pair
  // may use the exact incoming loopback Host to recover the browser origin.
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL === "http://127.0.0.1:54321" &&
    (target.origin === "http://localhost:3000" ||
      target.origin === "http://127.0.0.1:3000")
  ) {
    const host = request.headers.get("host");
    if (host !== "localhost:3000" && host !== "127.0.0.1:3000") return false;
    return origin === `http://${host}`;
  }
  // Hosted requests retain exact serialized origin comparison. Never use
  // forwarded host headers or accept sibling origins.
  return origin === target.origin;
}

export async function readBoundedJson(
  request: Request,
  maxBytes: number,
  requireOrigin = false,
): Promise<JsonReadResult> {
  if (!isAllowedRequestOrigin(request, requireOrigin))
    return reject("Invalid request origin.", 403);
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;|\s*$)/i.test(contentType))
    return reject("Send a JSON request body.", 415);
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    if (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared)))
      return reject("Invalid Content-Length header.", 400);
    if (Number(declared) > maxBytes) return reject("Request body is too large.", 413);
  }
  if (!request.body) return reject("A JSON request body is required.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        void reader.cancel().catch(() => undefined);
        return reject("Request body is too large.", 413);
      }
      chunks.push(value);
    }
  } catch {
    return reject("Could not read the request body.", 400);
  } finally {
    reader.releaseLock();
  }
  if (!total) return reject("A JSON request body is required.", 400);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return {
      ok: true,
      value: JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      ) as unknown,
    };
  } catch {
    return reject("The request body must be valid UTF-8 JSON.", 400);
  }
}
