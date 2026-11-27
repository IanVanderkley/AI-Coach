import assert from "node:assert/strict";
import { test } from "node:test";
import { displayRank, rankDefinitionsForPolicy } from "../lib/leaderboard/rank-display.ts";
import { projectRankedLobbyRating, parseRankedLobbyRating, rankedLobbyModel } from "../lib/leaderboard/rank-lobby.ts";
import { rankEmblemModel } from "../lib/leaderboard/rank-emblem.ts";
import { rankResultModel } from "../lib/leaderboard/rank-result.ts";
import { parseRankedMatchRating } from "../lib/leaderboard/match-rating.ts";
import { calculateRankPolicyV4 } from "../lib/leaderboard/rank-policy-v4.ts";
import { projectPublicStandings, parsePublicStandings, PUBLIC_RATING_SYSTEM_V4 } from "../lib/leaderboard/public-standings.ts";

const lobby = (rating, highest = null) => rankedLobbyModel(parseRankedLobbyRating(projectRankedLobbyRating(rating, highest, null, 4)));
const receipt = (rating, outcome) => {
  const result = calculateRankPolicyV4(rating, outcome);
  return parseRankedMatchRating({ outcome, policyVersion: 4, ratingBefore: rating, ratingDelta: result.delta, ratingAfter: result.rating });
};
test("v4 rank projections and artwork agree at every milestone", () => {
  for (const tier of rankDefinitionsForPolicy(4)) {
    for (let i = 0; i < Math.max(1, tier.divisions); i++) {
      const rating = tier.min + i * 100;
      const rank = displayRank(rating, 4);
      const emblem = rankEmblemModel(rating, true, 4);
      assert.equal(rank.name, tier.name);
      assert.equal(emblem.label, rank.label);
      assert.equal(emblem.src, `/ranks/${tier.name.toLowerCase()}.webp`);
    }
  }
  assert.equal(displayRank(1500, 4).label, "Gold V");
  assert.equal(displayRank(1499, 4).label, "Silver I");
  assert.equal(displayRank(3300, 4).label, "Omniscient");
});
test("negative ratings are Copper V with real Elo debt and a clamped journey", () => {
  for (const rating of [-2147483648, -100, -1, 0]) {
    const model = lobby(rating, 1500);
    assert.equal(model.current.label, "Copper V");
    assert.equal(model.current.progress, 0);
    assert.equal(model.current.eloToPromotion, 100 - rating);
    assert.equal(model.journeyPercent, 0);
    assert.equal(model.highest.label, "Gold V");
    assert.equal(rankEmblemModel(rating, true, 4).label, "Copper V");
  }
});
test("lobby forecasts protected loss and demotion from saved rating only", () => {
  assert.equal(lobby(1505).loss, -5);
  assert.equal(lobby(1500).loss, -12);
  assert.equal(lobby(1500).win, 110);
  assert.equal(lobby(1500).nextRank, "Gold IV");
  assert.equal(lobby(10000).win, 0);
  assert.equal(lobby(3300).nextRank, null);
});
test("v4 receipt presentation distinguishes protection and actual demotion", () => {
  const protectedResult = rankResultModel(receipt(1505, "lost"));
  assert.equal(protectedResult.transition, "unchanged");
  assert.equal(protectedResult.demotionProtected, true);
  assert.equal(protectedResult.after.label, "Gold V");
  const demoted = rankResultModel(receipt(1500, "lost"));
  assert.equal(demoted.transition, "demotion");
  assert.equal(demoted.demotionProtected, false);
  assert.equal(demoted.after.label, "Silver I");
  assert.equal(rankResultModel(receipt(-5, "won")).transition, "promotion");
});
test("public v4 standings accept negative Elo without leaking extra properties", () => {
  const rows = [{ username: "Player1", rating: 1500, games: 4, wins: 1, losses: 3, userId: "private" },
    { username: "Player2", rating: -5, games: 10, wins: 0, losses: 10 }];
  const payload = projectPublicStandings(rows, [], PUBLIC_RATING_SYSTEM_V4);
  assert.equal(payload.elo[1].rating, -5);
  assert.equal("userId" in payload.elo[0], false);
  assert.deepEqual(parsePublicStandings(payload), payload);
  assert.throws(() => projectPublicStandings(rows, []));
  assert.throws(() => projectPublicStandings([...rows].reverse(), [], PUBLIC_RATING_SYSTEM_V4));
});
test("v3 defaults and bounds remain active; unknown contracts rejected", () => {
  assert.equal(projectRankedLobbyRating(1600, null, null).policyVersion, 3);
  assert.equal(rankedLobbyModel(projectRankedLobbyRating(1600, null, null)).current.label, "Gold V");
  assert.equal(rankEmblemModel(1600).label, "Gold V");
  assert.throws(() => projectRankedLobbyRating(-1, null, null));
  assert.throws(() => parseRankedLobbyRating({ rating: -1, highestRating: 1500, policyVersion: 3 }));
  assert.throws(() => parseRankedLobbyRating({ rating: 1500, highestRating: 1499, policyVersion: 4 }));
  assert.throws(() => parseRankedLobbyRating({ rating: 1500, highestRating: 1500, policyVersion: 5 }));
});
