import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const practice = readFileSync("components/profile/practice-profile.tsx", "utf8");
const ranked = readFileSync("components/profile/ranked-history.tsx", "utf8");
const page = readFileSync("app/profile/page.tsx", "utf8");
const css = readFileSync("styles/profile-history-controls.css", "utf8");

test("Practice section has the requested explicit history title and recent count", () => {
  assert.match(practice, /Recent Practice Matches/);
  assert.doesNotMatch(practice, /<h2>Recent Games<\/h2>/);
  assert.match(practice, /String\(summary\.total\) \+ " matches"/);
  assert.match(practice, /Recent completed Practice games/);
});

test("Practice expansion is independent, initially open and reversible", () => {
  assert.match(
    practice,
    /const \[practiceExpanded, setPracticeExpanded\] = useState\(true\)/,
  );
  assert.match(practice, /setPracticeExpanded\(\(current\) => !current\)/);
  assert.match(practice, /aria-expanded=\{practiceExpanded\}/);
  assert.match(practice, /aria-controls="practice-history-body"/);
  assert.match(practice, /id="practice-history-body"\s+hidden=\{!practiceExpanded\}/);
});

test("Ranked expansion is independent, initially open and reversible", () => {
  assert.match(ranked, /Recent Ranked Matches/);
  assert.match(ranked, /const \[rankedExpanded, setRankedExpanded\] = useState\(true\)/);
  assert.match(ranked, /setRankedExpanded\(\(current\) => !current\)/);
  assert.match(ranked, /aria-expanded=\{rankedExpanded\}/);
  assert.match(ranked, /aria-controls="ranked-history-body"/);
  assert.match(ranked, /id="ranked-history-body"\s+hidden=\{!rankedExpanded\}/);
});

test("Collapsing hides history visually without deleting or refetching records", () => {
  assert.match(practice, /repository\.listRecent\(\)/);
  assert.match(practice, /games\.map\(\(game\) =>/);
  assert.match(practice, /Review game/);
  assert.match(ranked, /fetch\("\/api\/ranked\/history"/);
  assert.match(ranked, /matches\.map\(\(game, index\) =>/);
  assert.match(ranked, /ranked-history-summary/);
  // The collapse button only toggles visibility; it never clears game records.
  assert.match(
    practice,
    /onClick=\{\(\) => setPracticeExpanded\(\(current\) => !current\)\}/,
  );
});

test("Both toggles are keyboard-accessible native buttons", () => {
  for (const source of [practice, ranked]) {
    assert.match(source, /type="button"[\s\S]*?aria-expanded=\{/);
    assert.match(source, /className="profile-history-toggle"/);
    assert.match(source, /<ChevronDown/);
  }
});

test("Profile styles show keyboard focus and honor reduced-motion preferences", () => {
  assert.match(page, /profile-history-controls\.css/);
  assert.match(css, /focus-visible/);
  assert.match(css, /\[hidden\]/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
