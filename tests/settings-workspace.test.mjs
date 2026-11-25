import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Settings has a single category navigation with five categories", () => {
  const workspace = read("components/settings/settings-workspace.tsx");
  for (const id of ["coaching", "player", "replay", "privacy", "account"]) {
    assert.match(workspace, new RegExp(`id:\\s*"${id}"`));
  }
  assert.match(workspace, /aria-pressed=\{category === id\}/);
  assert.doesNotMatch(read("components/settings/settings-panel.tsx"), /settings-sidebar/);
  assert.match(read("app/settings/page.tsx"), /<SettingsWorkspace\b/);
});

test("category switches preserve mounted preference and account panels", () => {
  const workspace = read("components/settings/settings-workspace.tsx");
  assert.match(workspace, /hidden=\{!preferencesVisible\}/);
  assert.match(workspace, /<SettingsPanel\s+category=\{preferenceCategory\}/);
  for (const category of ["replay", "privacy", "account"]) {
    assert.match(workspace, new RegExp(`hidden=\\{category !== "${category}"\\}`));
  }
  assert.match(
    read("styles/settings-workspace.css"),
    /\.settings-workspace-pane\[hidden\]\s*\{[^}]*display:\s*none/,
  );
});

test("coaching and player categories retain existing save and reset handlers", () => {
  const panel = read("components/settings/settings-panel.tsx");
  assert.equal((panel.match(/category === "coaching"/g) ?? []).length, 2);
  assert.match(panel, /category === "player"/);
  assert.match(panel, /useSettingsPreferences\(\)/);
  for (const action of [
    "saveSection",
    "saveAll",
    "discardAll",
    "resetSection",
    "resetAll",
  ]) {
    assert.match(panel, new RegExp(`\\b${action}\\b`));
  }
});

test("settings styling is scoped and deletion stays server-controlled", () => {
  const page = read("app/settings/page.tsx");
  assert.match(
    page,
    /deletionEnabled=\{process\.env\.ACCOUNT_DELETION_ENABLED === "true"\}/,
  );
  assert.match(
    read("components/settings/settings-workspace.tsx"),
    /<AccountManagement\s+deletionEnabled=\{deletionEnabled\}/,
  );
  assert.match(
    read("app/globals.css"),
    /@import "\.\.\/styles\/settings-workspace\.css"/,
  );
  const css = read("styles/settings-workspace.css");
  assert.match(css, /@media\s*\(max-width:\s*560px\)/);
  assert.match(css, /prefers-reduced-motion/);
});
