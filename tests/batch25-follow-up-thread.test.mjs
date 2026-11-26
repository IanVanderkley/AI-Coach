import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  appendThreadAnswer,
  FOLLOW_UP_THREAD_LIMIT,
  resolveThreadQuestion,
  restoreFollowUpThread,
  serializeFollowUpThread,
} from "../lib/coach/follow-up-thread.ts";
const report = {
  moments: [
    {
      id: "move-4",
      moveNumber: 3,
      location: "row 1, column 5",
      kind: "mistake",
      category: "Flagged a proven-safe square",
      finding: "The square was proven safe.",
      evidence: "1 minus 1 equals 0.",
      nextTime: "Remove the flag.",
    },
    {
      id: "move-5",
      moveNumber: 4,
      location: "row 2, column 5",
      kind: "mistake",
      category: "Opened a proven mine",
      finding: "The chord opened a proven mine.",
      evidence: "One unresolved square contained one mine.",
      nextTime: "Check the flags before chording.",
    },
  ],
};
const answer = (id = "move-4", question = "Why was this a mistake?") => {
  const result = resolveThreadQuestion(report, id, question);
  assert.equal(result.supported, true);
  return result.answer;
};
test("multiple questions retain separate move IDs, display numbers and approved findings", () => {
  let thread = appendThreadAnswer([], answer());
  thread = appendThreadAnswer(thread, answer("move-5", "What should I try next time?"));
  assert.deepEqual(
    thread.map((a) => a.moveNumber),
    [3, 4],
  );
  assert.ok(thread[1].paragraphs.includes(report.moments[1].nextTime));
  assert.deepEqual(
    restoreFollowUpThread(report, serializeFollowUpThread(thread)),
    thread,
  );
});
test("legacy single-question tab entry is restored and regenerated", () => {
  assert.deepEqual(
    restoreFollowUpThread(
      report,
      JSON.stringify({
        momentId: "move-4",
        question: "Why was this a mistake?",
        paragraphs: ["forged answer"],
      }),
    ),
    [answer()],
  );
});
test("thread keeps the latest bounded set of answers", () => {
  const all = Array.from({ length: 20 }, (_, i) =>
    answer("move-4", `Why was this a mistake? ${i}`),
  );
  const thread = all.reduce(appendThreadAnswer, []);
  assert.equal(thread.length, FOLLOW_UP_THREAD_LIMIT);
  assert.deepEqual(thread, all.slice(-FOLLOW_UP_THREAD_LIMIT));
  assert.equal(
    restoreFollowUpThread(report, JSON.stringify(all)).length,
    FOLLOW_UP_THREAD_LIMIT,
  );
});
test("malformed and stale stored entries cannot create answers", () => {
  assert.deepEqual(restoreFollowUpThread(report, "{"), []);
  assert.deepEqual(
    restoreFollowUpThread(
      report,
      JSON.stringify([
        null,
        { momentId: "move-999", question: "Why was this wrong?" },
        { momentId: "move-4", question: 42 },
      ]),
    ),
    [],
  );
  assert.deepEqual(
    restoreFollowUpThread({ moments: [] }, serializeFollowUpThread([answer()])),
    [],
  );
});
test("conflicting displayed move numbers and unsupported probability questions are rejected", () => {
  assert.equal(
    resolveThreadQuestion(report, "move-4", "Why was move 4 wrong?").supported,
    false,
  );
  assert.equal(
    resolveThreadQuestion(report, "move-4", "What was the probability of losing?")
      .supported,
    false,
  );
  assert.equal(
    resolveThreadQuestion(report, "move-4", "Why was move 3 wrong?").supported,
    true,
  );
});
test("storage contains question and move ID only, not proof data or answer text", () => {
  assert.deepEqual(JSON.parse(serializeFollowUpThread([answer()])), [
    { momentId: "move-4", question: "Why was this a mistake?" },
  ]);
});
test("UI keeps the form available and only jumps to replay on an explicit button", () => {
  const ui = readFileSync(
    new URL("../components/coach/verified-follow-up.tsx", import.meta.url),
    "utf8",
  );
  assert.match(ui, /<form onSubmit=\{submit\}/);
  assert.match(ui, /onClick=\{\(\) => onReviewMove\(answer.moveNumber\)\}/);
  assert.doesNotMatch(
    ui.slice(ui.indexOf("function submit("), ui.indexOf("function clearThread(")),
    /onReviewMove|fetch\(/,
  );
  assert.match(ui, /sessionStorage.removeItem\(storageKey\)/);
  assert.doesNotMatch(ui, /fetch\(/);
});
