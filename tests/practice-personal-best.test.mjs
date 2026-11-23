import assert from "node:assert/strict";
import { test } from "node:test";

import { practiceBestKey, recordPracticeBest } from "../lib/practice/personal-best.ts";

const beginner = { rows: 9, columns: 9, mines: 10 };
const expert = { rows: 16, columns: 30, mines: 99 };

function memoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
  };
}

test("first Practice win sets a browser-local best without claiming an improvement", () => {
  const storage = memoryStorage();
  assert.deepEqual(recordPracticeBest(storage, beginner, 42), {
    kind: "first",
    bestSeconds: 42,
    previousSeconds: null,
  });
  assert.equal(storage.getItem(practiceBestKey(beginner)), "42");
});

test("a faster Practice win replaces the best and can be celebrated", () => {
  const storage = memoryStorage();
  recordPracticeBest(storage, beginner, 42);
  assert.deepEqual(recordPracticeBest(storage, beginner, 35), {
    kind: "improved",
    bestSeconds: 35,
    previousSeconds: 42,
  });
});

test("ties and slower times cannot earn a new record", () => {
  const storage = memoryStorage();
  recordPracticeBest(storage, beginner, 35);
  assert.equal(recordPracticeBest(storage, beginner, 35).kind, "existing");
  assert.equal(recordPracticeBest(storage, beginner, 99).bestSeconds, 35);
  assert.equal(storage.getItem(practiceBestKey(beginner)), "35");
});

test("records are independent across board dimensions and mine count", () => {
  const storage = memoryStorage();
  recordPracticeBest(storage, beginner, 35);
  assert.equal(recordPracticeBest(storage, expert, 150).kind, "first");
  assert.notEqual(practiceBestKey(beginner), practiceBestKey(expert));
});

test("invalid stored values are not trusted as a personal best", () => {
  const storage = memoryStorage();
  storage.setItem(practiceBestKey(beginner), "-12");
  assert.equal(recordPracticeBest(storage, beginner, 25).kind, "first");
  storage.setItem(practiceBestKey(beginner), "1.2");
  assert.equal(recordPracticeBest(storage, beginner, 25).kind, "first");
});

test("storage denied or unavailable never claims a saved best", () => {
  assert.equal(recordPracticeBest(null, beginner, 30).kind, "unavailable");
  const storage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("blocked");
    },
  };
  assert.equal(recordPracticeBest(storage, beginner, 30).kind, "unavailable");
});

test("bad times and board shapes are rejected", () => {
  assert.throws(() => recordPracticeBest(memoryStorage(), beginner, -2), RangeError);
  assert.throws(() => recordPracticeBest(memoryStorage(), beginner, NaN), RangeError);
  assert.throws(
    () => recordPracticeBest(memoryStorage(), { rows: 9, columns: 9, mines: 81 }, 20),
    RangeError,
  );
});

test("a legitimate zero-second finish is stored and cannot be beaten by a tie", () => {
  const storage = memoryStorage();
  assert.equal(recordPracticeBest(storage, beginner, 0).kind, "first");
  assert.equal(recordPracticeBest(storage, beginner, 0).kind, "existing");
});
