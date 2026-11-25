import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const file = (path) => readFileSync(path, "utf8");
const rankedPage = file("app/profile/ranked/page.tsx");
const practicePage = file("app/profile/practice/page.tsx");
const ranked = file("components/profile/ranked-stats-page.tsx");
const practice = file("components/profile/practice-stats-page.tsx");
const modeCard = file("components/profile/player-mode-card.tsx");
const navbar = file("components/play/navbar.tsx");
const xp = file("components/play/match-xp-bar.tsx");
const result = file("components/play/practice-result-dialog.tsx");
const css = file("styles/profile-detail-pages.css");
const xpCss = file("styles/result-xp-compact.css");
const globals = file("app/globals.css");

const has = (source, pattern, message) => assert.ok(pattern.test(source), message);

test("both statistics pages are real routes with navigation and page metadata", () => {
  has(rankedPage, /<Navbar \/>/, "Ranked navbar missing");
  has(practicePage, /<Navbar \/>/, "Practice navbar missing");
  has(rankedPage, /<RankedStatsPage \/>/, "Ranked page missing");
  has(practicePage, /<PracticeStatsPage \/>/, "Practice page missing");
  has(rankedPage, /Ranked Statistics \| AI-Coach/, "Ranked title missing");
  has(practicePage, /Practice Statistics \| AI-Coach/, "Practice title missing");
});

test("dashboard cards link to statistics and Coaching match history", () => {
  has(modeCard, /\/profile\/ranked/, "missing Ranked detail link");
  has(modeCard, /\/profile\/practice/, "missing Practice detail link");
  has(modeCard, /href=\{historyHref\}/, "Coaching history link missing");
  has(modeCard, /\/coaching#coach-history-title/, "Practice coaching history missing");
  has(modeCard, /\/coaching#ranked-history-title/, "Ranked history link missing");
  has(modeCard, /Full \{label\} statistics/, "full statistics link missing");
  has(
    navbar,
    /pathname\.startsWith\("\/profile\/"\)/,
    "nested Profile navigation not highlighted",
  );
});

test("Ranked details verify owner-scoped server lifetime response, no client-supplied rank", () => {
  has(
    ranked,
    /fetch\("\/api\/profile\/ranked-lifetime"/,
    "must reuse existing verified endpoint",
  );
  has(
    ranked,
    /parseRankedLifetimeResponse\(payload\)/,
    "lifetime response must be parsed",
  );
  has(ranked, /response\.status === 401/, "signed-out state must be explicit");
  assert.doesNotMatch(ranked, /<RankedHistory/);
  has(ranked, /\/coaching#ranked-history-title/, "Ranked history belongs in Coaching");
  has(ranked, /Intermediate/, "only supported ladder is Intermediate");
  assert.ok(!/\.update\(|\.insert\(|\.upsert\(|\+\d+ XP|\+\d+ RP/.test(ranked));
});

test("Practice details use existing owner-scoped tracked totals and retained games", () => {
  has(practice, /loadPracticeAccountTracking\(\)/, "private tracked source missing");
  has(practice, /repository\.listRecent\(\)/, "saved history missing");
  has(
    practice,
    /tracked\?\.overall \?\? savedSummary/,
    "scoped summary fallback missing",
  );
  has(
    practice,
    /tracked\?\.breakdown \?\? savedBreakdown/,
    "difficulty fallback missing",
  );
  has(practice, /<PracticeDifficultyStats/, "difficulty breakdown missing");
  assert.ok(!/\.update\(|\.insert\(|\.upsert\(/.test(practice));
});

test("Practice details show aggregate statistics while Coaching owns game review", () => {
  assert.doesNotMatch(practice, /profile-detail-match-list|practice-detail-filter/);
  has(practice, /\/coaching#coach-history-title/, "Coaching handoff missing");
  const coaching = file("components/coach/coach-console.tsx");
  has(coaching, /Recent Practice Matches/, "Practice history missing in Coaching");
  has(coaching, /openGame\(game.id\)/, "Practice review handoff missing");
});

test("Practice result includes a compact, read-only level progress component", () => {
  has(result, /<MatchXpBar/, "Practice result bar not mounted");
  has(xp, /loadPlayerLevel\(\)/, "saved account XP not fetched");
  has(
    xp,
    /calculateLevelProgress\(lookup\.totalXp\)/,
    "level is not derived from verified XP",
  );
  has(xp, /role="progressbar"/, "accessible progress missing");
  has(xp, /aria-valuenow=\{state\.progress\.xpIntoLevel\}/, "progress value missing");
  assert.ok(!/\.rpc\(|\.insert\(|\.update\(|\.upsert\(|awardXp|awardXP/.test(xp));
});

test("Practice result never claims an XP reward that the server does not grant", () => {
  has(xp, /Practice currently grants no verified account XP/, "no-award notice missing");
  has(xp, /kind: "guest"/, "guest state missing");
  has(xp, /kind: "error"/, "unavailable state missing");
  assert.ok(!/\+125 XP|\+10 XP|\+\d+ XP/.test(xp));
});

test("existing Ranked receipt and saved XP progress stay intact", () => {
  const dialog = file("components/ranked/ranked-result-dialog.tsx");
  has(dialog, /<RankedMatchXpReceipt/, "verified reward receipt was removed");
  has(dialog, /<RankedXpProgress/, "saved Ranked level progress was removed");
  has(xpCss, /\.ranked-result-dialog \.ranked-xp-panel/, "Ranked compact styles missing");
});

test("responsive detail pages and XP bar respect accessibility and reduced motion", () => {
  has(css, /@media \(max-width: 680px\)/, "detail mobile layout missing");
  has(css, /focus-visible/, "keyboard focus missing");
  has(xpCss, /prefers-reduced-motion: reduce/, "motion preference missing");
  has(globals, /profile-detail-pages\.css/, "detail stylesheet not loaded");
  has(globals, /result-xp-compact\.css/, "XP stylesheet not loaded");
});
