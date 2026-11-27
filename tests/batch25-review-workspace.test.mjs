import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  reviewToneSummary,
  explanationLabel,
  reviewProofOptions,
} from "../lib/coach/review-presentation.ts";

const review = {
  good: 2,
  mistakes: 2,
  headline: "Balanced summary",
  grade: "D",
  score: 38,
};
test("three review tones convey the same verified findings without changing grade or counts", () => {
  const original = structuredClone(review);
  const encouraging = reviewToneSummary(review, "encouraging");
  const direct = reviewToneSummary(review, "direct");
  assert.match(encouraging, /2 supported decisions/);
  assert.match(encouraging, /2 verified mistakes/);
  assert.match(direct, /2 verified mistakes/);
  assert.equal(reviewToneSummary(review, "balanced"), review.headline);
  assert.equal(new Set([encouraging, direct, review.headline]).size, 3);
  assert.deepEqual(review, original);
});
test("no evidence never creates praise, blame, or a grade", () => {
  const empty = { good: 0, mistakes: 0, headline: "Not enough evidence", score: null };
  assert.match(reviewToneSummary(empty, "encouraging"), /not enough evidence/);
  assert.match(reviewToneSummary(empty, "direct"), /without a grade/);
});
test("singular and plural findings use readable grammar", () => {
  assert.match(
    reviewToneSummary({ ...review, good: 1, mistakes: 1 }, "encouraging"),
    /1 supported decision\. Build/,
  );
  assert.match(
    reviewToneSummary({ ...review, good: 1, mistakes: 1 }, "direct"),
    /1 verified mistake\./,
  );
});
test("all detail levels retain on-demand proof, with technical arithmetic opened only for detailed", () => {
  for (const detail of ["brief", "standard", "detailed"]) {
    assert.deepEqual(reviewProofOptions(detail), {
      expanded: false,
      technical: detail === "detailed",
    });
    assert.equal(explanationLabel(detail), `${detail} explanations`);
  }
});
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
test("only the selected move workspace renders full teaching proofs; lesson cards jump to that move", () => {
  const replay = read("components/coach/verified-replay-panel.tsx");
  const lessons = read("components/coach/evidence-coach-panel.tsx");
  assert.equal((replay.match(/<TeachingProof\b/g) ?? []).length, 1);
  assert.doesNotMatch(lessons, /<TeachingProof\b/);
  assert.match(replay, /technical=\{proofOptions\.technical\}/);
  assert.match(lessons, /onReviewMove\(moment\.moveNumber\)/);
  assert.doesNotMatch(replay, /className="verified-totals"/);
  assert.doesNotMatch(lessons, /<summary>Decision totals<\/summary>/);
});
test("overview and replay use the same preference-ranked lesson while timeline navigation remains intact", () => {
  const console = read("components/coach/coach-console.tsx");
  const replay = read("components/coach/verified-replay-panel.tsx");
  assert.match(console, /prioritizeMoments\(selection\.analysis\.report, preferences\)/);
  assert.match(console, /focus=\{suggestedLesson\}/);
  assert.match(replay, /prioritizeMoments\(analysis\.report, preferences\)/);
  assert.match(replay, /moment\.moveNumber - start - 1/);
  assert.match(replay, /aria-label="Replay timeline"/);
  assert.match(replay, /\["before", "after", "compare"\]/);
});
