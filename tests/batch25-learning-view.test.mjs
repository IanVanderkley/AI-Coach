import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  DEFAULT_LEARNING_VIEW,
  LEARNING_VIEW_KEY,
  readLearningView,
  writeLearningView,
} from "../lib/coach/learning-view-preferences.ts";

test("learning view restores filters and expansion, not reports", () => {
  const map = new Map();
  const storage = {
    getItem: (key) => map.get(key),
    setItem: (key, value) => map.set(key, value),
  };
  assert.deepEqual(readLearningView(storage), DEFAULT_LEARNING_VIEW);
  const selected = {
    mode: "practice",
    difficulty: "Beginner",
    windowSize: 25,
    expanded: true,
  };
  writeLearningView(storage, { ...selected, reports: [{ secret: true }] });
  assert.deepEqual(readLearningView(storage), selected);
  assert.deepEqual(JSON.parse(map.get(LEARNING_VIEW_KEY)), selected);
  writeLearningView(storage, { ...selected, mode: "ranked", expanded: false });
  assert.deepEqual(readLearningView(storage), {
    ...selected,
    mode: "ranked",
    expanded: false,
  });
});
test("invalid or blocked preferences fail safely", () => {
  assert.deepEqual(readLearningView({ getItem: () => "broken" }), DEFAULT_LEARNING_VIEW);
  assert.deepEqual(
    readLearningView({
      getItem: () =>
        '{"mode":"bad","difficulty":"bad","windowSize":999,"expanded":"bad"}',
    }),
    DEFAULT_LEARNING_VIEW,
  );
  assert.doesNotThrow(() =>
    writeLearningView(
      {
        setItem() {
          throw Error("blocked");
        },
      },
      DEFAULT_LEARNING_VIEW,
    ),
  );
});
test("saved status is exact, owner scoped and versioned; unsave deletes reports only", () => {
  const route = readFileSync("app/api/coach/reports/route.ts", "utf8");
  const statusStart = route.indexOf("if (params.size > 0 && !cohort)");
  const statusEnd = route.indexOf("const reports:", statusStart);
  assert.ok(statusStart >= 0 && statusEnd > statusStart, "Saved-status branch must exist");
  const status = route.slice(statusStart, statusEnd);
  assert.match(status, /params\.size !== 2/);
  assert.match(status, /parseReviewSave\(/);
  assert.match(status, /getAll\("mode"\)\.length !== 1/);
  assert.match(status, /getAll\("gameRef"\)\.length !== 1/);
  assert.match(status, /getAll\("mode"\)/);
  assert.match(status, /getAll\("gameRef"\)/);
  assert.match(
    status,
    /\.eq\("user_id", userId\)[\s\S]*\.eq\("mode", input.mode\)[\s\S]*\.eq\("game_ref", input.gameRef\)[\s\S]*\.eq\("analysis_version", PRACTICE_ANALYSIS_VERSION\)/,
  );
  const remove = route.slice(route.indexOf("export async function DELETE"));
  assert.match(remove, /readBoundedJson\(request, 1024, true\)/);
  assert.match(remove, /await authorize\(\)/);
  assert.match(remove, /reserve_coaching_review_save/);
  assert.match(
    remove,
    /\.from\("coaching_reviews"\)\s*\.delete\(\)[\s\S]*\.eq\("user_id", userId\)[\s\S]*\.eq\("mode", input.mode\)[\s\S]*\.eq\("game_ref", input.gameRef\)/,
  );
  assert.doesNotMatch(
    remove,
    /practice_games|ranked_matches|ranked_elo_events|player_xp_profiles|\.upsert\(/,
  );
});
test("saved state loads from API; toggle, visible move actions and preliminary drill remain accessible", () => {
  const ui = readFileSync("components/coach/personalized-coaching.tsx", "utf8");
  assert.match(ui, /method: saved \? "DELETE" : "POST"/);
  assert.match(ui, /new URLSearchParams\(\{ mode, gameRef \}\)/);
  assert.match(ui, /aria-pressed=\{saved === true\}/);
  assert.match(ui, /className="coach-saved-reports coach-learning-disclosure"/);
  assert.match(
    ui,
    /className="coach-saved-reports coach-learning-disclosure"\s+open=\{sections.saved\}/,
  );
  assert.match(ui, /Review key move/);
  assert.match(
    ui,
    /onReview\(\s*item.mode,\s*item.gameRef,\s*item.review.report.moments\[0\].moveNumber,?\s*\)/,
  );
  assert.match(ui, /Suggested focus \(one game\)/);
  assert.match(ui, /lead.games >= 2/);
});
