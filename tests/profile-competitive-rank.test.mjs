import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  parseRankedLobbyRating,
  rankedLobbyModel,
} from "../lib/leaderboard/rank-lobby.ts";

const read = (path) => readFileSync(path, "utf8");
const component = read("components/profile/competitive-rank-card.tsx");

test("profile derives current and highest rank from the same saved data as the lobby", () => {
  const saved = parseRankedLobbyRating({
    rating: 914,
    highestRating: 1000,
    policyVersion: 2,
  });
  const model = rankedLobbyModel(saved);
  assert.equal(model.current.label, "Bronze II");
  assert.equal(model.highest.label, "Bronze I");
  assert.equal(model.current.eloToPromotion, 86);
  assert.equal(model.nextRank, "Bronze I");
  const highest = rankedLobbyModel(
    parseRankedLobbyRating({ rating: 3400, highestRating: 3500, policyVersion: 2 }),
  );
  assert.equal(highest.current.progress, null);
  assert.equal(highest.current.label, "Omniscient");
  assert.throws(() =>
    parseRankedLobbyRating({ rating: 1000, highestRating: 900, policyVersion: 2 }),
  );
});

test("profile card uses authenticated read-only rank data, explicit failure states and existing emblems", () => {
  assert.match(component, /fetch\("\/api\/ranked\/lobby-rating"/);
  assert.match(component, /cache: "no-store"/);
  assert.match(component, /response\.status === 401/);
  assert.match(component, /parseRankedLobbyRating/);
  assert.match(component, /rankedLobbyModel\(saved\)/);
  assert.match(component, /rating=\{saved\.rating\}/);
  assert.match(component, /rating=\{saved\.highestRating\}/);
  assert.match(component, /model\.current\.progress !== null/);
  assert.match(component, /role="alert"/);
  assert.doesNotMatch(
    component,
    /localStorage|sessionStorage|\.insert\(|\.update\(|method:\s*"POST"|calculateRankPolicyV2/,
  );
});

test("both profile routes mount a responsive accessible card without changing account statistics", () => {
  for (const file of ["practice-profile.tsx", "ranked-stats-page.tsx"]) {
    assert.match(read(`components/profile/${file}`), /<CompetitiveRankCard \/>/);
  }
  const css = read("components/profile/competitive-rank-card.module.css");
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /focus-visible/);
  assert.match(component, /aria-label="Progress toward next competitive division"/);
  assert.match(component, /href="\/ranked\/rating-guide"/);
  assert.match(component, /href="\/ranked"/);
});
