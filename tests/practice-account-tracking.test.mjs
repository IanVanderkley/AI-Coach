import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { parsePracticeAccountTotals } from "../lib/profile/practice-account-tracking-core.ts";

const user = "00000000-0000-4000-a000-000000000001";
const other = "00000000-0000-4000-a000-000000000002";
const row = (difficulty = "Beginner", overrides = {}) => ({
  user_id: user,
  difficulty,
  games_played: "3",
  wins: "2",
  losses: "1",
  fastest_win_seconds: 51,
  tracking_activated_at: "2026-11-24T05:00:00Z",
  ...overrides,
});
function source(file) {
  return readFileSync(file, "utf8");
}
const sqlFiles = readdirSync("supabase/migrations").filter((name) =>
  /^\d{14}_practice_account_tracking\.sql$/.test(name),
);
const sql = sqlFiles.length === 1 ? source(`supabase/migrations/${sqlFiles[0]}`) : "";
const ui = source("components/profile/practice-profile.tsx");
const modeCard = source("components/profile/player-mode-card.tsx");
const difficulty = source("components/profile/practice-difficulty-stats.tsx");
const adapter = source("lib/profile/practice-account-tracking.ts");

test("backfilled rows produce correct tracked totals, win rates, and fastest times", () => {
  const tracking = parsePracticeAccountTotals(
    [
      row("Beginner"),
      row("Expert", { games_played: 2, wins: 0, losses: 2, fastest_win_seconds: null }),
    ],
    user,
  );
  assert.deepEqual(tracking.overall, { games: 5, wins: 2, losses: 3, winRate: 40 });
  assert.deepEqual(
    tracking.breakdown.map((x) => x.difficulty),
    ["Beginner", "Intermediate", "Expert"],
  );
  assert.equal(tracking.breakdown[0].fastestWinSeconds, 51);
  assert.equal(tracking.breakdown[1].stats.games, 0);
  assert.equal(tracking.breakdown[2].stats.winRate, 0);
});

test("fresh account returns real zero totals but no fabricated activation date", () => {
  const tracking = parsePracticeAccountTotals([], user);
  assert.deepEqual(tracking.overall, { games: 0, wins: 0, losses: 0, winRate: null });
  assert.equal(tracking.activatedAt, null);
  assert.equal(tracking.breakdown.length, 3);
});

test("owner mismatch and duplicate difficulties fail closed", () => {
  assert.throws(() =>
    parsePracticeAccountTotals([row("Beginner", { user_id: other })], user),
  );
  assert.throws(() => parsePracticeAccountTotals([row(), row()], user));
  assert.throws(() => parsePracticeAccountTotals([row("Master")], user));
  assert.throws(() => parsePracticeAccountTotals({}, user));
  assert.throws(() => parsePracticeAccountTotals([null], user));
});

test("invalid totals and inconsistent counters fail closed", () => {
  for (const values of [
    { games_played: 3, wins: 5 },
    { losses: 0 },
    { games_played: -1 },
    { wins: "1e2" },
    { losses: 1.25 },
    { games_played: "9007199254740992" },
    { fastest_win_seconds: -1 },
    { fastest_win_seconds: null },
    { tracking_activated_at: "bad" },
  ])
    assert.throws(() => parsePracticeAccountTotals([row("Beginner", values)], user));
  assert.throws(() =>
    parsePracticeAccountTotals(
      [row("Beginner", { games_played: 0, wins: 0, losses: 0 })],
      user,
    ),
  );
});

test("valid zero wins, zero-second record, and all three difficulties are supported", () => {
  const emptyLoss = row("Beginner", {
    games_played: 0,
    wins: 0,
    losses: 0,
    fastest_win_seconds: null,
  });
  const fast = row("Intermediate", {
    games_played: 1,
    wins: 1,
    losses: 0,
    fastest_win_seconds: 0,
  });
  const parsed = parsePracticeAccountTotals([emptyLoss, fast, row("Expert")], user);
  assert.equal(parsed.overall.games, 4);
  assert.equal(parsed.breakdown[1].fastestWinSeconds, 0);
});

test("migration uses private ledger with unique owner and client-record identity", () => {
  assert.equal(sqlFiles.length, 1);
  assert.match(sql, /CREATE SCHEMA IF NOT EXISTS practice_stats_internal/);
  assert.match(sql, /CREATE TABLE practice_stats_internal\.recorded_games/);
  assert.match(sql, /PRIMARY KEY \(user_id, client_record_id\)/);
  assert.match(sql, /ON DELETE CASCADE/);
  assert.match(sql, /ON CONFLICT \(user_id, client_record_id\) DO NOTHING/g);
  assert.match(
    sql,
    /REVOKE ALL ON practice_stats_internal\.recorded_games FROM PUBLIC, anon, authenticated/,
  );
});

test("tracked stats are strictly owner-readable and never writable from browser", () => {
  assert.match(
    sql,
    /ALTER TABLE public\.practice_account_totals ENABLE ROW LEVEL SECURITY/,
  );
  assert.match(sql, /GRANT SELECT ON public\.practice_account_totals TO authenticated/);
  assert.match(sql, /USING \(\(SELECT auth\.uid\(\)\) = user_id\)/);
  assert.match(
    sql,
    /REVOKE ALL ON public\.practice_account_totals FROM PUBLIC, anon, authenticated/,
  );
  assert.doesNotMatch(
    sql,
    /GRANT (INSERT|UPDATE|DELETE) ON public\.practice_account_totals/,
  );
});

test("trigger requires the authenticated game owner and complete numbered moves", () => {
  assert.match(sql, /g\.user_id = auth\.uid\(\)/);
  assert.match(sql, /AFTER INSERT OR UPDATE ON public\.practice_game_moves/);
  assert.match(
    sql,
    /move_total <> game_row\.move_count OR earliest <> 1 OR latest <> game_row\.move_count/,
  );
  assert.match(sql, /SECURITY DEFINER[\s\S]*SET search_path = ''/);
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION practice_stats_internal\.record_complete_practice_game/,
  );
  assert.doesNotMatch(sql, /CREATE (OR REPLACE )?FUNCTION public\./);
});

test("new game ledger write and aggregate increment are in the same trigger transaction", () => {
  assert.match(
    sql,
    /INSERT INTO practice_stats_internal\.recorded_games \([\s\S]*?RETURNING user_id, difficulty, outcome, duration_seconds INTO inserted_row/,
  );
  assert.match(
    sql,
    /IF NOT FOUND THEN RETURN NULL; END IF;[\s\S]*INSERT INTO public\.practice_account_totals/,
  );
  assert.match(
    sql,
    /games_played = public\.practice_account_totals\.games_played \+ EXCLUDED\.games_played/,
  );
  assert.match(
    sql,
    /LEAST\(public\.practice_account_totals\.fastest_win_seconds, EXCLUDED\.fastest_win_seconds\)/,
  );
});

test("baseline only backfills complete stored history, not deleted or guessed matches", () => {
  assert.match(sql, /LOCK TABLE public\.practice_games, public\.practice_game_moves/);
  assert.match(sql, /WHERE moves\.move_total = g\.move_count/);
  assert.match(sql, /moves\.earliest = 1/);
  assert.match(sql, /moves\.latest = g\.move_count/);
  assert.doesNotMatch(
    sql,
    /UPDATE public\.practice_games|DELETE FROM public\.practice_games|player_xp_profiles|ranked_matches/,
  );
});

test("account totals are read only through signed-in owner-scoped Supabase RLS", () => {
  assert.match(adapter, /auth\.getUser\(\)/);
  assert.match(adapter, /\.from\("practice_account_totals"\)/);
  assert.match(adapter, /\.eq\("user_id", auth\.user\.id\)/);
  assert.doesNotMatch(adapter, /\.insert\(|\.upsert\(|\.update\(|\.rpc\(/);
});

test("dashboard upgrades only available tracked account data, not guest or unavailable", () => {
  assert.match(ui, /storageMode === "account" \? practiceTracking : null/);
  assert.match(ui, /trackedOverallStats \?\? overallStats/);
  assert.match(
    ui,
    /combineRecentStats\(accountPracticeTracking\.overall, rankedLifetime\)/,
  );
  assert.match(ui, /Tracked account results/);
  assert.match(ui, /not server-verified/);
  assert.match(ui, /<RankedHistory onRecentMatches=\{setRankedMatches\}/);
});

test("mode and difficulty cards keep tracked and recent Practice scopes explicit", () => {
  assert.match(modeCard, /ACCOUNT-RECORDED TRACKED/);
  assert.match(modeCard, /"tracked"/);
  assert.match(difficulty, /Tracked account games/);
  assert.match(difficulty, /scope === "tracked"/);
  assert.match(ui, /scope=\{accountPracticeTracking \? "tracked" : "recent"\}/);
});
