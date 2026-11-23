import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RANKED_MAX_MOVE_BODY_BYTES,
  isAllowedRankedOrigin,
  readRankedMoveJson,
  validateRankedStartRequest,
} from "../lib/ranked/http-security.ts";

const URL = "https://example.test/api/ranked/matches/reveal";
const validMove = {
  matchId: "12345678-1234-1234-1234-123456789abc",
  row: 2,
  column: 3,
};
function request(body, headers = {}) {
  return new Request(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://example.test",
      ...headers,
    },
    body,
  });
}

async function rejected(result, expectedStatus) {
  assert.equal(result.ok, false);
  assert.equal(result.response.status, expectedStatus);
  assert.equal(result.response.headers.get("Cache-Control"), "no-store");
  assert.equal(typeof (await result.response.json()).error, "string");
}

test("accepts a small same-origin application/json move", async () => {
  const result = await readRankedMoveJson(request(JSON.stringify(validMove)));
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, validMove);
});

test("rejects different Origin and cross-site Fetch Metadata before parsing", async () => {
  assert.equal(
    isAllowedRankedOrigin(request("{}", { Origin: "https://evil.test" })),
    false,
  );
  await rejected(
    await readRankedMoveJson(request("{}", { Origin: "https://evil.test" })),
    403,
  );
  await rejected(
    await readRankedMoveJson(
      request("{}", { Origin: "", "Sec-Fetch-Site": "cross-site" }),
    ),
    403,
  );
  assert.equal(isAllowedRankedOrigin(request("{}", { Origin: "null" })), false);
});

test("requires JSON content type", async () => {
  await rejected(
    await readRankedMoveJson(request("{}", { "Content-Type": "text/plain" })),
    415,
  );
  await rejected(await readRankedMoveJson(request("{}", { "Content-Type": "" })), 415);
  assert.equal(
    (
      await readRankedMoveJson(
        request("{}", { "Content-Type": "application/json; charset=utf-8" }),
      )
    ).ok,
    true,
  );
});

test("rejects an oversized declared payload before reading its stream", async () => {
  let pulls = 0;
  const body = new ReadableStream(
    {
      pull() {
        pulls += 1;
      },
    },
    { highWaterMark: 0 },
  );
  const result = await readRankedMoveJson(
    new Request(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://example.test",
        "Content-Length": String(RANKED_MAX_MOVE_BODY_BYTES + 1),
      },
      body,
      duplex: "half",
    }),
  );
  await rejected(result, 413);
  assert.equal(pulls, 0);
});

test("rejects an oversized streaming payload without trusting Content-Length", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(RANKED_MAX_MOVE_BODY_BYTES + 10));
    },
    cancel() {
      cancelled = true;
    },
  });
  const result = await readRankedMoveJson(
    new Request(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://example.test" },
      body,
      duplex: "half",
    }),
  );
  await rejected(result, 413);
  assert.equal(cancelled, true);
});

test("rejects malformed Content-Length, invalid JSON, and invalid UTF-8", async () => {
  await rejected(
    await readRankedMoveJson(request("{}", { "Content-Length": "not-a-number" })),
    400,
  );
  await rejected(await readRankedMoveJson(request("{")), 400);
  await rejected(await readRankedMoveJson(request(new Uint8Array([0xff, 0xfe]))), 400);
});

test("accepts bodyless Ranked start and rejects supplied bodies", async () => {
  const valid = new Request("https://example.test/api/ranked/matches", {
    method: "POST",
    headers: { Origin: "https://example.test" },
  });
  assert.equal(validateRankedStartRequest(valid), null);

  const extra = new Request("https://example.test/api/ranked/matches", {
    method: "POST",
    headers: { Origin: "https://example.test" },
    body: "unexpected",
  });
  assert.equal(validateRankedStartRequest(extra)?.status, 400);

  const cross = new Request("https://example.test/api/ranked/matches", {
    method: "POST",
    headers: { Origin: "https://evil.test" },
  });
  assert.equal(validateRankedStartRequest(cross)?.status, 403);
});
