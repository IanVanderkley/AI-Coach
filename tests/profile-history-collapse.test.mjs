import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = (path) => readFileSync(path, "utf8");
const practice = read("components/profile/practice-profile.tsx");
const ranked = read("components/profile/ranked-history.tsx");
const coaching = read("components/coach/coach-console.tsx");
const coachPage = read("app/coaching/page.tsx");
const css = read("styles/profile-history-controls.css");

test("Practice match history appears in Coaching, not the statistics dashboard", () => {
  assert.doesNotMatch(practice, /Recent Practice Matches|practice-history-body/);
  assert.match(coaching, /Recent Practice Matches/);
  assert.match(coaching, /className="coach-history-list"/);
});
test("Ranked match history is visible only on the Coaching history screen", () => {
  assert.match(coaching, /<RankedHistory \/>/);
  assert.match(coaching, /Replay\s+coaching\s+currently\s+supports\s+Practice\s+only/);
  assert.match(practice, /summaryOnly/);
  assert.match(ranked, /if \(summaryOnly\) return null/);
});
test("Ranked expansion is independent, initially open and reversible", () => {
  assert.match(ranked, /Recent Ranked Matches/);
  assert.match(ranked, /const \[rankedExpanded, setRankedExpanded\] = useState\(true\)/);
  assert.match(ranked, /setRankedExpanded\(\(current\) => !current\)/);
  assert.match(ranked, /aria-expanded=\{rankedExpanded\}/);
  assert.match(ranked, /aria-controls="ranked-history-body"/);
  assert.match(ranked, /id="ranked-history-body"\s+hidden=\{!rankedExpanded\}/);
});
test("History relocation does not remove stored games or review actions", () => {
  assert.match(practice, /repository\.listRecent\(\)/);
  assert.match(coaching, /games\.map\(\(game\) =>/);
  assert.match(coaching, /Review game/);
  assert.match(ranked, /fetch\("\/api\/ranked\/history"/);
  assert.match(ranked, /matches\.map\(\(game, index\) =>/);
  assert.match(ranked, /ranked-history-summary/);
  assert.match(
    ranked,
    /onRecentMatches\?\.\(state\.kind === "ready" \? state\.matches : null\)/,
  );
});
test("Ranked history toggle remains a keyboard-accessible native button", () => {
  assert.match(ranked, /type="button"[\s\S]*?aria-expanded=\{/);
  assert.match(ranked, /className="profile-history-toggle"/);
  assert.match(ranked, /<ChevronDown/);
});
test("Coaching loads history styles with keyboard focus and reduced motion", () => {
  assert.match(coachPage, /profile-history-controls\.css/);
  assert.match(css, /focus-visible/);
  assert.match(css, /\[hidden\]/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
