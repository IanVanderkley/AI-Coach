import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { completedPracticeSeconds } from "../lib/practice/clock.ts";
import {
  firstRevealClock,
  recoveredRankedClock,
  rankedDisplaySeconds,
  formatDisplaySeconds,
} from "../lib/ranked/display-clock.ts";
import { summarizeRankedHar } from "../scripts/ranked-latency-report.mjs";

const read = (p) => readFileSync(p, "utf8");

test("Practice completion excludes delayed effects and handles a zero-time first move", () => {
  assert.equal(completedPracticeSeconds(1999, 3000), 1);
  assert.equal(completedPracticeSeconds(0, 6000), 0);
  assert.equal(completedPracticeSeconds(undefined, 2500), 2);
  assert.equal(completedPracticeSeconds(NaN, 1500), 1);
  assert.equal(completedPracticeSeconds(-1, -10), 0);
});

test("Ranked recovery includes time away using server dates, not the local wall clock", () => {
  const anchor = recoveredRankedClock(
    "2026-11-26T00:00:00Z",
    "Thu, 26 Nov 2026 02:00:00 GMT",
    200,
  );
  assert.deepEqual(anchor, { elapsedMs: 7200000, observedAtMs: 200 });
  assert.equal(rankedDisplaySeconds(anchor, 1200), 7201);
  assert.equal(formatDisplaySeconds(7201), "2:00:01");
  assert.equal(formatDisplaySeconds(65), "01:05");
  assert.equal(recoveredRankedClock(null, "Thu, 26 Nov 2026 02:00:00 GMT", 200), null);
  assert.equal(recoveredRankedClock("invalid", "invalid", 200), null);
  assert.equal(recoveredRankedClock("2026-11-26T00:00:00Z", null, 200), null);
});

test("first reveal midpoint clock advances monotonically without network requests", () => {
  const anchor = firstRevealClock(100, 300);
  assert.deepEqual(anchor, { elapsedMs: 100, observedAtMs: 300 });
  assert.equal(rankedDisplaySeconds(anchor, 200), 0);
  assert.equal(rankedDisplaySeconds(anchor, 1200), 1);
});

test("HUD is isolated from Ranked move logic and Practice terminal time uses the recorded move", () => {
  const page = read("app/ranked/page.tsx");
  const clock = read("components/ranked/ranked-clock.tsx");
  const practice = read("components/play/minesweeper-board.tsx");
  assert.match(page, /<RankedClock/);
  assert.match(page, /recoveredRankedClock\(\s*data\.startedAt/);
  assert.match(page, /firstRevealClock\(\s*requestStartedAtMs/);
  assert.match(clock, /Time \(est\.\)/);
  assert.match(clock, /Server time/);
  assert.doesNotMatch(clock, /fetch\(|localStorage|sessionStorage/);
  assert.match(practice, /completedPracticeSeconds\(/);
  assert.match(practice, /addEventListener\("pagehide", pauseAndPersist\)/);
  assert.match(practice, /removeEventListener\("pagehide", pauseAndPersist\)/);
});

test("the compact HUD and longer animations are loaded after earlier styles", () => {
  const layout = read("app/layout.tsx");
  const css = read("styles/batch24-gameplay.css");
  const ranked = read("app/ranked/ranked-layout.module.css");
  assert.ok(
    layout.indexOf('import "../styles/batch24-gameplay.css"') >
      layout.indexOf('import "../styles/practice-layout.css"'),
  );
  assert.match(css, /prefers-reduced-motion: no-preference/);
  assert.match(css, /batch24-blast 4200ms/);
  assert.match(css, /animation-duration: 3600ms/);
  assert.match(css, /minmax\(24px, 1fr\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(ranked, /minmax\(32px, 1fr\)/);
  assert.match(read("components/play/navbar.tsx"), /<span>MindSweeper<\/span>/);
});

test("HAR summary isolates successful moves, excludes unrelated origins and reports missing timings", () => {
  const entry = (url, status, time, headers = []) => ({
    request: { url, method: "POST" },
    response: { status, headers },
    time,
    timings: { wait: 100, receive: 5 },
  });
  const origin = "https://example.test";
  const url = `${origin}/api/ranked/matches/reveal`;
  const har = {
    log: {
      entries: [
        entry(url, 200, 200, [
          { name: "Server-Timing", value: "app;dur=140, auth;dur=4, db;dur=120" },
        ]),
        entry(url, 200, 300),
        entry(url, 409, 900),
        entry("https://other.test/api/ranked/matches/reveal", 200, 999),
      ],
    },
  };
  const [result] = summarizeRankedHar(har, origin);
  assert.equal(result.successes, 2);
  assert.equal(result.failures, 1);
  assert.deepEqual(result.milliseconds.total, { n: 2, mean: 250, p50: 250, p95: 300 });
  assert.equal(result.milliseconds.db.mean, 120);
  assert.equal(result.milliseconds.outsideApp.mean, 60);
  assert.equal(result.milliseconds.auth.n, 1);
  assert.deepEqual(summarizeRankedHar({ log: { entries: [] } }, origin), []);
});
