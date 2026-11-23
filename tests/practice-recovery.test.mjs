import assert from "node:assert/strict";
import test from "node:test";

import { visibleBoardHash } from "../lib/coach/visible-board-hash.ts";
import { DIFFICULTY_SETTINGS } from "../lib/game-settings.ts";
import {
  clearPracticeRecovery,
  parsePracticeRecovery,
  practiceRecoveryKey,
  readPracticeRecovery,
  savePracticeRecovery,
} from "../lib/practice/in-progress.ts";

class MemoryStorage {
  data = new Map();
  getItem(key) {
    return this.data.get(key) ?? null;
  }
  setItem(key, value) {
    this.data.set(key, String(value));
  }
  removeItem(key) {
    this.data.delete(key);
  }
}

function blank(rows, columns) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => ({
      mine: false,
      adjacentMines: 0,
      revealed: false,
      flagged: false,
    })),
  );
}

function flaggedStart(settings) {
  const board = blank(settings.rows, settings.columns);
  board[0][1].flagged = true;
  const hash = visibleBoardHash(board);
  return {
    version: 1,
    difficulty: settings.label.toLowerCase(),
    board,
    status: "ready",
    firstClick: true,
    inputMode: "flag",
    paused: false,
    elapsedMs: 4100,
    mines: [],
    moves: [{ row: 0, col: 1, action: "flag", atMs: 0, afterHash: hash }],
    updatedAt: 1795476000000,
  };
}

function startedGame(settings) {
  const board = blank(settings.rows, settings.columns);
  const mines = Array.from(
    { length: settings.mines },
    (_, i) =>
      // Use bottom cells so the first reveal at (0,0) stays safe.
      settings.rows * settings.columns - 1 - i,
  );
  const mineSet = new Set(mines);
  for (let r = 0; r < settings.rows; r++) {
    for (let c = 0; c < settings.columns; c++) {
      const cell = board[r][c];
      cell.mine = mineSet.has(r * settings.columns + c);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (
            nr >= 0 &&
            nr < settings.rows &&
            nc >= 0 &&
            nc < settings.columns &&
            mineSet.has(nr * settings.columns + nc)
          )
            cell.adjacentMines++;
        }
      }
    }
  }
  board[0][0].revealed = true;
  return {
    version: 1,
    difficulty: settings.label.toLowerCase(),
    board,
    status: "playing",
    firstClick: false,
    inputMode: "reveal",
    paused: false,
    elapsedMs: 15000,
    mines,
    moves: [
      { row: 0, col: 0, action: "reveal", atMs: 0, afterHash: visibleBoardHash(board) },
    ],
    updatedAt: 1795476000000,
  };
}

const beginner = DIFFICULTY_SETTINGS.beginner;
const intermediate = DIFFICULTY_SETTINGS.intermediate;
const expert = DIFFICULTY_SETTINGS.expert;

for (const settings of [beginner, intermediate, expert]) {
  test(`${settings.label}: saves and loads a flagged, not-yet-revealed board`, () => {
    const storage = new MemoryStorage();
    const snapshot = flaggedStart(settings);
    assert.equal(savePracticeRecovery(storage, settings, snapshot), true);
    assert.deepEqual(readPracticeRecovery(storage, settings), snapshot);
  });
  test(`${settings.label}: saves and loads a started board with exact mines and moves`, () => {
    const storage = new MemoryStorage();
    const snapshot = startedGame(settings);
    assert.equal(savePracticeRecovery(storage, settings, snapshot), true);
    assert.deepEqual(readPracticeRecovery(storage, settings), snapshot);
  });
}

test("each difficulty has an independent saved-game slot", () => {
  const storage = new MemoryStorage();
  savePracticeRecovery(storage, beginner, flaggedStart(beginner));
  savePracticeRecovery(storage, expert, flaggedStart(expert));
  assert.equal(readPracticeRecovery(storage, intermediate), null);
  clearPracticeRecovery(storage, beginner);
  assert.equal(readPracticeRecovery(storage, beginner), null);
  assert.ok(readPracticeRecovery(storage, expert));
});

test("rejects completed recordings so recovery cannot duplicate a finished game", () => {
  assert.equal(
    parsePracticeRecovery({ ...startedGame(beginner), status: "won" }, beginner),
    null,
  );
  assert.equal(
    parsePracticeRecovery({ ...startedGame(beginner), status: "lost" }, beginner),
    null,
  );
});

test("rejects changed mine layout and mismatched mine counts", () => {
  const value = startedGame(beginner);
  value.mines.pop();
  assert.equal(parsePracticeRecovery(value, beginner), null);
});

test("rejects inconsistent adjacency and exposed hidden mine", () => {
  const value = startedGame(beginner);
  value.board[0][0].adjacentMines = 7;
  assert.equal(parsePracticeRecovery(value, beginner), null);
  const second = startedGame(beginner);
  const bottom = second.mines[0];
  second.board[Math.floor(bottom / beginner.columns)][
    bottom % beginner.columns
  ].revealed = true;
  assert.equal(parsePracticeRecovery(second, beginner), null);
});

test("rejects corrupt last-visible-board checksums", () => {
  const value = flaggedStart(beginner);
  value.moves[0].afterHash = "deadbeef";
  assert.equal(parsePracticeRecovery(value, beginner), null);
});

test("rejects impossible move positions, timestamp regressions and unknown actions", () => {
  const value = flaggedStart(beginner);
  value.moves[0].row = 999;
  assert.equal(parsePracticeRecovery(value, beginner), null);
  const other = flaggedStart(beginner);
  other.moves[0].action = "teleport";
  assert.equal(parsePracticeRecovery(other, beginner), null);
});

test("rejects unknown version and mismatched difficulty", () => {
  const snapshot = flaggedStart(beginner);
  assert.equal(parsePracticeRecovery({ ...snapshot, version: 2 }, beginner), null);
  assert.equal(parsePracticeRecovery(snapshot, intermediate), null);
});

test("invalid JSON is discarded instead of crashing Play", () => {
  const storage = new MemoryStorage();
  const key = practiceRecoveryKey(beginner);
  storage.setItem(key, "{bad-json");
  assert.equal(readPracticeRecovery(storage, beginner), null);
  assert.equal(storage.getItem(key), null);
});

test("storage denial does not prevent gameplay", () => {
  const denied = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  assert.equal(readPracticeRecovery(denied, beginner), null);
  assert.equal(savePracticeRecovery(denied, beginner, flaggedStart(beginner)), false);
  assert.doesNotThrow(() => clearPracticeRecovery(denied, beginner));
});
