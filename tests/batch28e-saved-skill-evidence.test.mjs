import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSavedReview } from "../lib/coach/personalized-review.ts";
import { collectSkillEvidence } from "../lib/coach/skill-evidence.ts";
import { buildLearningDashboard } from "../lib/coach/learning-dashboard.ts";
import { preparePracticeAnalysis } from "../lib/coach/practice-analysis.ts";
const move = (row, col, action = "reveal") => ({ row, col, action });
const analysis = preparePracticeAnalysis({
  game: "minesweeper",
  difficulty: "Beginner",
  rows: 2,
  columns: 3,
  mineCount: 2,
  mines: [0, 2],
  outcome: "loss",
  durationSeconds: 5,
  moves: [
    move(1, 0),
    move(1, 1),
    move(1, 2),
    move(0, 0, "flag"),
    move(0, 0, "unflag"),
    move(0, 0),
  ],
});
function row(i, withEvidence = true) {
  return {
    mode: "practice",
    gameRef: `g${i}`,
    difficulty: "Beginner",
    outcome: "loss",
    completedAt: new Date(Date.UTC(2026, 0, i)).toISOString(),
    version: analysis.version,
    review: JSON.parse(
      JSON.stringify({
        ...buildSavedReview(analysis),
        ...(withEvidence ? { skillEvidence: collectSkillEvidence(analysis) } : {}),
      }),
    ),
  };
}
const build = (rows) => buildLearningDashboard(rows, "practice", "Beginner", 10);
const skill = (d, key) => d.skillSummary.skills.find((s) => s.key === key);
test("saved JSON round trip retains action evidence and no raw replay", () => {
  const r = row(1);
  assert.equal(r.review.skillEvidence.version, 1);
  assert.equal(r.review.skillEvidence.unflags, 1);
  assert.equal(r.review.skillEvidence.counts.flagging.supported, 1);
  assert.ok(!("replay" in r.review) && !("mines" in r.review));
  assert.ok(Buffer.byteLength(JSON.stringify(r.review.skillEvidence)) < 1024);
  assert.equal(build([r]).skillSummary.evidenceGames, 1);
});
test("legacy and new saved snapshots share overall cohort but not skill denominators", () => {
  const d = build([row(1, false), row(2), row(3)]);
  assert.equal(d.learning.selected.length, 3);
  assert.equal(d.skillSummary.evidenceGames, 2);
  assert.equal(d.skillSummary.missingEvidenceGames, 1);
  assert.equal(skill(d, "flagging").supported, 2);
  assert.equal(skill(d, "flagging").accuracy, null);
});
test("ten supported flags across games enables actual skill rate, not mastery", () => {
  const d = build(Array.from({ length: 10 }, (_, i) => row(i + 1)));
  assert.equal(skill(d, "flagging").accuracy, 100);
  assert.equal(skill(d, "flagging").assessedGames, 10);
  assert.equal(skill(d, "chording").accuracy, null);
});
test("invalid skill counters are excluded without changing legacy decision accuracy", () => {
  const r = row(1);
  r.review.skillEvidence.counts.flagging.supported = 999;
  const d = build([r]);
  assert.equal(d.skillSummary.evidenceGames, 0);
  assert.equal(d.skillSummary.invalidGames, 1);
  assert.equal(d.learning.selected.length, 1);
});
test("different skill payloads on duplicate reviews fail closed", () => {
  const r = row(1),
    other = structuredClone(r);
  other.review.skillEvidence.counts.riskManagement = {
    supported: 0,
    mistakes: 0,
    uncertain: 0,
  };
  r.review.skillEvidence.counts.riskManagement = {
    supported: 0,
    mistakes: 1,
    uncertain: 0,
  };
  const d = build([r, other]);
  assert.equal(d.skillSummary.conflictingGames, 1);
  assert.equal(d.skillSummary.evidenceGames, 0);
});
test("invalid duplicate cannot attach skill evidence to a valid legacy summary", () => {
  const a = row(1, false),
    b = row(1);
  b.review.report.provenGood += 100;
  const d = build([a, b]);
  assert.equal(d.learning.selected.length, 1);
  assert.equal(d.skillSummary.evidenceGames, 0);
  assert.equal(d.skillSummary.invalidGames, 1);
});
test("unknown and missing evidence does not crash other valid reports", () => {
  const a = row(1),
    b = row(2);
  a.review.skillEvidence.version = 99;
  const d = build([null, a, b]);
  assert.equal(d.skillSummary.evidenceGames, 1);
  assert.equal(d.skillSummary.invalidGames, 1);
});
test("new dashboard keeps learning above history and recommendations above charts", () => {
  const ui = readFileSync("components/coach/coach-console.tsx", "utf8");
  assert.ok(
    ui.indexOf("<PersonalizedCoaching") < ui.indexOf('className="coach-practice-card"'),
  );
  const p = readFileSync("components/coach/personalized-coaching.tsx", "utf8");
  assert.ok(
    p.indexOf("<LearningDashboardMetrics") < p.indexOf('className="coach-learning-plan"'),
  );
  assert.ok(
    p.indexOf('className="coach-learning-plan"') < p.indexOf("<LearningDashboardDetail"),
  );
});
test("skill UI preserves null rates and has independently collapsible history", () => {
  const ui = readFileSync("components/coach/learning-dashboard-detail.tsx", "utf8");
  assert.match(ui, /skill\.accuracy !== null/);
  assert.match(ui, /skillSummary\.missingEvidenceGames|skillSummary\.evidenceGames/);
  assert.match(ui, /Detailed game history/);
  assert.match(ui, /Chart legend/);
});
test("server stores counters only after reading owned completed recording; history stays replay free", () => {
  const route = readFileSync("app/api/coach/reports/route.ts", "utf8");
  const get = route.slice(
    route.indexOf("export async function GET"),
    route.indexOf("export async function POST"),
  );
  const post = route.slice(
    route.indexOf("export async function POST"),
    route.indexOf("export async function DELETE"),
  );
  assert.doesNotMatch(get, /collectSkillEvidence\(|replayRecordedGame\(/);
  assert.match(get, /review: row\.review/);
  assert.match(get, /\.eq\("user_id", userId\)/);
  assert.match(post, /readCompletedRankedRecording/);
  assert.match(post, /readPracticeReview/);
  assert.match(post, /skillEvidence: collectSkillEvidence\(analysis\)/);
  assert.match(post, /parseReviewSave\(parsed\.value\)/);
  assert.match(post, /reserve_coaching_review_save/);
});

test("learning details starts closed and contains every secondary coaching section", () => {
  const ui = readFileSync("components/coach/personalized-coaching.tsx", "utf8");
  const start = ui.search(
    /<details\s+className="coach-learning-disclosure coach-learning-more"\s+id="coach-learning-more"\s*>/,
  );
  assert.ok(start > ui.indexOf('className="coach-learning-focus"'));
  assert.ok(start > ui.indexOf("<LearningDashboardMetrics"));
  const end = (() => {
    const offset = ui.slice(start).search(/<\/div>\s*<\/details>\s*<\/div>\s*<\/>/);
    return offset < 0 ? -1 : start + offset;
  })();
  assert.ok(end > start);
  const body = ui.slice(start, end);
  for (const marker of [
    'id="coach-quick-drill"',
    "Your next three games",
    "<LearningDashboardDetail dashboard={dashboard}",
    "How progress is measured",
    "Mistake patterns",
    "Saved reports",
  ])
    assert.ok(body.includes(marker), marker);
  assert.doesNotMatch(body.slice(0, body.indexOf(">") + 1), /\bopen=/);
});
test("quick drill shortcut opens parent before drill and keyboard focus", () => {
  const ui = readFileSync("components/coach/personalized-coaching.tsx", "utf8");
  assert.match(
    ui,
    /drill\.closest<HTMLDetailsElement>\("#coach-learning-more"\);\s*if \(more\) more\.open = true;\s*drill\.open = true;[\s\S]*?querySelector\("summary"\)[\s\S]*?focus\(/,
  );
  assert.match(ui, /open=\{sections\.drill\}/);
  assert.match(ui, /open=\{sections\.saved\}/);
});
test("compact wrapper hides content while closed and preserves keyboard focus", () => {
  const css = readFileSync("styles/batch28e-learning-dashboard.css", "utf8");
  assert.match(
    css,
    /\.coach-learning-more:not\(\[open\]\)\s*>\s*\.coach-learning-more-body\s*\{\s*display:\s*none;\s*\}/,
  );
  assert.match(css, /\.coach-learning-more > summary:focus-visible/);
});
