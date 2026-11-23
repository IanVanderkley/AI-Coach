import assert from "node:assert/strict";
import { test } from "node:test";
import {
  savePracticeReviewHandoff,
  loadPracticeReviewHandoff,
  PRACTICE_REVIEW_HANDOFF_KEY,
} from "../lib/practice/review-handoff.ts";
import { formatPracticeShareText } from "../lib/practice/share-text.ts";
import { referenceGame, action } from "./helpers/reference-practice.mjs";

const loss = () =>
  referenceGame({
    rows: 3,
    columns: 3,
    mines: [0],
    actions: [action(1, 1, "reveal"), action(0, 0, "reveal")],
  }).recording;
function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
}

test("handoff opens the exact completed game before cloud save finishes", () => {
  const store = memoryStorage();
  const game = loss();
  const id = savePracticeReviewHandoff(store, game, 1000);
  assert.match(id, /^[a-f0-9-]{36}$/i);
  assert.deepEqual(loadPracticeReviewHandoff(store, id, 1001), game);
});
test("another game's ID cannot open this handoff", () => {
  const store = memoryStorage();
  savePracticeReviewHandoff(store, loss(), 1000);
  assert.equal(
    loadPracticeReviewHandoff(store, "b0ea86be-a3c6-458d-9222-81dbf2edff18", 1001),
    null,
  );
});
test("expired or not-yet-created handoffs are rejected", () => {
  const store = memoryStorage();
  const id = savePracticeReviewHandoff(store, loss(), 1000);
  assert.equal(loadPracticeReviewHandoff(store, id, 999), null);
  assert.equal(loadPracticeReviewHandoff(store, id, 1000 + 86400001), null);
});
test("altered move evidence cannot be treated as verified", () => {
  const store = memoryStorage();
  const id = savePracticeReviewHandoff(store, loss(), 1000);
  const saved = JSON.parse(store.getItem(PRACTICE_REVIEW_HANDOFF_KEY));
  saved.session.moves[0].afterHash = "00000000";
  store.setItem(PRACTICE_REVIEW_HANDOFF_KEY, JSON.stringify(saved));
  assert.equal(loadPracticeReviewHandoff(store, id, 1001), null);
});
test("an outcome inconsistent with the replay is rejected", () => {
  const store = memoryStorage();
  const id = savePracticeReviewHandoff(store, loss(), 1000);
  const saved = JSON.parse(store.getItem(PRACTICE_REVIEW_HANDOFF_KEY));
  saved.session.outcome = "win";
  store.setItem(PRACTICE_REVIEW_HANDOFF_KEY, JSON.stringify(saved));
  assert.equal(loadPracticeReviewHandoff(store, id, 1001), null);
});
test("storage errors do not crash the result screen", () => {
  assert.equal(savePracticeReviewHandoff(null, loss()), null);
  const blocked = {
    getItem() {
      throw Error("denied");
    },
    setItem() {
      throw Error("denied");
    },
  };
  assert.equal(savePracticeReviewHandoff(blocked, loss()), null);
  assert.equal(
    loadPracticeReviewHandoff(blocked, "b0ea86be-a3c6-458d-9222-81dbf2edff18"),
    null,
  );
});
test("shared result is readable and clearly marked as an unverified Practice score", () => {
  const text = formatPracticeShareText({
    outcome: "loss",
    difficulty: "Beginner",
    durationSeconds: 2,
    moveCount: 3,
    flagsOnBoard: 0,
  });
  assert.match(text, /Practice Loss · Beginner/);
  assert.match(text, /00:02 · 3 moves · 0 flags placed/);
  assert.match(text, /not a server-verified record/);
});
