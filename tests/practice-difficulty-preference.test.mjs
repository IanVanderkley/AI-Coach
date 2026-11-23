import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PRACTICE_DIFFICULTY_KEY,
  readPracticeDifficulty,
  savePracticeDifficulty,
  isPracticeDifficulty,
} from "../lib/practice/difficulty-preference.ts";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test("valid Practice difficulty survives navigation and reloading", () => {
  const storage = memoryStorage();
  assert.equal(readPracticeDifficulty(storage), null);
  assert.equal(savePracticeDifficulty(storage, "beginner"), true);
  assert.equal(storage.getItem(PRACTICE_DIFFICULTY_KEY), "beginner");
  assert.equal(readPracticeDifficulty(storage), "beginner");
  assert.equal(savePracticeDifficulty(storage, "expert"), true);
  assert.equal(readPracticeDifficulty(storage), "expert");
});

test("malformed values never become a difficulty", () => {
  const storage = memoryStorage();
  storage.setItem(PRACTICE_DIFFICULTY_KEY, "evil");
  assert.equal(readPracticeDifficulty(storage), null);
  assert.equal(isPracticeDifficulty("Intermediate"), false);
  assert.equal(isPracticeDifficulty(null), false);
  assert.equal(isPracticeDifficulty("intermediate"), true);
});

test("storage errors do not interrupt gameplay", () => {
  const blocked = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
  };
  assert.equal(readPracticeDifficulty(blocked), null);
  assert.equal(savePracticeDifficulty(blocked, "beginner"), false);
  assert.equal(readPracticeDifficulty(null), null);
  assert.equal(savePracticeDifficulty(null, "expert"), false);
});
