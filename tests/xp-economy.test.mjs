import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { isRankedXpReward, parsePracticeXpReceipt } from "../lib/levels/rewards.ts";
const read = (p) => readFileSync(p, "utf8");
const migrations = readdirSync("supabase/migrations").filter((n) =>
  /^\d+_xp_economy\.sql$/.test(n),
);
assert.equal(migrations.length, 1);
const sql = read("supabase/migrations/" + migrations[0]);
test("new and historical Ranked receipts are valid only for the matching outcome", () => {
  for (const n of [125, 210]) assert.equal(isRankedXpReward("won", n), true);
  for (const n of [10, 17]) assert.equal(isRankedXpReward("lost", n), true);
  for (const n of [10, 17, 209, "210", null])
    assert.equal(isRankedXpReward("won", n), false);
  for (const n of [125, 210, 18, "17", null])
    assert.equal(isRankedXpReward("lost", n), false);
  assert.equal(isRankedXpReward("active", 210), false);
});
test("all six Practice rewards and non-award receipts are checked", () => {
  for (const [difficulty, win, loss] of [
    ["Beginner", 25, 5],
    ["Intermediate", 50, 10],
    ["Expert", 75, 15],
  ]) {
    for (const [outcome, amount] of [
      ["win", win],
      ["loss", loss],
    ]) {
      const r = { difficulty, outcome, amount, reason: "earned" };
      assert.deepEqual(parsePracticeXpReceipt(r), r);
      assert.throws(() => parsePracticeXpReceipt({ ...r, amount: amount + 1 }));
      for (const reason of ["daily_limit", "participation"]) {
        assert.equal(parsePracticeXpReceipt({ ...r, reason, amount: 0 }).amount, 0);
        assert.throws(() => parsePracticeXpReceipt({ ...r, reason }));
      }
    }
  }
  assert.throws(() =>
    parsePracticeXpReceipt({
      difficulty: "Custom",
      outcome: "win",
      reason: "earned",
      amount: 75,
    }),
  );
});
test("Ranked uses the original trusted triggers with expanded exact reward constraints", () => {
  assert.match(sql, /event_type = 'ranked_verified_win' AND amount IN \(125, 210\)/);
  assert.match(sql, /event_type = 'ranked_verified_loss' AND amount IN \(10, 17\)/);
  assert.match(sql, /new\.match_id, new\.user_id, 'ranked_verified_win', 210/);
  assert.match(sql, /new\.match_id, v_match\.user_id, 'ranked_verified_loss', 17/);
  assert.match(sql, /on conflict \(source_match_id\) do nothing/gi);
  assert.doesNotMatch(sql, /UPDATE public\.player_xp_match_receipts SET/i);
});
test("Practice quota and receipt are owner-scoped and depend on first complete recording", () => {
  assert.match(sql, /AFTER INSERT ON practice_stats_internal\.recorded_games/);
  assert.match(sql, /NEW\.user_id IS DISTINCT FROM auth\.uid\(\)/);
  assert.match(sql, /NEW\.duration_seconds >= 15 AND v_actions >= 3/);
  assert.match(sql, /c\.amount \+ EXCLUDED\.amount <= 300/);
  assert.match(sql, /PRIMARY KEY \(user_id, client_record_id\)/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/g);
  assert.match(
    sql,
    /GRANT SELECT ON public\.player_practice_xp_receipts TO authenticated/,
  );
  assert.match(sql, /USING \(\(SELECT auth\.uid\(\)\) = user_id\)/);
  assert.doesNotMatch(sql, /GRANT (INSERT|UPDATE|ALL).*player_practice_xp_receipts/i);
});
test("UI waits for the actual saved record and displays only read-only receipts", () => {
  const bar = read("components/play/match-xp-bar.tsx");
  const repo = read("lib/levels/repository.ts");
  const page = read("app/page.tsx");
  assert.match(bar, /await saveResult/);
  assert.match(bar, /loadPracticeXpReceipt\(recordId\)/);
  assert.match(bar, /saved\.outcome === expectedOutcome/);
  assert.match(bar, /saved\.difficulty === expectedDifficulty/);
  assert.match(bar, /receipt\.amount\.toLocaleString\(\)/);
  assert.match(repo, /\.from\("player_practice_xp_receipts"\)/);
  assert.match(repo, /\.eq\("client_record_id", recordId\)/);
  assert.match(page, /return saved\.id/);
  assert.match(page, /ai-coach:xp-updated/);
  assert.doesNotMatch(bar, /\.insert\(|\.update\(|\.rpc\(/);
});
