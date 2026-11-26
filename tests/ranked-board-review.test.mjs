import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildRankedBoardReview, reviewRankedCell } from "../lib/ranked/board-review.ts";

const previous = {
  matchId: "match",
  status: "active",
  moveCount: 8,
  rows: 16,
  columns: 16,
  mineCount: 40,
};
const minePositions = Array.from({ length: 40 }, (_, i) => 255 - i);
const loss = {
  matchId: "match",
  status: "lost",
  moveCount: 9,
  minePositions,
  hitMine: { row: 15, column: 15 },
};
const win = { matchId: "match", status: "won", moveCount: 9 };
const revealed = [{ row: 0, column: 0, adjacentMines: 0 }];
const allSafe = Array.from({ length: 216 }, (_, index) => {
  const row = Math.floor(index / 16);
  const column = index % 16;
  return {
    row,
    column,
    adjacentMines: minePositions.filter(
      (m) => Math.abs(Math.floor(m / 16) - row) <= 1 && Math.abs((m % 16) - column) <= 1,
    ).length,
  };
});

test("loss uses server mine locations, highlights hit and distinguishes both flags", () => {
  const review = buildRankedBoardReview(previous, loss, revealed);
  assert.ok(review);
  assert.equal(review.mines.size, 40);
  assert.equal(reviewRankedCell(review, 255, false).kind, "hit");
  assert.equal(reviewRankedCell(review, 254, false).kind, "mine");
  assert.equal(reviewRankedCell(review, 254, true).kind, "correct-flag");
  assert.equal(reviewRankedCell(review, 1, true).kind, "wrong-flag");
  assert.equal(reviewRankedCell(review, 0, false).kind, "opened");
  assert.equal(reviewRankedCell(review, 1, false).kind, "unopened");
});
test("victory identifies all mines from exactly 216 revealed safe cells", () => {
  const review = buildRankedBoardReview(previous, win, allSafe);
  assert.ok(review);
  assert.deepEqual(
    [...review.mines].sort((a, b) => a - b),
    [...minePositions].sort((a, b) => a - b),
  );
  assert.equal(review.hit, null);
  assert.equal(reviewRankedCell(review, 215, false).kind, "opened");
  assert.equal(reviewRankedCell(review, 216, false).kind, "mine");
  assert.equal(reviewRankedCell(review, 215, false).number, allSafe[215].adjacentMines);
});
test("active, foreign, stale, duplicate and unsupported responses never create a review", () => {
  for (const response of [
    { ...loss, status: "active" },
    { ...loss, matchId: "foreign" },
    { ...loss, moveCount: 8 },
    { ...loss, moveCount: 10 },
    null,
  ]) {
    assert.equal(buildRankedBoardReview(previous, response, revealed), null);
  }
  assert.equal(
    buildRankedBoardReview({ ...previous, status: "lost" }, loss, revealed),
    null,
  );
  assert.equal(buildRankedBoardReview({ ...previous, rows: 9 }, loss, revealed), null);
});
test("invalid mine payload or hit location fails closed", () => {
  for (const response of [
    { ...loss, minePositions: undefined },
    { ...loss, minePositions: Array(40).fill(255) },
    { ...loss, minePositions: [256, ...minePositions.slice(1)] },
    { ...loss, minePositions: [0, ...minePositions.slice(1)] },
    { ...loss, hitMine: { row: 0, column: 0 } },
    { ...loss, hitMine: null },
  ]) {
    assert.equal(buildRankedBoardReview(previous, response, revealed), null);
  }
});
test("incomplete victory, invalid visible positions, duplicate reveals and incorrect numbers fail closed", () => {
  assert.equal(buildRankedBoardReview(previous, win, allSafe.slice(1)), null);
  assert.equal(buildRankedBoardReview(previous, loss, [...revealed, ...revealed]), null);
  assert.equal(
    buildRankedBoardReview(previous, loss, [{ row: 16, column: 0, adjacentMines: 0 }]),
    null,
  );
  assert.equal(
    buildRankedBoardReview(previous, loss, [{ row: 0, column: 0, adjacentMines: 1 }]),
    null,
  );
  assert.equal(
    buildRankedBoardReview(previous, win, [
      ...allSafe.slice(0, -1),
      { ...allSafe.at(-1), adjacentMines: 8 },
    ]),
    null,
  );
});
test("review has no move inputs and both terminal move handlers capture the snapshot", () => {
  const page = readFileSync("app/ranked/page.tsx", "utf8");
  const cell = readFileSync("components/ranked/ranked-review-cell.tsx", "utf8");
  assert.equal((page.match(/review: buildRankedBoardReview\(/g) ?? []).length, 2);
  assert.match(page, /board.status !== "active" && board.review/);
  assert.match(page, /<RankedReviewCell/);
  assert.doesNotMatch(cell, /onClick|onContextMenu|fetch\(|localStorage|sessionStorage/);
  assert.match(cell, /role="gridcell"/);
});
