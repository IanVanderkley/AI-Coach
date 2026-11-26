import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("result progress color follows the verified Elo delta, including zero", () => {
  const component = readFileSync("components/ranked/ranked-match-rating.tsx", "utf8");
  const style = readFileSync("styles/ranked-rating.css", "utf8");
  assert.match(
    component,
    /data-rating-change=\{\s*value\.ratingDelta > 0\s*\?\s*"gain"\s*:\s*value\.ratingDelta < 0\s*\?\s*"loss"\s*:\s*"neutral"\s*\}/,
  );
  assert.match(component, /value=\{Math\.round\(model\.after\.progress \* 100\)\}/);
  assert.match(
    style,
    /\.ranked-rating-progress\s*\{\s*--ranked-result-progress-color:\s*#a1a1aa/,
  );
  assert.match(
    style,
    /data-rating-change="gain"\]\s*\{\s*--ranked-result-progress-color:\s*#58c987/,
  );
  assert.match(
    style,
    /data-rating-change="loss"\]\s*\{\s*--ranked-result-progress-color:\s*#ef535e/,
  );
  for (const pseudo of ["::-webkit-progress-value", "::-moz-progress-bar"]) {
    const block = style.split(".ranked-rating-progress progress" + pseudo)[1];
    assert.ok(
      block?.split("}")[0].includes("background: var(--ranked-result-progress-color)"),
    );
  }
});
