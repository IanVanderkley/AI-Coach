import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = p => readFileSync(new URL("../"+p, import.meta.url), "utf8");
test("comparison uses real board dimensions and container width while preserving square cells and scroll access",()=>{
  const ui=read("components/coach/verified-replay-panel.tsx"), css=read("styles/coaching-replay-polish.css");
  assert.match(ui,/data-comparison=\{game\.columns <= 16 \? "side-by-side" : "stacked"\}/);
  assert.match(ui,/"--replay-columns": columns/);
  assert.match(ui,/repeat\(\$\{columns\}, var\(--replay-cell-size, 36px\)\)/);
  assert.match(css,/@container replay-comparison \(min-width: 800px\)/);
  assert.match(css,/\[data-comparison="side-by-side"\]:not\(\.single-board\)/);
  assert.match(css,/100cqi - 40px - 2px \* var\(--replay-columns\)/);
  assert.match(css,/width: var\(--replay-cell-size\);\s*height: var\(--replay-cell-size\);/);
  assert.match(css,/max-height: none;/);
  assert.match(ui,/showProofs \? current\.deductions\.safe : \[\]/);
});
test("FAQ holds exact scoring and uncertainty caveats without obsolete review disclosures",()=>{
  const faq=read("docs/FAQ-COACHING-CONTENT.md");
  assert.match(faq,/60% of the score is board completion\. 40% is the share of provable decisions that were good/);
  assert.match(faq,/If no later decision can be proved, no score is shown/);
  assert.match(faq,/Uncertain moves are not automatically mistakes or unavoidable guesses/);
  assert.doesNotMatch(read("components/coach/review-overview.tsx"),/How the score is calculated|sections\.score/);
  assert.doesNotMatch(read("components/coach/verified-replay-panel.tsx"),/How moves are assessed/);
  assert.match(read("components/settings/replay-tooltip-setting.tsx"),/key !== "score"/);
});
