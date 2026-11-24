import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ratingTier, ratingTierClass } from "../lib/leaderboard/rating-tier.ts";
import {
  parseRankedMatchRating,
  formatRatingDelta,
} from "../lib/leaderboard/match-rating.ts";

const read = (p) => readFileSync(p, "utf8");
const receipt = {
  outcome: "won",
  ratingBefore: 1000,
  ratingDelta: 16,
  ratingAfter: 1016,
};

test("rating milestones are explicit, bounded, and cosmetic", () => {
  for (const [n, expected] of [
    [100, "Bronze"],
    [899, "Bronze"],
    [900, "Silver"],
    [1099, "Silver"],
    [1100, "Gold"],
    [1299, "Gold"],
    [1300, "Platinum"],
    [1499, "Platinum"],
    [1500, "Diamond"],
    [10000, "Diamond"],
  ]) {
    assert.equal(ratingTier(n), expected);
  }
  assert.equal(ratingTierClass("Gold"), "rating-tier-gold");
  for (const n of [0, -1, 10001, 100.5, NaN, Infinity])
    assert.throws(() => ratingTier(n));
});

test("only consistent, signed rating receipts are accepted", () => {
  assert.deepEqual(
    parseRankedMatchRating({ ...receipt, user_id: "private", email: "not-for-client" }),
    receipt,
  );
  assert.deepEqual(
    parseRankedMatchRating({
      outcome: "lost",
      ratingBefore: 1000,
      ratingDelta: -16,
      ratingAfter: 984,
    }),
    { outcome: "lost", ratingBefore: 1000, ratingDelta: -16, ratingAfter: 984 },
  );
  for (const bad of [
    null,
    {},
    { ...receipt, ratingAfter: 1017 },
    { ...receipt, ratingBefore: -1 },
    { ...receipt, ratingDelta: 100 },
    { ...receipt, ratingDelta: 15.5 },
    { ...receipt, ratingDelta: -16, ratingAfter: 984 },
    { ...receipt, outcome: "lost" },
    { ...receipt, ratingAfter: "1016" },
  ])
    assert.throws(() => parseRankedMatchRating(bad));
  assert.equal(formatRatingDelta(16), "+16");
  assert.equal(formatRatingDelta(-16), "-16");
  assert.equal(formatRatingDelta(0), "0");
  assert.throws(() => formatRatingDelta(300));
});

test("owner-only match rating endpoint verifies auth AND ownership and never mutates", () => {
  const route = read("app/api/leaderboard/match-rating/route.ts");
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /\.eq\("user_id", user\.id\)/);
  assert.match(route, /\.eq\("match_id", matchIds\[0\]\)/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.match(route, /parseRankedMatchRating/);
  assert.doesNotMatch(
    route,
    /export async function POST|\.insert\(|\.update\(|request\.json\(/,
  );
});

test("result dialog includes real match rating, preserves verified XP, and never estimates RP", () => {
  const dialog = read("components/ranked/ranked-result-dialog.tsx");
  const cmp = read("components/ranked/ranked-match-rating.tsx");
  assert.match(dialog, /<RankedMatchRating/);
  assert.match(dialog, /<RankedMatchXpReceipt/);
  assert.match(dialog, /<RankedXpProgress/);
  assert.match(cmp, /parseRankedMatchRating/);
  assert.match(cmp, /value\.outcome === expectedOutcome/);
  assert.match(cmp, /ratingBefore/);
  assert.match(cmp, /ratingDelta/);
  assert.match(cmp, /ratingAfter/);
  assert.match(cmp, /state\.kind === "missing"/);
  assert.match(cmp, /not competitive RP/);
  assert.doesNotMatch(dialog, /\+\d+ RP/);
});

test("both boards contain player names and rank numbers plus cosmetic milestones", () => {
  const board = read("components/leaderboard/verified-leaderboard.tsx");
  const page = read("app/leaderboard/page.tsx");
  assert.match(board, /Elo-style rating/);
  assert.match(board, /Fastest Wins/);
  assert.match(board, /entry\.username/);
  assert.match(board, /ratingTier\(entry\.rating\)/);
  assert.match(board, /#\{entry\.rank\}/);
  assert.match(board, /<Medal/);
  assert.match(page, /appear\s*publicly by default/);
});

test("new accounts default public in SQL but existing saved privacy is untouched", () => {
  const sql = read("docs/LEADERBOARD-PUBLIC-DEFAULT.sql");
  assert.match(
    sql,
    /ALTER TABLE public\.ranked_leaderboard_profiles[\s\S]*SET DEFAULT false/i,
  );
  assert.match(sql, /BEFORE INSERT ON public\.ranked_leaderboard_profiles/);
  assert.match(sql, /new\.is_anonymous = false AND new\.username IS NULL/);
  assert.match(sql, /raw_user_meta_data ->> 'username'/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /REVOKE ALL ON FUNCTION ranked_internal\.choose_default_public_name/);
  assert.doesNotMatch(
    sql,
    /UPDATE\s+public\.ranked_leaderboard_profiles\s+SET\s+is_anonymous/i,
  );
  const api = read("app/api/leaderboard/preferences/route.ts");
  const privacy = read("components/leaderboard/leaderboard-privacy.tsx");
  assert.match(api, /data\?\.is_anonymous \?\? false/);
  assert.match(privacy, /useState\(false\)/);
  assert.match(privacy, /checked=\{isAnonymous\}/);
  assert.match(privacy, /method: "PUT"/);
});

test("new SQL does not change trusted rating functions, RLS or XP tables", () => {
  const sql = read("docs/LEADERBOARD-PUBLIC-DEFAULT.sql");
  assert.doesNotMatch(
    sql,
    /player_xp_profiles|player_xp_ledger|ranked_elo_events\s+set|DROP TABLE/i,
  );
  assert.match(sql, /Existing rows/i); // preserve saved privacy choices
  const publicRoute = read("app/api/leaderboard/route.ts");
  assert.match(publicRoute, /\.from\("ranked_public_elo"\)/);
  assert.match(publicRoute, /\.from\("ranked_public_fastest"\)/);
});

test("all panels share one width and settings visibility aligns with settings content", () => {
  const css = read("styles/leaderboard-polish.css");
  const global = read("app/globals.css");
  assert.match(css, /\.leaderboard-page > \.leaderboard-hero/);
  assert.match(css, /\.leaderboard-page > \.verified-board/);
  assert.match(css, /\.settings-page > \.leaderboard-privacy/);
  assert.match(css, /max-width: none/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(global, /leaderboard-polish\.css/);
  assert.match(global, /ranked-rating\.css/);
});

test("final readiness guide blocks unreviewed public production release", () => {
  const doc = read("docs/BATCH12-FINAL-REVIEW.md");
  assert.match(doc, /PRODUCTION RELEASE IS NOT APPROVED/);
  assert.match(doc, /bzjkmiwwrpcshumamkvq/);
  assert.match(doc, /db push --dry-run --remote/);
  assert.match(doc, /COACH_PAID_AI_ENABLED=false/);
  assert.match(doc, /npm run check/);
  assert.match(doc, /npm test/);
});
