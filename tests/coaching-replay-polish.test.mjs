import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
test("current decision precedes board comparison, with accessible evidence legend", () => {
  const ui = read("components/coach/verified-replay-panel.tsx");
  assert.ok(
    ui.indexOf('className="verified-decision coach-replay-decision-banner"') <
      ui.indexOf('className="coach-review-workspace"'),
  );
  assert.match(ui, /aria-label="Board symbols"/);
  assert.match(ui, /showProofs \? current\.deductions\.safe : \[\]/);
  assert.match(ui, /safeProofs=\{\[\]\}/);
  assert.match(
    read("docs/FAQ-COACHING-CONTENT.md"),
    /Uncertain moves are not automatically mistakes or unavoidable guesses/,
  );
});
test("proof diagram and explanation share a responsive neutral card without removing technical details", () => {
  const proof = read("components/coach/teaching-proof.tsx"),
    css = read("styles/coaching-replay-polish.css");
  assert.match(proof, /className="coach-proof-split"/);
  assert.match(proof, /<ProofBoard visual=\{visual\} explanation=\{explanation\}/);
  assert.match(proof, /Exact numbers and coordinates/);
  assert.match(css, /@media \(min-width: 850px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(read("app/coaching/page.tsx"), /coaching-replay-polish\.css/);
});
