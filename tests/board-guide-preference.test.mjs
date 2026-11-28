import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  BOARD_GUIDE_KEY,
  readBoardGuide,
  writeBoardGuide,
} from "../lib/settings/board-guide-preference.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const memory = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
};

test("board guide is visible by default and on unknown stored values", () => {
  const store = memory();
  assert.equal(readBoardGuide(undefined), true);
  assert.equal(readBoardGuide(store), true);
  store.setItem(BOARD_GUIDE_KEY, "invalid");
  assert.equal(readBoardGuide(store), true);
});
test("board guide can be disabled and re-enabled persistently", () => {
  const store = memory();
  assert.equal(writeBoardGuide(store, false), true);
  assert.equal(store.getItem(BOARD_GUIDE_KEY), "off");
  assert.equal(readBoardGuide(store), false);
  assert.equal(writeBoardGuide(store, true), true);
  assert.equal(readBoardGuide(store), true);
});
test("blocked storage fails safely without pretending to save", () => {
  const denied = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
  };
  assert.equal(readBoardGuide(denied), true);
  assert.equal(writeBoardGuide(denied, false), false);
  assert.equal(writeBoardGuide(undefined, false), false);
});
test("shared guide and settings use one preference with tab synchronization", () => {
  const guide = read("components/play/board-controls-guide.tsx");
  const hook = read("lib/settings/board-guide.ts");
  const setting = read("components/settings/board-guide-setting.tsx");
  assert.match(
    guide,
    /const \{ enabled \} = useBoardGuide\(\);\s*if \(!enabled\) return null;/,
  );
  assert.match(
    read("components/play/minesweeper-board.tsx"),
    /<BoardControlsGuide\s+mode="practice"/,
  );
  assert.match(read("app/ranked/page.tsx"), /<BoardControlsGuide\s+mode="ranked"/);
  assert.match(
    read("components/settings/settings-workspace.tsx"),
    /<BoardGuideSetting\s*\/>/,
  );
  assert.match(hook, /useSyncExternalStore\(subscribe, snapshot, serverSnapshot\)/);
  assert.match(hook, /addEventListener\("storage", onStorage\)/);
  assert.match(hook, /dispatchEvent\(new Event\(EVENT\)\)/);
  assert.match(setting, /checked=\{enabled\}/);
  assert.match(setting, /role="alert"/);
});
