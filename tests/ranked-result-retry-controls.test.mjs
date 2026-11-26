import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (name) => readFileSync(`components/ranked/${name}.tsx`, "utf8");

test("match XP and Elo retry only when a receipt is missing or unavailable", () => {
  for (const name of ["ranked-match-xp-receipt", "ranked-match-rating"]) {
    const source = read(name);
    assert.match(
      source,
      /\{\(state\.kind === "missing" \|\| state\.kind === "unavailable"\) && \(\s*<button/,
    );
    assert.doesNotMatch(source, /state\.kind !== "loading"/);
  }
});

test("account XP automatically loads and retries only after failure", () => {
  const source = read("ranked-xp-progress");
  assert.match(source, /void loadPlayerLevel\(\)/);
  assert.match(
    source,
    /\{state\.kind === "unavailable" && \(\s*<button[\s\S]*?Retry saved XP/,
  );
  assert.match(
    source,
    /\{state\.kind === "ready" && \(\s*<span className="ranked-xp-trust"/,
  );
  assert.doesNotMatch(source, /Refresh saved XP|ranked-xp-disclaimer/);
  assert.match(read("ranked-result-dialog"), /saved lifetime total/);
});
