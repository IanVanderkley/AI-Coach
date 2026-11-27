import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { competitiveRank } from "../lib/leaderboard/rank-policy.ts";

const read = (path) => readFileSync(path, "utf8");
const board = read("components/leaderboard/verified-leaderboard.tsx");

test("leaderboard shares all eight competitive ranks and division boundaries", () => {
  for (const [rating, label] of [
    [100, "Copper V"],
    [599, "Copper I"],
    [600, "Bronze V"],
    [914, "Bronze II"],
    [1100, "Silver V"],
    [1600, "Gold V"],
    [2100, "Platinum V"],
    [2600, "Emerald V"],
    [3100, "Diamond III"],
    [3399, "Diamond I"],
    [3400, "Omniscient"],
    [10000, "Omniscient"],
  ])
    assert.equal(competitiveRank(rating).label, label);
  assert.match(board, /competitiveRank\(rating\)/);
  assert.match(board, /<RankEmblem rating=\{rating\} size=\{64\} decorative/);
  assert.match(board, /rank\.label/);
  assert.doesNotMatch(board, /ratingTier|K=32|start at 1000/);
});

test("rank art is derived from saved public Elo without changing board order or fastest wins", () => {
  assert.match(board, /<CompetitiveRankCell rating=\{entry\.rating\}/);
  assert.match(board, /standings\.elo\.map/);
  assert.match(board, /standings\.fastest\.map/);
  assert.match(board, /#\{entry\.rank\}/);
  assert.match(board, /entry\.username/);
  assert.match(board, /parsePublicStandings\(payload\)/);
  assert.match(board, /cache: "no-store"/);
  assert.doesNotMatch(board, /\.sort\(|\.filter\(|method: "POST"|user_id/);
});

test("leaderboard keeps privacy messaging, Elo guide and responsive emblem rows", () => {
  const css = read("styles/leaderboard-polish.css");
  const page = read("app/leaderboard/page.tsx");
  assert.match(page, /Anonymous mode hides your name and results/);
  assert.match(page, /href="\/settings"/);
  assert.doesNotMatch(board, /How Elo works/);
  assert.match(read("components/ranked/ranked-lobby.tsx"), /How Elo works/);
  assert.match(css, /\.leaderboard-competitive-rank/);
  assert.match(css, /grid-template-columns: 64px/);
  assert.match(css, /@media \(max-width: 600px\)/);
});
