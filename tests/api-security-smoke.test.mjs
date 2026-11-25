import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cases,
  checkApiSecurity,
  localTarget,
  validShape,
} from "../scripts/check-api-security.mjs";

const standings = {
  source: "server-verified",
  ratingSystem: "solo-elo-benchmark-v1",
  board: "intermediate-16x16-40",
  elo: [],
  fastest: [],
};
const results = {
  mode: "ranked",
  source: "server-verified",
  boardSize: 16,
  mineCount: 40,
  timing: "server-wall-clock",
  results: [],
};
function mock(overrides = {}) {
  let i = 0;
  const requests = [];
  return {
    requests,
    fetcher: async (url, options) => {
      const item = cases[i++];
      requests.push({ url, options });
      const body =
        item.shape === "standings"
          ? standings
          : item.shape === "results"
            ? results
            : { error: "Rejected" };
      return Response.json(body, {
        status: overrides[item.name] ?? item.status,
        headers: { "Cache-Control": "private, no-store" },
      });
    },
  };
}
test("security smoke target cannot be remote or include credentials or paths", () => {
  assert.equal(localTarget(), "http://localhost:3000");
  for (const url of [
    "https://localhost:3000",
    "http://example.com:3000",
    "http://localhost:3000/",
    "http://localhost:3000@evil.invalid",
    "http://user:secret@localhost:3000",
  ])
    assert.throws(() => localTarget(url));
});
test("security smoke sends bounded anonymous requests without following redirects", async () => {
  const { fetcher, requests } = mock();
  const result = await checkApiSecurity({ fetcher });
  assert.equal(result.passed, cases.length);
  assert.equal(requests.length, cases.length);
  assert.ok(
    requests.every(
      ({ url, options }) =>
        url.startsWith("http://localhost:3000/") &&
        options.credentials === "omit" &&
        options.redirect === "manual" &&
        !Object.keys(options.headers).some((key) =>
          /^(authorization|cookie|apikey)$/i.test(key),
        ),
    ),
  );
});
test("security smoke detects unexpected authorization success and continues checking", async () => {
  const { fetcher } = mock({ "Anonymous match start": 200 });
  const result = await checkApiSecurity({ fetcher });
  assert.equal(result.passed, cases.length - 1);
  assert.match(result.failures[0], /expected HTTP 401, received 200/);
});
test("public response contract rejects internal identifiers and unexpected fields", () => {
  assert.equal(validShape(standings, "standings"), true);
  assert.equal(
    validShape({ ...standings, email: "private@example.invalid" }, "standings"),
    false,
  );
  assert.equal(
    validShape(
      {
        ...results,
        results: [
          { rank: 1, durationMs: 20, finishedAt: "2026-01-01", userId: "private" },
        ],
      },
      "results",
    ),
    false,
  );
});
test("security smoke fails responses missing no-store", async () => {
  const result = await checkApiSecurity({
    fetcher: async () => Response.json({ error: "Rejected" }, { status: 401 }),
  });
  assert.equal(result.passed, 0);
  assert.ok(result.failures.some((line) => line.includes("missing no-store")));
});
