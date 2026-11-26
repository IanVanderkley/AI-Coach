import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { action, referenceGame } from "./helpers/reference-practice.mjs";
import { preparePracticeAnalysis } from "../lib/coach/practice-analysis.ts";
import { scorePreparedPracticeReview } from "../lib/coach/review-score.ts";
import { coachPreparedPractice } from "../lib/coach/practice-coach-result.ts";
import { prepareVerifiedAnalysis } from "../lib/coach/verified-analysis.ts";
import { prepareVerifiedFocusInput } from "../lib/coach/verified-focus-input.ts";

const fixture = () =>
  referenceGame({
    rows: 2,
    columns: 3,
    mines: [0, 2],
    actions: [
      action(1, 0, "reveal"),
      action(1, 1, "reveal"),
      action(1, 2, "reveal"),
      action(0, 0, "reveal"),
    ],
  }).recording;

test("the compatibility report projects the exact shared Practice grade and findings", () => {
  const analysis = preparePracticeAnalysis(fixture());
  const grade = scorePreparedPracticeReview(analysis);
  const { report } = coachPreparedPractice(analysis);
  assert.equal(report.score, grade.score);
  assert.equal(report.grade, grade.grade);
  assert.equal(report.metrics, null);
  assert.equal(report.source, "rules");
  for (const mistake of report.mistakes) {
    assert.equal(analysis.replay.frames[mistake.moveNumber - 1].decision, "mistake");
    assert.ok(
      analysis.report.moments.some(
        (m) => m.moveNumber === mistake.moveNumber && m.kind === "mistake",
      ),
    );
  }
  assert.ok(report.mistakes.length > 0);
});

test("unresolved losses never acquire an invented legacy grade", () => {
  const raw = referenceGame({
    rows: 3,
    columns: 3,
    mines: [0],
    actions: [action(1, 1, "reveal"), action(0, 0, "reveal")],
  }).recording;
  const { report } = coachPreparedPractice(preparePracticeAnalysis(raw));
  assert.equal(report.grade, null);
  assert.equal(report.score, null);
  assert.deepEqual(report.mistakes, []);
  assert.equal(report.keyMoment, null);
});

test("preferences change the presentation without changing the shared grade", () => {
  const analysis = preparePracticeAnalysis(fixture());
  const before = structuredClone(analysis.report);
  const direct = coachPreparedPractice(analysis, {
    coachingStyle: "direct",
    explanationDetail: "brief",
    experienceLevel: "new",
    selectedGoals: ["flagging"],
    customGoal: "",
    competitiveness: "relaxed",
  }).report;
  const balanced = coachPreparedPractice(analysis).report;
  assert.equal(direct.grade, balanced.grade);
  assert.equal(direct.score, balanced.score);
  assert.notEqual(direct.headline, balanced.headline);
  assert.deepEqual(analysis.report, before);
});

test("the verified boundary retains whole-recording brief scope but focus matches the visual scope", () => {
  const raw = fixture();
  const checked = prepareVerifiedAnalysis(raw);
  assert.equal(checked.ok, true);
  assert.equal(checked.report.recordedActions, raw.moves.length);
  assert.deepEqual(checked.analysis.report, preparePracticeAnalysis(raw).report);
  assert.deepEqual(prepareVerifiedFocusInput(raw).report, checked.analysis.report);
});

test("post-game offline fallback cannot silently use the legacy engine for stamped data", () => {
  const ui = readFileSync(
    new URL("../components/coach/game-coach-report.tsx", import.meta.url),
    "utf8",
  );
  assert.match(ui, /hasMoveCheckpoints\(payload\)/);
  assert.match(ui, /prepareVerifiedAnalysis\(payload\)/);
  assert.match(ui, /coachPreparedPractice\(checked.analysis, preferences\)/);
  assert.ok(
    ui.indexOf("coachPreparedPractice(checked.analysis, preferences)") <
      ui.indexOf("toRuleReport(analyzeGameplay(payload))"),
  );
});

test("the completed review no longer contains a competing experimental grade", () => {
  const ui = readFileSync(
    new URL("../components/coach/coach-console.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(ui, /Earlier AI coach draft/);
  assert.doesNotMatch(ui, /analyze\("practice", selectedReplay\)/);
  assert.match(ui, /<ReviewOverview/);
  assert.match(ui, /<EvidenceCoachPanel/);
});
