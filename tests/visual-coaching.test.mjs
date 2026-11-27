import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  coachingLead,
  practicePrompt,
  prioritizeMoments,
  recommendedReveal,
} from "../lib/coach/visual-coaching.ts";
import { buildEvidenceReport } from "../lib/coach/evidence-report.ts";
import { replayRecordedGame } from "../lib/coach/verified-replay.ts";
import { visibleReplayHash } from "../lib/coach/visible-board-hash.ts";

const moment = (id, category, kind, occurrences, moveNumber) => ({
  id,
  category,
  kind,
  occurrences,
  moveNumber,
  action: "reveal",
  location: "row 1, column 1",
  finding: "Original finding",
  evidence: "Original evidence",
  nextTime: "Original lesson",
});
const guess = moment("move-2", "Unnecessary guess", "mistake", 3, 2);
const flag = moment("move-3", "Flagged a proven-safe square", "mistake", 1, 3);
const good = moment("move-4", "Correct logical flag", "good", 9, 4);
const report = { moments: [guess, flag, good] };
const prefs = {
  coachingStyle: "balanced",
  explanationDetail: "standard",
  experienceLevel: "some",
  selectedGoals: [],
  customGoal: "",
  competitiveness: "balanced",
};

test("saved goals change the next verified lesson, not facts or counts", () => {
  const original = structuredClone(report);
  const reordered = prioritizeMoments(report, { ...prefs, selectedGoals: ["flagging"] });
  assert.deepEqual(reordered, [flag, guess, good]);
  assert.equal(reordered[0], flag);
  assert.deepEqual(report, original);
  assert.deepEqual(prioritizeMoments(report, prefs), [guess, flag, good]);
  assert.deepEqual(
    prioritizeMoments(report, { ...prefs, selectedGoals: ["constructor", "__proto__"] }),
    [guess, flag, good],
  );
});
test("tone, experience and competitiveness alter practice wording", () => {
  assert.notEqual(
    coachingLead(guess, { ...prefs, coachingStyle: "direct" }),
    coachingLead(guess, { ...prefs, coachingStyle: "encouraging" }),
  );
  assert.notEqual(
    practicePrompt({ ...prefs, experienceLevel: "new" }),
    practicePrompt({
      ...prefs,
      experienceLevel: "experienced",
      competitiveness: "competitive",
    }),
  );
  assert.match(
    practicePrompt({ ...prefs, competitiveness: "relaxed" }),
    /without worrying about the clock/,
  );
  assert.match(coachingLead(undefined, prefs), /No specific move/);
});
test("recommended reveal is covered, unflagged, proven safe and only for an unnecessary guess", () => {
  const frame = {
    changed: true,
    mistakeType: "unnecessary-guess",
    before: [{ revealed: true }, { flagged: true }, { flagged: false, revealed: false }],
    deductions: { safe: [{ index: 0 }, { index: 1 }, { index: 2 }], mines: [] },
  };
  assert.equal(recommendedReveal(frame), 2);
  assert.equal(recommendedReveal({ ...frame, changed: false }), null);
  assert.equal(recommendedReveal({ ...frame, mistakeType: null }), null);
  assert.equal(
    recommendedReveal({
      ...frame,
      deductions: { safe: [{ index: 0 }, { index: 1 }], mines: [{ index: 2 }] },
    }),
    null,
  );
});

// Leave a safe pocket surrounded by mines so the initial zero reveal cannot win.
// Exercise the genuine board shapes and counts, not a toy square for Expert.
for (const [difficulty, rows, columns, mineCount] of [
  ["Beginner", 9, 9, 10],
  ["Intermediate", 16, 16, 40],
  ["Expert", 16, 30, 99],
]) {
  test(`${difficulty}: replay, checkpoint, visible proof oracle and recommendation integrity`, () => {
    const pocketRow = rows - 2,
      pocketCol = columns - 2;
    const pocket = pocketRow * columns + pocketCol;
    const mines = new Set();
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++)
        if (dr || dc) mines.add((pocketRow + dr) * columns + pocketCol + dc);
    for (let i = rows * columns - 1; mines.size < mineCount; i--)
      if (i !== pocket && !(Math.floor(i / columns) <= 1 && i % columns <= 1))
        mines.add(i);
    const firstMine = [...mines][0];
    const game = {
      game: "minesweeper",
      difficulty,
      rows,
      columns,
      mineCount,
      mines: [...mines],
      outcome: "loss",
      durationSeconds: 2,
      moves: [
        { action: "reveal", row: 0, col: 0, atMs: 0 },
        {
          action: "reveal",
          row: Math.floor(firstMine / columns),
          col: firstMine % columns,
          atMs: 2000,
        },
      ],
    };
    const replay = replayRecordedGame(game);
    assert.equal(replay.status, "lost");
    assert.equal(replay.frames.length, 2);
    assert.equal(replay.frames[0].after[0].adjacentMines, 0);
    assert.equal(replay.frames[0].after[pocket].revealed, false);
    const stamped = {
      ...game,
      moves: game.moves.map((move, i) => ({
        ...move,
        afterHash: visibleReplayHash(replay.frames[i].after, rows, columns),
      })),
    };
    const checked = replayRecordedGame(stamped);
    const evidence = buildEvidenceReport(stamped);
    assert.equal(evidence.recordedActions, 2);
    for (const frame of checked.frames) {
      for (const proof of frame.deductions.safe)
        assert.equal(mines.has(proof.index), false);
      for (const proof of frame.deductions.mines)
        assert.equal(mines.has(proof.index), true);
      const suggestion = recommendedReveal(frame);
      if (suggestion !== null) {
        assert.equal(mines.has(suggestion), false);
        assert.equal(frame.before[suggestion].flagged, false);
        assert.equal(frame.before[suggestion].revealed, false);
      }
    }
    assert.throws(() => buildEvidenceReport({ ...stamped, outcome: "win" }));
    assert.throws(() =>
      buildEvidenceReport({
        ...stamped,
        moves: stamped.moves.map((m, i) =>
          i === 1
            ? { ...m, afterHash: m.afterHash === "00000000" ? "ffffffff" : "00000000" }
            : m,
        ),
      }),
    );
  });
}

test("visual workspace receives saved preferences, leads with replay and gates optional AI", () => {
  const console = readFileSync(
    new URL("../components/coach/coach-console.tsx", import.meta.url),
    "utf8",
  );
  const panel = readFileSync(
    new URL("../components/coach/evidence-coach-panel.tsx", import.meta.url),
    "utf8",
  );
  const replay = readFileSync(
    new URL("../components/coach/verified-replay-panel.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(
    console.indexOf("<VerifiedReplayPanel") < console.indexOf("<EvidenceCoachPanel"),
  );
  assert.match(console, /preferences=\{preferences\}/);
  assert.match(
    console,
    /aiAvailable=\{\s*selection\.mode === "practice"\s*&&\s*status\?\.configured === true\s*&&\s*status\.provider !== null\s*\}/,
  );
  assert.match(panel, /!aiAvailable \|\| loading/);
  assert.match(panel, /detail === "brief"/);
  assert.match(panel, /detail === "detailed"/);
  assert.match(replay, /mode !== "after"/);
  assert.match(replay, /showProofs \? current\.deductions\.safe : \[\]/);
  assert.match(replay, /safeProofs=\{\[\]\}/);
  assert.match(replay, /Replay timeline/);
  assert.match(replay, /cancelAnimationFrame/);
});
