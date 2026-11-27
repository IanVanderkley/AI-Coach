import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  DEFAULT_COACHING_SECTIONS,
  normalizeCoachingSections,
  loadCoachingSections,
} from "../lib/settings/coaching-section-preferences.ts";
const read = (file) => readFileSync(file, "utf8");
test("section defaults are independent, compact and validated", () => {
  assert.equal(DEFAULT_COACHING_SECTIONS.replay, false);
  assert.equal(DEFAULT_COACHING_SECTIONS.lessons, false);
  const value = normalizeCoachingSections({
    replay: true,
    lessons: false,
    drill: true,
    ranked: false,
    samples: "yes",
    unknown: true,
  });
  assert.equal(value.replay, true);
  assert.equal(value.drill, true);
  assert.equal(value.ranked, false);
  assert.equal(value.samples, false);
  assert.ok(!("unknown" in value));
  assert.deepEqual(
    loadCoachingSections({ getItem: () => "broken" }),
    DEFAULT_COACHING_SECTIONS,
  );
  assert.deepEqual(loadCoachingSections({ getItem: () => JSON.stringify(value) }), value);
});
test("coach conversation is a separate evidence-only view with Ranked memory-only follow-up", () => {
  const ui = read("components/coach/coach-console.tsx"),
    panel = read("components/coach/evidence-coach-panel.tsx");
  assert.match(ui, /hidden=\{reviewTab !== "coach"\}/);
  assert.match(ui, /<ReviewConversation/);
  assert.match(panel, /persist=\{mode === "practice"\}/);
  assert.match(panel, /report=\{review.followUpReport\}/);
  assert.match(ui, /setReviewTab\("review"\)/);
  assert.match(ui, /replayScrollRequested.current = true/);
});
test("settings and focus shortcuts are wired to the same section defaults", () => {
  const settings = read("components/settings/replay-tooltip-setting.tsx"),
    progress = read("components/coach/personalized-coaching.tsx"),
    ui = read("components/coach/coach-console.tsx");
  assert.match(settings, /defaults.update\(key, event.target.checked\)/);
  assert.match(ui, /readCoachingSections\(\).replay/);
  assert.match(progress, /open=\{sections.drill\}/);
  assert.match(progress, /open=\{sections.saved\}/);
  assert.match(progress, /lead\.example!\.gameRef/);
  assert.match(progress, /lead\.example!\.move/);
});
