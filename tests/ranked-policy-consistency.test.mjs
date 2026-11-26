import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  PUBLIC_RATING_SYSTEM,
  projectPublicStandings,
  parsePublicStandings,
} from "../lib/leaderboard/public-standings.ts";
import { parseRankedMatchRating } from "../lib/leaderboard/match-rating.ts";

const read = (path) => readFileSync(path, "utf8");
test("public standings use the v2 contract and preserve saved balances and strict parsing", () => {
  const payload = projectPublicStandings(
    [{ username: "OldPlayer", rating: 914, games: 5, wins: 0, losses: 5 }],
    [],
  );
  assert.equal(PUBLIC_RATING_SYSTEM, "solo-elo-benchmark-v2");
  assert.equal(payload.ratingSystem, PUBLIC_RATING_SYSTEM);
  assert.equal(payload.elo[0].rating, 914);
  assert.deepEqual(parsePublicStandings(payload), payload);
  for (const ratingSystem of ["solo-elo-benchmark-v1", "unknown", null])
    assert.throws(() => parsePublicStandings({ ...payload, ratingSystem }));
});
test("legacy cosmetic tiers are retired but historical v1 receipt parsing remains", () => {
  assert.equal(existsSync("lib/leaderboard/rating-tier.ts"), false);
  assert.doesNotMatch(read("styles/leaderboard-polish.css"), /\.rating-tier(?:\s|[-{])/);
  const receipt = {
    policyVersion: 1,
    outcome: "lost",
    ratingBefore: 1000,
    ratingDelta: -16,
    ratingAfter: 984,
  };
  assert.deepEqual(parseRankedMatchRating(receipt), receipt);
  const current = {
    policyVersion: 2,
    outcome: "won",
    ratingBefore: 1600,
    ratingDelta: 48,
    ratingAfter: 1648,
  };
  assert.deepEqual(parseRankedMatchRating(current), current);
  assert.throws(() =>
    parseRankedMatchRating({ ...current, ratingDelta: 49, ratingAfter: 1649 }),
  );
});
test("profile and settings use Elo terminology without changing privacy or XP", () => {
  assert.match(
    read("components/profile/player-mode-card.tsx"),
    /Ranked Elo is separate from account XP/,
  );
  assert.doesNotMatch(
    read("components/profile/player-mode-card.tsx"),
    /Competitive RP|Ranked RP/,
  );
  assert.match(
    read("components/leaderboard/leaderboard-privacy.tsx"),
    /Your saved Ranked Elo/,
  );
  const route = read("app/api/leaderboard/route.ts");
  assert.match(route, /\.from\("ranked_public_elo"\)/);
  assert.match(route, /\.from\("ranked_public_fastest"\)/);
  assert.match(route, /projectPublicStandings/);
});
