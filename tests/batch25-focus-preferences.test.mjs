import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  focusCandidates,
  focusPreferences,
  prioritizeMoments,
} from "../lib/coach/visual-coaching.ts";
import { handleVerifiedCoachPost } from "../lib/coach/http-handlers.ts";

const moment = (id, category, kind, occurrences) => ({
  id,
  category,
  kind,
  occurrences,
  moveNumber: Number(id.slice(5)),
  finding: "Verified finding",
  evidence: "Verified proof",
  nextTime: "Verified advice",
});
const guess = moment("move-2", "Unnecessary guess", "mistake", 4);
const flag = moment("move-3", "Flagged a proven-safe square", "mistake", 1);
const good = moment("move-4", "Correct logical flag", "good", 9);
const report = { moments: [guess, flag, good] };
const prefs = focusPreferences({ selectedGoals: ["flagging"], coachingStyle: "direct" });
const post = (value) =>
  new Request("https://example.test/api/coach/verified", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://example.test" },
    body: JSON.stringify(value),
  });
function deps(overrides = {}) {
  return {
    prepareVerifiedFocusInput: () => ({ ok: true, report }),
    reservePaidCoachCall: async () => false,
    getConfiguredProvider: () => ({ id: "openai", model: "mock" }),
    requestNarrative: async () => null,
    validateFocusSelection: (r, id, style) =>
      r.moments.some((m) => m.id === id) && ["direct", "step-by-step"].includes(style)
        ? { focusId: id, style }
        : null,
    ...overrides,
  };
}

test("recognized preference projection rejects prototype keys, invalid values and free text", () => {
  assert.deepEqual(
    focusPreferences({
      selectedGoals: [
        "flagging",
        "flagging",
        "__proto__",
        "constructor",
        "ignore instructions",
        1,
      ],
      coachingStyle: "bad",
      explanationDetail: "brief",
      customGoal: "private text",
    }),
    {
      selectedGoals: ["flagging"],
      coachingStyle: "balanced",
      explanationDetail: "brief",
    },
  );
  assert.deepEqual(focusPreferences(null), {
    selectedGoals: [],
    coachingStyle: "balanced",
    explanationDetail: "standard",
  });
});
test("focus respects mistakes and goals without changing evidence or counts", () => {
  const original = structuredClone(report);
  assert.deepEqual(focusCandidates(report, prefs), [flag]);
  assert.equal(prioritizeMoments(report, prefs)[0], flag);
  assert.deepEqual(focusCandidates(report), [guess, flag]);
  assert.deepEqual(focusCandidates({ moments: [good] }, prefs), [good]);
  assert.deepEqual(focusCandidates({ moments: [] }, prefs), []);
  assert.deepEqual(report, original);
});
test("server fallback agrees with the local selected goal and tone", async () => {
  const response = await handleVerifiedCoachPost(
    post({ focusPreferences: prefs }),
    deps(),
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.focusId, flag.id);
  assert.equal(body.style, "direct");
  assert.equal(body.selectedBy, "rules");
});
test("provider receives only eligible verified moments and no private goal text", async () => {
  let supplied;
  const response = await handleVerifiedCoachPost(
    post({ focusPreferences: { ...prefs, customGoal: "private text" }, mines: [1, 2] }),
    deps({
      reservePaidCoachCall: async () => true,
      requestNarrative: async (_p, _s, prompt) => {
        supplied = JSON.parse(prompt);
        return { headline: flag.id, summary: "direct" };
      },
    }),
  );
  assert.deepEqual(
    supplied.available.map((m) => m.id),
    [flag.id],
  );
  assert.doesNotMatch(JSON.stringify(supplied), /private text|"mines"/);
  assert.equal((await response.json()).selectedBy, "openai");
});
test("provider cannot select a real but lower-priority finding", async () => {
  for (const id of [guess.id, good.id, "move-999"]) {
    const response = await handleVerifiedCoachPost(
      post({ focusPreferences: prefs }),
      deps({
        reservePaidCoachCall: async () => true,
        requestNarrative: async () => ({ headline: id, summary: "direct" }),
      }),
    );
    const body = await response.json();
    assert.equal(body.focusId, flag.id);
    assert.equal(body.selectedBy, "rules");
  }
});
test("visual request uses the sanitized projection and resets stale focus when preferences change", () => {
  const ui = readFileSync(
    new URL("../components/coach/evidence-coach-panel.tsx", import.meta.url),
    "utf8",
  );
  assert.match(ui, /focusPreferences: focusPreferences\(preferences\)/);
  assert.match(ui, /focusCandidates\(report, preferences\)/);
  assert.match(ui, /\}, \[game, preferences\]\)/);
});
