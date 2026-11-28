import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  summarizeRankedLifetime,
  parseRankedLifetimeResponse,
} from "../lib/profile/ranked-lifetime.ts";
import { summarizePracticeDifficulties } from "../lib/profile/practice-difficulty.ts";

function contents(path) {
  return readFileSync(path, "utf8");
}
function contains(source, pattern, message) {
  assert.ok(pattern.test(source), message);
}

const api = contents("app/api/profile/ranked-lifetime/route.ts");
const profile = contents("components/profile/practice-profile.tsx");
const modeCard = contents("components/profile/player-mode-card.tsx");
const difficulty = contents("components/profile/practice-difficulty-stats.tsx");
const style = contents("styles/profile-difficulty-stats.css");
const globalStyles = contents("app/globals.css");

test("Ranked counts all verified wins plus server-owned losses, never recent-ten limits", () => {
  assert.deepEqual(summarizeRankedLifetime(19, 11, 7315), {
    games: 30,
    wins: 19,
    losses: 11,
    winRate: (19 / 30) * 100,
    fastestWinMs: 7315,
  });
  assert.deepEqual(summarizeRankedLifetime(0, 0, null), {
    games: 0,
    wins: 0,
    losses: 0,
    winRate: null,
    fastestWinMs: null,
  });
  assert.deepEqual(summarizeRankedLifetime(0, 4, null), {
    games: 4,
    wins: 0,
    losses: 4,
    winRate: 0,
    fastestWinMs: null,
  });
  assert.equal(summarizeRankedLifetime(1, 0, 0).fastestWinMs, 0);
});

test("Ranked stats reject failed/null counts, impossible rewards, or overflowing sums", () => {
  for (const bad of [null, undefined, -1, 3.2, "2", Infinity, NaN]) {
    assert.throws(() => summarizeRankedLifetime(bad, 0, null));
    assert.throws(() => summarizeRankedLifetime(0, bad, null));
  }
  assert.throws(() => summarizeRankedLifetime(0, 0, 9));
  assert.throws(() => summarizeRankedLifetime(1, 0, null));
  assert.throws(() => summarizeRankedLifetime(1, 0, -1));
  assert.throws(() => summarizeRankedLifetime(Number.MAX_SAFE_INTEGER, 1, 5));
});

test("response parser fails closed on wrong scope and inconsistent totals", () => {
  const stats = summarizeRankedLifetime(3, 2, 1500);
  assert.deepEqual(
    parseRankedLifetimeResponse({ scope: "verified-intermediate-lifetime", stats }),
    stats,
  );
  assert.throws(() => parseRankedLifetimeResponse({ scope: "practice", stats }));
  assert.throws(() =>
    parseRankedLifetimeResponse({
      scope: "verified-intermediate-lifetime",
      stats: { ...stats, games: 99 },
    }),
  );
  assert.throws(() =>
    parseRankedLifetimeResponse({
      scope: "verified-intermediate-lifetime",
      stats: { ...stats, winRate: 100 },
    }),
  );
});

test("Practice breakdown keeps independent difficulties and fastest recorded wins", () => {
  const rows = summarizePracticeDifficulties([
    { difficulty: "Beginner", outcome: "win", durationSeconds: 92 },
    { difficulty: "Beginner", outcome: "loss", durationSeconds: 3 },
    { difficulty: "Beginner", outcome: "win", durationSeconds: 50 },
    { difficulty: "Expert", outcome: "loss", durationSeconds: 150 },
  ]);
  assert.deepEqual(
    rows.map((row) => row.difficulty),
    ["Beginner", "Intermediate", "Expert"],
  );
  assert.deepEqual(rows[0], {
    difficulty: "Beginner",
    stats: { games: 3, wins: 2, losses: 1, winRate: (2 / 3) * 100 },
    fastestWinSeconds: 50,
  });
  assert.equal(rows[1].stats.games, 0);
  assert.equal(rows[1].stats.winRate, null);
  assert.equal(rows[1].fastestWinSeconds, null);
  assert.equal(rows[2].stats.winRate, 0);
  assert.equal(rows[2].fastestWinSeconds, null);
});

test("Practice breakdown never silently discards malformed or unknown records", () => {
  for (const game of [
    { difficulty: "Master", outcome: "win", durationSeconds: 1 },
    { difficulty: "Beginner", outcome: "won", durationSeconds: 1 },
    { difficulty: "Expert", outcome: "loss", durationSeconds: -1 },
    { difficulty: "Expert", outcome: "win", durationSeconds: 1.25 },
  ]) {
    assert.throws(() => summarizePracticeDifficulties([game]));
  }
});

test("Ranked endpoint uses verified identity and fixed Intermediate board filters", () => {
  contains(api, /export async function GET\(\)/, "expected a GET-only endpoint");
  contains(api, /auth\.getUser\(\)/, "must verify session on the server");
  assert.equal((api.match(/\.eq\("user_id", user\.id\)/g) ?? []).length, 3);
  assert.equal((api.match(/\.eq\("mine_count", 40\)/g) ?? []).length, 3);
  contains(api, /\.from\("ranked_verified_results"\)/, "win results must be verified");
  contains(api, /\.from\("ranked_matches"\)/, "losses must be server-owned");
  contains(api, /\.eq\("status", "lost"\)/, "abandoned and active matches do not count");
  contains(api, /count: "exact", head: true/, "all-time statistics need exact DB counts");
  assert.equal((api.match(/count: "exact"/g) ?? []).length, 2);
  contains(
    api,
    /"Cache-Control": "private, no-store"/,
    "private stats must not be cached",
  );
  assert.ok(
    !/req\.json\(|request\.json\(|userId\s*=\s*params|limit\(10\)/.test(api),
    "no client-supplied identity, scores or recent-result limits",
  );
});

test("dashboard preserves recent overall scope but uses Ranked lifetime in mode card", () => {
  contains(
    profile,
    /combineRecentStats\(practiceStats, rankedStats\)/,
    "overall still shows recent data",
  );
  contains(
    profile,
    /parseRankedLifetimeResponse\(payload\)/,
    "server payload validated before display",
  );
  contains(profile, /stats=\{rankedLifetime\}/, "Ranked mode uses actual lifetime stats");
  contains(profile, /scope="lifetime"/, "Ranked scope is visibly labelled");
  contains(
    profile,
    /breakdown=\{accountPracticeTracking\?\.breakdown \?\? practiceDifficulties\}/,
    "Practice breakdown uses saved history",
  );
  contains(
    modeCard,
    /SERVER-VERIFIED LIFETIME/,
    "distinguish server-verified lifetime records",
  );
  contains(
    contents("components/profile/ranked-stats-page.tsx"),
    /formatRankedDuration\(stats\.fastestWinMs\)/,
    "display fastest official win on the full Ranked statistics page",
  );
  contains(profile, /Recent records only/, "overall snapshot not mislabeled");
});

test("difficulty cards show every board size without claiming cloud lifetime or RP", () => {
  contains(difficulty, /"9 × 9 · 10 mines"/, "Beginner board supported");
  contains(difficulty, /"16 × 16 · 40 mines"/, "Intermediate board supported");
  contains(difficulty, /"16 × 30 · 99 mines"/, "Expert board supported");
  contains(difficulty, /scope === "recent"/, "Practice limitations explained");
  contains(globalStyles, /profile-difficulty-stats\.css/, "new styles loaded");
  contains(style, /@media \(max-width: 850px\)/, "mobile layout present");
});
