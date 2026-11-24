import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  combineRecentStats,
  showRecentCount,
  showRecentWinRate,
  summarizeRecentOutcomes,
} from "../lib/profile/player-dashboard.ts";

const practice = readFileSync("components/profile/practice-profile.tsx", "utf8");
const ranked = readFileSync("components/profile/ranked-history.tsx", "utf8");
const navbar = readFileSync("components/play/navbar.tsx", "utf8");
const navBadge = readFileSync("components/play/nav-player-level.tsx", "utf8");
const modeCard = readFileSync("components/profile/player-mode-card.tsx", "utf8");
const globalStyles = readFileSync("app/globals.css", "utf8");
const dashboardStyles = readFileSync("styles/player-dashboard.css", "utf8");

test("both modes calculate wins, losses, and percentages without counting active games", () => {
  assert.deepEqual(summarizeRecentOutcomes(["win", "loss", "win"]), {
    games: 3,
    wins: 2,
    losses: 1,
    winRate: (2 / 3) * 100,
  });
  assert.deepEqual(summarizeRecentOutcomes(["won", "lost", "lost"]), {
    games: 3,
    wins: 1,
    losses: 2,
    winRate: (1 / 3) * 100,
  });
  assert.throws(() => summarizeRecentOutcomes(["active"]), /Unsupported match outcome/);
});

test("combined statistics reflect both known record sets", () => {
  const practice = summarizeRecentOutcomes(["win", "loss", "win"]);
  const ranked = summarizeRecentOutcomes(["won", "lost"]);
  assert.deepEqual(combineRecentStats(practice, ranked), {
    games: 5,
    wins: 3,
    losses: 2,
    winRate: 60,
  });
});

test("missing or failed mode history must not turn into a misleading zero", () => {
  const empty = summarizeRecentOutcomes([]);
  assert.deepEqual(empty, { games: 0, wins: 0, losses: 0, winRate: null });
  assert.equal(combineRecentStats(empty, null), null);
  assert.equal(combineRecentStats(null, empty), null);
  assert.deepEqual(combineRecentStats(empty, empty), empty);
  assert.equal(showRecentCount(null), "—");
  assert.equal(showRecentWinRate(null), "—");
  assert.equal(showRecentWinRate(100 / 3), "33.3%");
  assert.equal(showRecentWinRate(0), "0.0%");
});

test("the profile overview is above both mode cards and the two existing history sections", () => {
  assert.match(practice, /Player Dashboard/);
  assert.match(practice, /combineRecentStats\(practiceStats, rankedStats\)/);
  assert.match(practice, /<PlayerModeCard mode="ranked" stats=\{rankedStats\}/);
  assert.match(practice, /<PlayerModeCard mode="practice" stats=\{practiceStats\}/);
  assert.match(practice, /<RankedHistory onRecentMatches=\{setRankedMatches\}/);
  assert.ok(
    practice.indexOf("player-dashboard-overview") < practice.indexOf("<PlayerModeCard"),
  );
  assert.ok(
    practice.indexOf("<PlayerModeCard") <
      practice.indexOf("<RankedHistory onRecentMatches"),
  );
  assert.ok(
    practice.indexOf("<RankedHistory onRecentMatches") <
      practice.indexOf("practice-session-card"),
  );
  assert.doesNotMatch(practice, /<ProfileLevelCard/);
  assert.match(practice, /Recent Practice Matches/);
  assert.match(practice, /Recent completed Practice games/);
  assert.match(practice, /not lifetime statistics/);
});

test("the Ranked fetch shares its actual state without an extra API request", () => {
  assert.match(
    ranked,
    /onRecentMatches\?\.\(state\.kind === "ready" \? state\.matches : null\)/,
  );
  assert.match(ranked, /\}, \[state, onRecentMatches\]\)/);
  assert.match(ranked, /fetch\("\/api\/ranked\/history"/);
  assert.match(ranked, /rankedExpanded/);
});

test("both mode summary cards collapse independently and preserve history links", () => {
  assert.match(modeCard, /const \[expanded, setExpanded\] = useState\(true\)/);
  assert.match(modeCard, /aria-expanded=\{expanded\}/);
  assert.match(modeCard, /hidden=\{!expanded\}/);
  assert.match(modeCard, /#ranked-history-title/);
  assert.match(modeCard, /#practice-history-title/);
  assert.match(dashboardStyles, /\.player-mode-body\[hidden\]/);
});

test("the navbar displays only verified account level, not RP or fabricated totals", () => {
  assert.match(navbar, /NavPlayerLevel userId=\{user\.id\} pathname=\{pathname\}/);
  assert.match(navBadge, /loadPlayerLevel\(\)/);
  assert.match(navBadge, /result\.state !== "ready"/);
  assert.match(navBadge, /calculateLevelProgress\(result\.totalXp\)\.level/);
  assert.match(navBadge, /loaded\.userId !== userId/);
  assert.doesNotMatch(navBadge, /\.from\(|\.rpc\(|\.update\(|\.insert\(/);
  assert.match(globalStyles, /player-dashboard\.css/);
});

test("dashboard distinguishes incomplete recent histories and supports mobile + keyboard", () => {
  assert.match(practice, /games === null \|\| loadError/);
  assert.match(practice, /rankedMatches === null/);
  assert.match(
    practice,
    /latest ten completed Intermediate\s+matches|up to 10 completed Intermediate\s+matches/,
  );
  assert.match(dashboardStyles, /@media \(max-width: 510px\)/);
  assert.match(dashboardStyles, /focus-visible/);
  assert.match(dashboardStyles, /prefers-reduced-motion: reduce/);
});
