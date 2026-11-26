import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedRequestOrigin } from "../lib/http/request-security.ts";

function withDatabase(url, run) {
  const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
  }
}
const local = "http://127.0.0.1:54321";
const normalized = "http://localhost:3000/api/ranked/matches";
function request(origin, host, site, url = normalized, forwardedHost) {
  const headers = new Headers();
  if (origin !== undefined) headers.set("Origin", origin);
  if (host !== undefined) headers.set("Host", host);
  if (site !== undefined) headers.set("Sec-Fetch-Site", site);
  if (forwardedHost !== undefined) headers.set("X-Forwarded-Host", forwardedHost);
  return new Request(url, { method: "POST", headers });
}

test("local normalized URL accepts the exact browser loopback host", () => {
  withDatabase(local, () => {
    for (const host of ["127.0.0.1:3000", "localhost:3000"]) {
      assert.equal(
        isAllowedRequestOrigin(request(`http://${host}`, host, "same-origin"), true),
        true,
      );
    }
  });
});

test("local loopback hosts are not interchangeable origins", () => {
  withDatabase(local, () => {
    for (const [origin, host] of [
      ["http://localhost:3000", "127.0.0.1:3000"],
      ["http://127.0.0.1:3000", "localhost:3000"],
      ["http://127.0.0.1:3001", "127.0.0.1:3000"],
      ["https://127.0.0.1:3000", "127.0.0.1:3000"],
      ["http://127.0.0.1:3000/path", "127.0.0.1:3000"],
      ["null", "127.0.0.1:3000"],
    ])
      assert.equal(isAllowedRequestOrigin(request(origin, host)), false);
  });
});

test("local origin repair rejects cross-site metadata and unexpected hosts", () => {
  withDatabase(local, () => {
    for (const site of ["cross-site", "same-site"]) {
      assert.equal(
        isAllowedRequestOrigin(request("http://127.0.0.1:3000", "127.0.0.1:3000", site)),
        false,
      );
    }
    for (const host of [
      undefined,
      "evil.example:3000",
      "127.0.0.1:3001",
      "127.0.0.1:3000, evil.example",
    ]) {
      assert.equal(
        isAllowedRequestOrigin(
          request(
            "http://127.0.0.1:3000",
            host,
            "same-origin",
            normalized,
            "127.0.0.1:3000",
          ),
        ),
        false,
      );
    }
  });
});

test("hosted origin checks remain exact and ignore forwarded host headers", () => {
  withDatabase("https://example.supabase.co", () => {
    assert.equal(
      isAllowedRequestOrigin(request("http://127.0.0.1:3000", "127.0.0.1:3000")),
      false,
    );
    const hosted = "https://mindsweepercoach.com/api/ranked/matches";
    assert.equal(
      isAllowedRequestOrigin(
        request(
          "https://mindsweepercoach.com",
          "mindsweepercoach.com",
          "same-origin",
          hosted,
        ),
      ),
      true,
    );
    assert.equal(
      isAllowedRequestOrigin(
        request(
          "https://evil.example",
          "evil.example",
          "same-origin",
          hosted,
          "evil.example",
        ),
      ),
      false,
    );
  });
  withDatabase(local, () => {
    assert.equal(
      isAllowedRequestOrigin(
        request(
          "http://127.0.0.1:3000",
          "127.0.0.1:3000",
          "same-origin",
          "https://mindsweepercoach.com/api/ranked/matches",
        ),
      ),
      false,
    );
  });
});

test("missing-origin behavior remains unchanged for non-browser probes and strict routes", () => {
  withDatabase(local, () => {
    const absent = request(undefined, "127.0.0.1:3000");
    assert.equal(isAllowedRequestOrigin(absent), true);
    assert.equal(isAllowedRequestOrigin(absent, true), false);
    assert.equal(
      isAllowedRequestOrigin(request(undefined, "127.0.0.1:3000", "cross-site")),
      false,
    );
  });
});
