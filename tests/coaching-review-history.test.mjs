import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { scorePracticeReview } from "../lib/coach/review-score.ts";
import { referenceGame, action } from "./helpers/reference-practice.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
test("opening and uncertainty do not create a fabricated grade", () => {
  const game = referenceGame({
    rows: 3,
    columns: 3,
    mines: [0],
    actions: [action(1, 1, "reveal"), action(0, 0, "reveal")],
  }).recording;
  const score = scorePracticeReview(game);
  assert.equal(score.score, null);
  assert.equal(score.grade, null);
  assert.equal(score.uncertain, 1);
  assert.equal(score.mistakes, 0);
});
test("score uses board progress and only provable post-opening decisions", () => {
  const game = {
    game: "minesweeper",
    difficulty: "test",
    rows: 2,
    columns: 3,
    mineCount: 2,
    mines: [0, 2],
    outcome: "loss",
    durationSeconds: 5,
    moves: [
      action(1, 0, "reveal"),
      action(1, 1, "reveal"),
      action(1, 2, "reveal"),
      action(0, 0, "reveal"),
    ],
  };
  const result = scorePracticeReview(game);
  const assessed = result.good + result.mistakes;
  assert.ok(assessed > 0);
  assert.ok(result.mistakes > 0);
  assert.equal(result.focusMove, 4);
  assert.equal(result.progress, 75);
  assert.equal(
    result.score,
    Math.round(0.6 * result.progress + (40 * result.good) / assessed),
  );
});
test("review score rejects mismatched outcomes", () => {
  const game = referenceGame({
    rows: 3,
    columns: 3,
    mines: [0],
    actions: [action(1, 1, "reveal"), action(0, 0, "reveal")],
  }).recording;
  assert.throws(() => scorePracticeReview({ ...game, outcome: "win" }), /outcome/);
});
test("history picker lists metadata and supports explicit game review", () => {
  const source = read("components/coach/coach-console.tsx");
  assert.match(source, /repository\s*\.\s*listReviewSummaries\(\)/);
  assert.match(source, /onClick=\{\(\) => void openGame\(game\.id\)\}/);
  assert.match(source, /repository\.loadReview\(id\)/);
  assert.match(source, /scorePracticeReview\(game\)/);
  assert.match(source, /params\.get\("source"\) === "practice"/);
  assert.ok(source.indexOf("<ReviewOverview") < source.indexOf("<VerifiedReplayPanel"));
  assert.doesNotMatch(source, /repository\.listRecent\(/);
});
test("account review uses owner-filtered metadata and ordered paginated moves", () => {
  const source = read("lib/practice/repository.ts");
  const metadata = source.slice(
    source.indexOf("// Metadata only:"),
    source.indexOf("async loadReview(id)", source.indexOf("// Metadata only:")),
  );
  assert.match(metadata, /\.eq\("user_id", userId\)/);
  assert.doesNotMatch(metadata, /mine_indices|practice_game_moves/);
  assert.match(source, /\.eq\("client_record_id", id\)/);
  assert.match(source, /\.range\(\s*moves\.length,/);
  assert.match(source, /move\.move_number !== moves\.length \+ i \+ 1/);
});
