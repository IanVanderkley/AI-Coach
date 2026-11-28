import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { parseRankedHistoryGrade } from "../lib/ranked/history-grade.ts";
const read = (p) => readFileSync(p, "utf8");
const id = "11111111-1111-4111-8111-111111111111";
const raw = (score, grade) => ({ matchId: id, version: 1, score, grade });
test("history grade accepts every score at the existing coaching boundaries and no extra payload", () => {
  for (let i = 0; i <= 100; i++) {
    const grade = i >= 90 ? "S" : i >= 78 ? "A" : i >= 65 ? "B" : i >= 50 ? "C" : "D";
    assert.deepEqual(
      parseRankedHistoryGrade({ ...raw(i, grade), mine_positions: [0], moves: [] }, id),
      raw(i, grade),
    );
  }
  assert.deepEqual(parseRankedHistoryGrade(raw(null, null), id), raw(null, null));
});
test("history grade rejects false or mismatched evidence and version", () => {
  for (const value of [
    null,
    [],
    raw(101, "S"),
    raw(-1, "D"),
    raw(65, "A"),
    raw(null, "S"),
    raw(90, null),
    raw("90", "S"),
    raw(90.1, "S"),
    { ...raw(90, "S"), version: 2 },
    { ...raw(90, "S"), matchId: "other" },
  ])
    assert.throws(() => parseRankedHistoryGrade(value, id));
});
test("grade endpoint reuses completed-recording verification and shared scoring, cache hits before expensive work", () => {
  const route = read("app/api/ranked/coaching/grade/route.ts");
  assert.match(route, /getClaims\(\)/);
  assert.match(route, /ranked_session_is_active/);
  assert.match(route, /guardRankedRateLimit/);
  assert.match(route, /\.eq\("user_id", userId\)\s*\.eq\("match_id", matchId\)/);
  const cached = route.indexOf("if (saved)");
  const reserve = route.search(/admin\.rpc\(\s*"reserve_ranked_history_grade"/);
  assert.ok(cached >= 0 && reserve > cached);
  assert.match(
    route,
    /readCompletedRankedRecording\(\s*createRankedRecordingStore\(admin\),\s*matchId,\s*userId,\s*replayRecordedGame,?\s*\)/,
  );
  assert.match(route, /summarizeVerifiedRankedReview\(result\)/);
  assert.match(route, /private, no-store/);
  assert.doesNotMatch(
    route,
    /Response\.json\(\{\s*\.\.\.result\.data|\/api\/coach["']|ranked_elo_events|player_xp_profiles/,
  );
});
test("grade cache and computation quota are isolated from browser and reward writes", () => {
  const files = readdirSync("supabase/migrations").filter((n) =>
    /^\d+_ranked_history_grades\.sql$/.test(n),
  );
  assert.equal(files.length, 1);
  const sql = read("supabase/migrations/" + files[0]);
  assert.match(sql, /PRIMARY KEY \(match_id, analysis_version\)/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(
    sql,
    /GRANT SELECT, INSERT ON TABLE public\.ranked_history_grades TO service_role/,
  );
  assert.match(sql, /m\.user_id = NEW\.user_id/);
  assert.match(sql, /m\.status = 'lost' OR \(m\.status = 'won'/);
  assert.match(sql, /c\.usage_count < 12/);
  assert.doesNotMatch(
    sql,
    /GRANT .* TO (anon|authenticated)|(?:INSERT INTO|UPDATE) public\.(ranked_elo_events|player_xp_profiles|coaching_reviews)/i,
  );
});
test("automatic Ranked grading is bounded, sequential, cancellable and respects the existing preference", () => {
  const ui = read("components/profile/ranked-history.tsx");
  const coach = read("components/coach/coach-console.tsx");
  assert.match(ui, /!gradeEnabled\s*\|\|\s*!rankedExpanded\s*\|\|\s*summaryOnly/);
  assert.match(ui, /for \(const item of state\.matches\)/);
  assert.match(ui, /await fetch\(\s*`\/api\/ranked\/coaching\/grade\?matchId=/);
  assert.match(ui, /controller\.abort\(\)/);
  assert.match(
    ui,
    /parseRankedHistoryGrade\(\s*await response\.json\(\),\s*item\.matchId,?\s*\)/,
  );
  assert.match(ui, /className="grade-badge"/);
  assert.match(coach, /gradeEnabled=\{gradesReady && autoGrades\}/);
  assert.match(coach, /manualGrades=\{rankedReviewedGrades\}/);
  assert.match(coach, /\[matchId\]: prepared\.review/);
});
