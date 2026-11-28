import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = (p) => readFileSync(p, "utf8");
const board = read("components/leaderboard/verified-leaderboard.tsx");
const css = read("styles/leaderboard-podium.css");
test("podium uses only the first three existing ordered public results from either tab", () => {
  assert.match(board, /standings\[tab\]\.slice\(0, 3\)/);
  assert.match(board, /leaders\.map/);
  assert.match(board, /standings && resultCount > 0/);
  assert.match(board, /formatRankedDuration\(entry.durationMs\)/);
  assert.match(board, /standings\.elo\.map/);
  assert.match(board, /standings\.fastest\.map/);
  assert.doesNotMatch(board, /\.sort\(|\.filter\(/);
});
test("own-row marking requires a public owner preference and an existing public entry", () => {
  assert.match(board, /fetch\("\/api\/leaderboard\/preferences"/);
  assert.match(board, /data\?\.isAnonymous === false/);
  assert.match(board, /PUBLIC_USERNAME_PATTERN\.test\(data.username\)/);
  assert.match(board, /entry.username === ownName/);
  assert.match(board, /setOwnName\(null\)/);
  assert.match(board, /controller.signal.aborted/);
});
test("podium has responsive styling and the guide is no longer repeated in standings", () => {
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /focus-visible/);
  assert.match(css, /data-own="true"/);
  assert.match(read("app/layout.tsx"), /leaderboard-podium\.css/);
  assert.doesNotMatch(board, /How Elo works/);
});
