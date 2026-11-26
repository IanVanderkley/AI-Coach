import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = (path) => readFileSync(path, "utf8");

test("queue and difficulty setup precede progression and remain lobby-only", () => {
  const page = read("app/ranked/page.tsx");
  const setup = page.indexOf("className={styles.lobbySetup}");
  const lobby = page.indexOf("<RankedLobby />");
  assert.ok(setup > 0 && lobby > setup);
  assert.match(page, /showLobby &&\s*\(\s*<div className=\{styles.lobbySetup\}/);
  assert.match(page, /<RankedLadderOverview \/>/);
  assert.match(page, /if \(await loadBoard\(\)\) setResumeRequired\(false\)/);
  assert.match(page, /onClick=\{startMatch\}/);
  assert.match(page, /showLobby && <RankedLobby \/>/);
});

test("lobby keeps rank artwork and links to the separate rating guide without reward previews", () => {
  const lobby = read("components/ranked/ranked-lobby.tsx");
  assert.match(lobby, /href="\/ranked\/rating-guide"/);
  assert.match(lobby, /RANK_DEFINITIONS\.map/);
  assert.doesNotMatch(
    lobby,
    /Potential victory|Potential defeat|model\.win|model\.loss|type="range"/,
  );
  assert.match(read("app/ranked/rating-guide/page.tsx"), /calculateRankPolicyV2/);
  assert.match(
    read("app/ranked/ranked-layout.module.css"),
    /\.lobbyActions\s*\{\s*grid-row:\s*1/,
  );
});
