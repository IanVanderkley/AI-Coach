import test from "node:test";
import assert from "node:assert/strict";
import {
  collectSkillEvidence,
  buildSkillReview,
  summarizeSkillEvidence,
  SKILL_EVIDENCE_VERSION,
} from "../lib/coach/skill-evidence.ts";
import {
  preparePracticeAnalysis,
  PRACTICE_ANALYSIS_VERSION,
} from "../lib/coach/practice-analysis.ts";
const count = (supported = 0, mistakes = 0, uncertain = 0) => ({
  supported,
  mistakes,
  uncertain,
});
function row(
  id,
  f = count(3, 1, 2),
  r = count(2, 1, 0),
  c = count(),
  risk = count(2, 1, 0),
  unflags = 1,
  extra = {},
) {
  const good = f.supported + r.supported + c.supported,
    mistakes = f.mistakes + r.mistakes + c.mistakes,
    uncertain = f.uncertain + r.uncertain + c.uncertain + unflags;
  return {
    saved: {
      gameRef: `g${id}`,
      mode: "practice",
      difficulty: "Intermediate",
      outcome: "loss",
      completedAt: new Date(Date.UTC(2026, 0, id)).toISOString(),
      version: PRACTICE_ANALYSIS_VERSION,
      review: {
        score: {
          good,
          mistakes,
          uncertain,
          score: good + mistakes ? 70 : null,
          progress: 50,
        },
        report: {
          provenGood: good,
          verifiedMistakes: mistakes,
          uncertainActions: uncertain,
          recordedActions: good + mistakes + uncertain,
        },
        mistakeMoves: {
          "flagged-known-safe": Array.from({ length: f.mistakes }, (_, i) => i + 2),
          "unnecessary-guess": Array.from(
            { length: r.mistakes + c.mistakes },
            (_, i) => i + 2 + f.mistakes,
          ),
          "revealed-known-mine": [],
        },
      },
      ...extra,
    },
    evidence: {
      version: SKILL_EVIDENCE_VERSION,
      counts: { flagging: f, revealing: r, chording: c, riskManagement: risk },
      unflags,
    },
  };
}
const summary = (rows, mode = "practice", difficulty = "Intermediate") =>
  summarizeSkillEvidence(rows, mode, difficulty, 10);
const skill = (s, k) => s.skills.find((x) => x.key === k);
const move = (row, col, action = "reveal") => ({ row, col, action });
function replay(moves) {
  return preparePracticeAnalysis({
    game: "minesweeper",
    difficulty: "Beginner",
    rows: 2,
    columns: 3,
    mineCount: 2,
    mines: [0, 2],
    outcome: "loss",
    durationSeconds: 5,
    moves,
  });
}
test("real completed replay excludes opening and separates supported reveals and proven mine mistake", () => {
  const a = replay([move(1, 0), move(1, 1), move(1, 2), move(0, 0)]);
  const e = collectSkillEvidence(a);
  assert.equal(e.counts.revealing.mistakes, 1);
  assert.equal(e.counts.revealing.supported + e.counts.revealing.uncertain, 2);
  assert.deepEqual(e.counts.flagging, count());
  assert.equal(a.reviewed.length, 3);
});
test("real replay separates supported flags, unflags, and chord actions; no input mutation", () => {
  const a = replay([
    move(1, 0),
    move(1, 1),
    move(1, 2),
    move(0, 0, "flag"),
    move(0, 0, "unflag"),
    move(0, 0),
  ]);
  const before = structuredClone(a);
  const e = collectSkillEvidence(a);
  assert.deepEqual(e.counts.flagging, count(1));
  assert.equal(e.unflags, 1);
  assert.deepEqual(a, before);
  const built = buildSkillReview(a, {
    mode: "practice",
    gameRef: "g",
    completedAt: "2026-01-01T00:00:00Z",
  });
  assert.equal(summary([built], "practice", "Beginner").evidenceGames, 1);
});
test("supported chord counts once even when opening multiple squares", () => {
  const a = preparePracticeAnalysis({
    game: "minesweeper",
    difficulty: "Beginner",
    rows: 2,
    columns: 3,
    mineCount: 2,
    mines: [0, 2],
    outcome: "win",
    durationSeconds: 5,
    moves: [
      move(1, 1),
      move(1, 0),
      move(1, 2),
      move(0, 0, "flag"),
      move(0, 2, "flag"),
      move(1, 1, "chord"),
    ],
  });
  assert.deepEqual(collectSkillEvidence(a).counts.chording, count(1));
});
test("risk denominator only includes reveal/chord opportunities with an unflagged proven-safe covered square", () => {
  const base = {
    changed: true,
    move: { action: "reveal" },
    decision: "mistake",
    before: [{ revealed: false, flagged: false }],
    deductions: { safe: [{ index: 0 }] },
  };
  const e = collectSkillEvidence({
    reviewed: [
      base,
      { ...base, move: { action: "chord" }, decision: "good" },
      { ...base, before: [{ revealed: false, flagged: true }] },
      { ...base, move: { action: "flag" } },
      { ...base, changed: false },
    ],
  });
  assert.deepEqual(e.counts.riskManagement, count(1, 1));
  assert.deepEqual(e.counts.revealing, count(0, 2));
});
test("sample threshold requires at least ten assessed actions across three games", () => {
  const a = summary([row(1), row(2)]);
  assert.equal(skill(a, "flagging").accuracy, null);
  const b = summary([row(1), row(2), row(3)]);
  assert.equal(skill(b, "flagging").accuracy, 75);
  assert.equal(skill(b, "flagging").assessed, 12);
  assert.equal(skill(b, "flagging").observed, 18);
  assert.equal(skill(b, "flagging").assessedGames, 3);
});
test("uncertain flags are not errors; no chord observations is not zero accuracy", () => {
  const a = summary([row(1), row(2), row(3)]);
  assert.equal(skill(a, "flagging").coverage, (100 * 12) / 18);
  assert.equal(skill(a, "chording").accuracy, null);
  assert.equal(skill(a, "chording").coverage, null);
});
test("recurring mistakes require distinct games, not repeated moves in one recording", () => {
  const a = summary([row(1, count(0, 5))]);
  assert.equal(skill(a, "flagging").recurringMistakes, false);
  assert.equal(skill(summary([row(1), row(2)]), "flagging").recurringMistakes, true);
});
test("legacy reports remain in overall analytics without fabricated skill evidence", () => {
  const legacy = row(1);
  delete legacy.evidence;
  const a = summary([legacy, row(2)]);
  assert.equal(a.learning.evidence.games, 2);
  assert.equal(a.evidenceGames, 1);
  assert.equal(a.missingEvidenceGames, 1);
  assert.equal(skill(a, "flagging").assessed, 4);
});
test("duplicate evidence counts once and conflicting evidence is excluded", () => {
  const x = row(1),
    y = structuredClone(x);
  assert.equal(summary([x, y]).evidenceGames, 1);
  y.evidence.counts.riskManagement = count(0, 1);
  const a = summary([x, y]);
  assert.equal(a.conflictingGames, 1);
  assert.equal(a.evidenceGames, 0);
});
test("invalid evidence counters, version and risk subset fail closed", () => {
  const a = row(1),
    b = row(2),
    c = row(3);
  a.evidence.counts.flagging.mistakes = 0;
  b.evidence.version = 0;
  c.evidence.counts.riskManagement.supported = 99;
  const result = summary([a, b, c]);
  assert.equal(result.invalidGames, 3);
  assert.equal(result.evidenceGames, 0);
  assert.equal(result.learning.evidence.games, 3);
});
test("same game reference in another mode cannot contribute skill evidence", () => {
  const a = row(1),
    b = row(1, count(10, 0), count(), count(), count(), 0, { mode: "ranked" });
  const result = summary([a, b]);
  assert.equal(skill(result, "flagging").assessed, 4);
  assert.equal(skill(summary([a, b], "ranked"), "flagging").assessed, 10);
});
test("same review with no assessed actions remains ungraded; contradictory flag counter rejected", () => {
  const a = row(1, count(0, 0, 9), count(), count(), count(), 0);
  assert.equal(skill(summary([a]), "flagging").accuracy, null);
  assert.equal(skill(summary([a]), "flagging").coverage, 0);
  const b = row(2);
  b.evidence.counts.flagging.mistakes = 0;
  b.evidence.counts.revealing.mistakes++;
  assert.equal(summary([b]).invalidGames, 1);
});
