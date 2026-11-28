import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = (p) => readFileSync(p, "utf8");
test("resume button replaces the redundant saved-match copy", () => {
  const page = read("app/ranked/page.tsx");
  assert.doesNotMatch(page, /Unfinished match · Progress saved/);
  assert.match(page, /RESUME MATCH/);
  assert.match(page, /PLAY INTERMEDIATE/);
  assert.match(page, /if \(await loadBoard\(\)\) setResumeRequired\(false\)/);
  assert.match(page, /onClick=\{startMatch\}/);
});
test("lobby action fills its grid row and mobile layout remains responsive", () => {
  const css = read("app/ranked/ranked-layout.module.css").split(
    "/* Batch 27D: competitive lobby surfaces */",
  )[1];
  assert.match(css, /\.lobbyActions\s*\{[^}]*align-content:\s*stretch/);
  assert.match(css, /\.lobbyActions \.launch\s*\{[^}]*grid-template-rows:\s*1fr/);
  assert.match(css, /\.lobbyActions \.playButton\s*\{[^}]*height:\s*100%/);
  assert.match(css, /max-width: 760px/);
});
test("rank artwork, server model and milestone geometry remain intact", () => {
  const component = read("components/ranked/ranked-lobby.tsx");
  assert.match(component, /rankedLobbyModel\(value\)/);
  assert.match(component, /RANK_DEFINITIONS\.map/);
  assert.match(component, /href="\/faq#ranked"/);
  const css = read("components/ranked/ranked-lobby.module.css").split(
    "/* Batch 27D: rank presentation */",
  )[1];
  assert.match(css, /var\(--rank-accent\)/);
  assert.doesNotMatch(css, /\.track\s*\{|\.milestones li > svg\s*\{/);
});
