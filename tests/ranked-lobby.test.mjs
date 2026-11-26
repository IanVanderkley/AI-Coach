import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  projectRankedLobbyRating,
  parseRankedLobbyRating,
  rankedLobbyModel,
} from "../lib/leaderboard/rank-lobby.ts";

const read = (path) => readFileSync(path, "utf8");
test("lobby projects real current and historical ratings, including pre-v2 receipts", () => {
  assert.deepEqual(projectRankedLobbyRating(1000, null, null), {
    rating: 1000,
    highestRating: 1000,
    policyVersion: 3,
  });
  assert.equal(projectRankedLobbyRating(1400, 1800, 1750).highestRating, 1800);
  assert.equal(projectRankedLobbyRating(1400, 1800, 1900).highestRating, 1900);
  assert.equal(projectRankedLobbyRating(2000, 1800, 1900).highestRating, 2000);
});
test("lobby rejects invalid data and never fabricates a starting rating", () => {
  for (const rating of [null, undefined, 99, 10001, 100.5, "1000"])
    assert.throws(() => projectRankedLobbyRating(rating, null, null));
  assert.throws(() => projectRankedLobbyRating(1000, 99, null));
  assert.throws(() =>
    parseRankedLobbyRating({ rating: 1000, highestRating: 900, policyVersion: 3 }),
  );
  assert.throws(() =>
    parseRankedLobbyRating({ rating: 1000, highestRating: 1000, policyVersion: 1 }),
  );
  assert.deepEqual(
    parseRankedLobbyRating({
      rating: 1000,
      highestRating: 1000,
      policyVersion: 3,
      userId: "private",
    }),
    projectRankedLobbyRating(1000, null, null),
  );
});
test("journey follows every milestone, division and top rank", () => {
  for (const [index, rating] of [
    100, 600, 1100, 1600, 2100, 2600, 3100, 3400,
  ].entries()) {
    const model = rankedLobbyModel(projectRankedLobbyRating(rating, null, null));
    assert.equal(model.index, index);
    assert.ok(Math.abs(model.journeyPercent - (index / 7) * 100) < 1e-9);
  }
  const gold = rankedLobbyModel(projectRankedLobbyRating(1842, 2001, null));
  assert.equal(gold.current.label, "Gold III");
  assert.equal(gold.nextRank, "Gold II");
  assert.equal(gold.current.eloToPromotion, 58);
  assert.equal(gold.highest.label, "Gold I");
  assert.equal(
    rankedLobbyModel(projectRankedLobbyRating(3400, null, null)).nextRank,
    null,
  );
});
test("preview rewards are bounded and calculated from saved Elo", () => {
  const start = rankedLobbyModel(projectRankedLobbyRating(1000, null, null));
  assert.equal(start.win, 63);
  assert.equal(start.loss, -13);
  assert.equal(rankedLobbyModel(projectRankedLobbyRating(100, null, null)).loss, 0);
  assert.equal(rankedLobbyModel(projectRankedLobbyRating(10000, null, null)).win, 0);
});
test("lobby route is owner-scoped, private, read-limited and requires the v2 schema", () => {
  const route = read("app/api/ranked/lobby-rating/route.ts");
  assert.match(route, /auth\.getUser\(\)/);
  assert.equal((route.match(/\.eq\("user_id", user\.id\)/g) ?? []).length, 3);
  assert.match(route, /guardRankedRateLimit\(admin, user\.id, "read"\)/);
  assert.match(route, /private, no-store/);
  assert.match(route, /rating_before,policy_version/);
  assert.match(route, /rating_after,policy_version/);
  assert.doesNotMatch(
    route,
    /export async function (POST|PUT|PATCH|DELETE)|\.insert\(|\.update\(|request\.json/,
  );
});
test("lobby is separate from the board and has no manual rating controls", () => {
  const page = read("app/ranked/page.tsx");
  const lobby = read("components/ranked/ranked-lobby.tsx");
  assert.match(page, /showLobby &&/);
  assert.match(page, /<RankedLobby/);
  assert.match(page, /!resumeRequired \|\| board.status !== "active"/);
  assert.match(page, /if \(await loadBoard\(\)\) setResumeRequired\(false\)/);
  assert.match(page, /onReturnLobby=\{returnToLobby\}/);
  assert.match(lobby, /RANK_DEFINITIONS\.map/);
  assert.match(lobby, /parseRankedLobbyRating/);
  assert.doesNotMatch(
    lobby,
    /type="range"|setRating\(|localStorage|sessionStorage|method:\s*"POST"/,
  );
});
