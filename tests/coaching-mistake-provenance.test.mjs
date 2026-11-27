// The post-game report must explain WHY a move was wrong, using only the
// numbers the player could see. These tests pin the clue arithmetic included
// in the explanations, so a future refactor cannot downgrade the coaching back
// to "you guessed while a safe square existed" without a reason.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function moduleUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}

function compiledModule(path, replacements = []) {
  let source = readFileSync(new URL(path, import.meta.url), "utf8");
  for (const [before, after] of replacements) {
    assert.ok(source.includes(before), `Expected import not found in ${path}`);
    source = source.replace(before, after);
  }
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return moduleUrl(compiled);
}

const boardUrl = compiledModule("../lib/coach/board.ts");
const analysisUrl = compiledModule("../lib/coach/analyze.ts", [
  ['from "./board"', `from "${boardUrl}"`],
]);

const { analyzeGameplay, toRuleReport } = await import(analysisUrl);

// 3 × 3, one mine at index 0 (top-left). Revealing the centre and the top-middle
// makes their two "1" clues overlap. Subtracting those groups proves the whole
// bottom row safe, so the player had a guaranteed-safe move before clicking.
function overlappingCluesGame(moves, outcome) {
  return {
    game: "minesweeper",
    difficulty: "Beginner",
    rows: 3,
    columns: 3,
    mineCount: 1,
    outcome,
    mines: [0],
    moves,
  };
}

const opening = [{ row: 1, col: 1, action: "reveal" }];
const overlapping = [...opening, { row: 0, col: 1, action: "reveal" }];

test("an avoidable fatal guess names the clues and the safe square", () => {
  const analysis = analyzeGameplay(
    overlappingCluesGame([...overlapping, { row: 0, col: 0, action: "reveal" }], "loss"),
  );

  assert.equal(analysis.metrics.avoidableGuesses, 1);
  assert.equal(analysis.mistakes.length, 1);
  const [mistake] = analysis.mistakes;
  assert.equal(mistake.kind, "fatal-guess");
  assert.equal(mistake.moveNumber, 3);
  assert.deepEqual(mistake.betterMove, { row: 2, col: 0 });

  // The proof is the subtraction between the centre 1 and the top-middle 1.
  assert.match(mistake.why, /row 2, column 2/);
  assert.match(mistake.why, /row 1, column 2/);
  assert.match(mistake.why, /row 3, column 1/);
  assert.match(mistake.why, /safe/i);

  const clueSquares = mistake.clues.map((clue) => `${clue.row},${clue.col}`).sort();
  assert.deepEqual(clueSquares, ["0,1", "1,1"]);

  assert.match(mistake.fix, /row 3, column 1/);
  assert.match(
    analysis.keyMoment?.why ?? "",
    /row 2, column 2/,
    "the key moment should carry the same clue arithmetic",
  );
  assert.ok(
    analysis.improvements.some((line) => line.includes("row 2, column 2")),
    "the summary improvement should carry the same board arithmetic",
  );

  const report = toRuleReport(analysis);
  assert.equal(report.mistakes.length, 1);
  assert.equal(report.mistakes[0].why, mistake.why);
});

test("an unresolved guess is never blamed as a proven mistake", () => {
  const analysis = analyzeGameplay(
    overlappingCluesGame([...opening, { row: 0, col: 0, action: "reveal" }], "loss"),
  );

  assert.equal(analysis.metrics.forcedGuesses, 2);
  assert.equal(analysis.metrics.avoidableGuesses, 0);
  assert.deepEqual(analysis.mistakes, []);
  assert.match(analysis.keyMoment?.description ?? "", /remain uncertain/);
  assert.doesNotMatch(analysis.keyMoment?.description ?? "", /coin flip|50%/);
});

test("a flag on a proven-safe square explains the contradiction", () => {
  const analysis = analyzeGameplay(
    overlappingCluesGame(
      [...overlapping, { row: 2, col: 0, action: "flag" }],
      "in-progress",
    ),
  );

  assert.equal(analysis.metrics.wrongFlags, 1);
  assert.equal(analysis.mistakes.length, 1);
  const [mistake] = analysis.mistakes;
  assert.equal(mistake.kind, "wrong-flag");
  assert.match(mistake.why, /already proven safe/);
  assert.match(mistake.why, /row 2, column 2/);
  assert.ok(mistake.clues.length > 0, "the proving clues should be listed");
  assert.match(mistake.fix, /Remove the flag/);
});

test("incorrect but unproven flag is hindsight, not a graded mistake", () => {
  const wrong = analyzeGameplay(
    overlappingCluesGame([...opening, { row: 0, col: 1, action: "flag" }], "in-progress"),
  );
  const right = analyzeGameplay(
    overlappingCluesGame([...opening, { row: 0, col: 0, action: "flag" }], "in-progress"),
  );
  assert.equal(wrong.metrics.wrongFlags, 1);
  assert.equal(right.metrics.correctFlags, 1);
  assert.equal(wrong.score, right.score);
  assert.deepEqual(wrong.mistakes, []);
  assert.ok(wrong.notes.some((note) => note.includes("incorrect in hindsight")));
});

test("proven safe flag is penalized while an unresolved flag is not", () => {
  const withoutFlag = analyzeGameplay(overlappingCluesGame(overlapping, "in-progress"));
  const flagged = analyzeGameplay(
    overlappingCluesGame(
      [...overlapping, { row: 2, col: 0, action: "flag" }],
      "in-progress",
    ),
  );
  assert.equal(flagged.mistakes.length, 1);
  assert.ok(flagged.score < withoutFlag.score);
});

test("fatal avoidable guess is not duplicated in the improvement summary", () => {
  const analysis = analyzeGameplay(
    overlappingCluesGame([...overlapping, { row: 0, col: 0, action: "reveal" }], "loss"),
  );
  assert.equal(analysis.improvements.filter((line) => /move 3/i.test(line)).length, 1);
});

test("reveal and chord actions share the guess-rate denominator", () => {
  const analysis = analyzeGameplay(
    overlappingCluesGame(
      [
        ...opening,
        { row: 0, col: 0, action: "flag" },
        { row: 1, col: 1, action: "chord" },
      ],
      "win",
    ),
  );
  assert.equal(analysis.metrics.chords, 1);
  assert.equal(
    analysis.metrics.guessRate,
    analysis.metrics.guesses / (analysis.metrics.reveals + analysis.metrics.chords),
  );
  assert.ok(analysis.metrics.guessRate <= 1);
});

test("without a mine layout no invented mistake explanations are produced", () => {
  const analysis = analyzeGameplay({
    game: "minesweeper",
    rows: 3,
    columns: 3,
    mineCount: 1,
    outcome: "win",
    moves: [{ row: 1, col: 1, action: "reveal" }],
  });

  assert.equal(analysis.metrics, null);
  assert.deepEqual(analysis.mistakes, []);
});
