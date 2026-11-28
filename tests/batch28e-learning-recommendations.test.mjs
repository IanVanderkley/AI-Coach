import test from "node:test";
import assert from "node:assert/strict";
import { recommendLearning } from "../lib/coach/learning-recommendations.ts";
import { PRACTICE_ANALYSIS_VERSION } from "../lib/coach/practice-analysis.ts";
import { LESSONS } from "../lib/coach/personalized-review.ts";
const keys = ["unnecessary-guess", "revealed-known-mine", "flagged-known-safe"];
function row(id, counts = [0, 0, 0], good = 5, uncertain = 2, extra = {}) {
  let n = 2;
  const mistakeMoves = Object.fromEntries(
    keys.map((k, i) => [k, Array.from({ length: counts[i] }, () => n++)]),
  );
  const mistakes = counts.reduce((a, b) => a + b, 0);
  return {
    saved: {
      mode: "practice",
      difficulty: "Intermediate",
      gameRef: `g${id}`,
      completedAt: new Date(Date.UTC(2026, 0, id)).toISOString(),
      outcome: "loss",
      version: PRACTICE_ANALYSIS_VERSION,
      review: {
        score: {
          good,
          mistakes,
          uncertain,
          progress: 50,
          score: good + mistakes ? 60 : null,
        },
        report: {
          provenGood: good,
          verifiedMistakes: mistakes,
          uncertainActions: uncertain,
          recordedActions: good + mistakes + uncertain,
        },
        mistakeMoves,
      },
      ...extra,
    },
  };
}
const recommend = (rows, mode = "practice", difficulty = "Intermediate", window = 10) =>
  recommendLearning(rows, mode, difficulty, window);
test("empty cohort asks for evidence and does not invent a lesson", () => {
  const r = recommend([]);
  assert.equal(r.kind, "collect-evidence");
  assert.equal(r.focus, null);
  assert.equal(r.lesson, null);
  assert.equal(r.evidence.games, 0);
});
test("uncertain actions are not a mistake or a mastery claim", () => {
  const r = recommend([row(1, [0, 0, 0], 0, 100)]);
  assert.equal(r.kind, "collect-evidence");
  assert.match(r.reason, /0 decisions were assessed and 100 remained uncertain/);
});
test("no mistakes with enough evidence encourages reinforcement without claiming mastery", () => {
  const r = recommend([row(1), row(2), row(3)]);
  assert.equal(r.kind, "reinforce");
  assert.equal(r.focus, null);
  assert.equal(r.evidence.assessed, 15);
});
test("a single game with repeated mistakes is not a recurring cross-game pattern", () => {
  const r = recommend([row(1, [9, 0, 0])]);
  assert.equal(r.kind, "single-game-mistake");
  assert.equal(r.focus.games, 1);
  assert.equal(r.focus.occurrences, 9);
});
test("cross-game prevalence outranks a high count in one game", () => {
  const r = recommend([row(1, [20, 1, 0]), row(2, [0, 1, 0])]);
  assert.equal(r.kind, "recurring-mistake");
  assert.equal(r.focus.key, keys[1]);
  assert.equal(r.focus.games, 2);
  assert.equal(r.focus.occurrences, 2);
});
test("frequency breaks equal game counts; safety order breaks exact ties", () => {
  assert.equal(recommend([row(1, [2, 1, 0]), row(2, [2, 1, 0])]).focus.key, keys[0]);
  assert.equal(recommend([row(1, [1, 1, 1])]).focus.key, keys[1]);
  assert.equal(recommend([row(1, [1, 0, 1])]).focus.key, keys[2]);
});
test("lesson and example are traceable to the existing catalog and actual saved moves", () => {
  const r = recommend([row(1, [0, 0, 1]), row(2, [0, 0, 2])]);
  assert.deepEqual(r.focus.example, {
    gameRef: "g2",
    move: 2,
    mode: "practice",
    difficulty: "Intermediate",
  });
  assert.equal(r.lesson.question, LESSONS[keys[2]].question);
  assert.equal(
    r.lesson.options[r.lesson.answer],
    LESSONS[keys[2]].options[LESSONS[keys[2]].answer],
  );
  assert.equal(r.objective.practiceGames, 3);
});
test("cohort, version, conflicts and duplicates cannot inflate focus", () => {
  const a = row(1, [1, 0, 0]);
  const r = recommend([
    a,
    structuredClone(a),
    row(2, [0, 4, 0], 5, 2, { mode: "ranked" }),
    row(3, [0, 4, 0], 5, 2, { difficulty: "Expert" }),
    row(4, [0, 4, 0], 5, 2, { version: 0 }),
    row(5, [0, 4, 0]),
    row(5, [0, 5, 0]),
  ]);
  assert.equal(r.kind, "single-game-mistake");
  assert.equal(r.focus.key, keys[0]);
  assert.equal(r.evidence.games, 1);
  assert.equal(r.exclusions.conflictingGames, 1);
});
test("Ranked examples preserve mode and evaluate comparable Ranked reviews", () => {
  const r = recommend([row(1, [1, 0, 0], 5, 2, { mode: "ranked" })], "ranked");
  assert.equal(r.focus.example.mode, "ranked");
  assert.match(r.objective.evaluation, /Ranked/);
  assert.throws(() => recommend([], "ranked", "Expert"));
});
test("historical comparison uses counts and suppresses short or tied periods", () => {
  const rows = Array.from({ length: 10 }, (_, i) => row(i + 1, [i < 5 ? 2 : 1, 0, 0]));
  const r = recommend(rows);
  assert.deepEqual(r.history, {
    older: { games: 5, affected: 5, occurrences: 10 },
    recent: { games: 5, affected: 5, occurrences: 5 },
  });
  assert.equal(recommend(rows.slice(0, 9)).history, null);
  rows[5].saved.completedAt = rows[4].saved.completedAt;
  assert.equal(recommend(rows).history, null);
});
test("skill context requires sufficient valid evidence; missing summaries do not block a lesson", () => {
  const rows = Array.from({ length: 3 }, (_, i) => {
    const r = row(i + 1, [0, 0, 1], 4, 0);
    r.evidence = {
      version: 1,
      unflags: 0,
      counts: {
        flagging: { supported: 4, mistakes: 1, uncertain: 0 },
        revealing: { supported: 0, mistakes: 0, uncertain: 0 },
        chording: { supported: 0, mistakes: 0, uncertain: 0 },
        riskManagement: { supported: 0, mistakes: 0, uncertain: 0 },
      },
    };
    return r;
  });
  assert.equal(recommend(rows).skillEvidence[0].accuracy, 80);
  assert.equal(recommend(rows.slice(0, 2)).skillEvidence.length, 0);
  delete rows[0].evidence;
  assert.equal(recommend(rows).skillEvidence.length, 0);
  assert.equal(recommend(rows).kind, "recurring-mistake");
});
test("window selection is deterministic and does not mutate source rows or lesson catalog", () => {
  const rows = Array.from({ length: 12 }, (_, i) =>
    row(i + 1, [i < 2 ? 0 : 1, i < 2 ? 100 : 0, 0]),
  );
  const copy = structuredClone(rows);
  const a = recommend(rows),
    b = recommend([...rows].reverse());
  assert.deepEqual(a, b);
  assert.deepEqual(rows, copy);
  assert.equal(a.evidence.games, 10);
  assert.equal(a.focus.key, keys[0]);
  a.lesson.options[0] = "changed";
  assert.notEqual(LESSONS[keys[0]].options[0], "changed");
});
