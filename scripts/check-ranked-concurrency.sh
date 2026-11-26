#!/usr/bin/env bash
# Local Docker test only. Uses one fresh disposable account; never uses hosted credentials.
set -euo pipefail
container=supabase_db_Ai-Coach
sql() { docker exec -i "$container" psql -X -qAt -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
[[ $(sql -c 'SELECT version() IS NOT NULL') == t ]]
fixture=$(sql -c 'SELECT gen_random_uuid()')
[[ $fixture =~ ^[0-9a-f-]{36}$ ]]
work=$(mktemp -d)
pid_a= pid_b=
cleanup() {
  local status=$?
  trap - EXIT
  if [[ -n $pid_a ]]; then wait "$pid_a" || true; fi
  if [[ -n $pid_b ]]; then wait "$pid_b" || true; fi
  if sql -v fixture="$fixture" <<'SQL' > /dev/null
DELETE FROM auth.users WHERE id=:'fixture'::uuid;
SQL
  then
    rm -rf "$work"
    echo 'Disposable fixture cleaned up.'
  else
    echo "Cleanup failed for disposable fixture $fixture; inspect local database only." >&2
    status=1
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Commit only a synthetic local account and an opened board, so two connections can see it.
setup=$(sql -v fixture="$fixture" <<'SQL'
BEGIN;
INSERT INTO auth.users(id,email_confirmed_at) VALUES (:'fixture'::uuid,now());
SELECT public.start_ranked_match(:'fixture'::uuid) AS match \gset
SELECT public.execute_ranked_move(:'fixture'::uuid,:'match'::uuid,'reveal',8,8,0) AS opened \gset
UPDATE public.ranked_matches SET started_at=clock_timestamp()-interval '2 seconds' WHERE id=:'match'::uuid;
SELECT m.id,s.mine_positions[1]/16,s.mine_positions[1]%16
FROM public.ranked_matches m JOIN public.ranked_match_state s ON s.match_id=m.id
JOIN public.ranked_leaderboard_profiles p ON p.user_id=m.user_id
WHERE m.id=:'match'::uuid AND m.user_id=:'fixture'::uuid
AND m.status='active' AND m.move_count=1 AND p.rating=1600 AND p.games=0
AND (:'opened'::jsonb->>'status')='ok';
COMMIT;
SQL
)
IFS='|' read -r match row col <<< "$setup"
[[ $match =~ ^[0-9a-f-]{36}$ && $row =~ ^[0-9]+$ && $col =~ ^[0-9]+$ ]]
app_a="rank-race-a-$fixture"; app_b="rank-race-b-$fixture"
move() {
  local app=$1 hold=$2
  docker exec -i -e "PGAPPNAME=$app" "$container" psql -X -qAt -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -v fixture="$fixture" -v match="$match" -v row="$row" -v col="$col" -v hold="$hold" <<'SQL'
BEGIN;
SET LOCAL statement_timeout='45s';
SET LOCAL ROLE service_role;
SELECT public.execute_ranked_move(:'fixture'::uuid,:'match'::uuid,'reveal',:'row'::integer,:'col'::integer,1) AS result \gset
SELECT (:'result'::jsonb->>'status') || ':' || coalesce(:'result'::jsonb->'result'->>'status','none');
SELECT pg_sleep(:'hold'::integer);
COMMIT;
SQL
}
move "$app_a" 15 > "$work/a" 2> "$work/a.err" & pid_a=$!
# Wait until the first connection holds its uncommitted terminal transaction.
ready=f
for i in {1..40}; do
  ready=$(sql -v app="$app_a" <<'SQL'
SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name=:'app' AND wait_event='PgSleep');
SQL
)
  [[ $ready == t ]] && break
  sleep 0.2
done
[[ $ready == t ]] || { echo 'FAIL: first transaction did not enter hold phase.'; exit 1; }
move "$app_b" 0 > "$work/b" 2> "$work/b.err" & pid_b=$!
blocked=f
for i in {1..40}; do
  blocked=$(sql -v a="$app_a" -v b="$app_b" <<'SQL'
SELECT EXISTS(SELECT 1 FROM pg_stat_activity b JOIN pg_stat_activity a ON a.pid=ANY(pg_blocking_pids(b.pid)) WHERE a.application_name=:'a' AND b.application_name=:'b');
SQL
)
  [[ $blocked == t ]] && break
  sleep 0.2
done
wait "$pid_a"; pid_a=
wait "$pid_b"; pid_b=
[[ $blocked == t ]] || { echo 'FAIL: overlapping lock wait was not observed; rerun.'; exit 1; }
grep -Fxq 'ok:lost' "$work/a"
grep -Fxq 'conflict:none' "$work/b"
echo 'PASS: competing request actually blocked on first transaction.'
echo 'PASS: one terminal loss accepted; competing move rejected.'
check=$(sql -v fixture="$fixture" -v match="$match" <<'SQL'
SELECT EXISTS(SELECT 1 FROM public.ranked_matches WHERE id=:'match'::uuid AND user_id=:'fixture'::uuid AND status='lost' AND move_count=2)
AND (SELECT count(*) FROM public.ranked_match_moves WHERE match_id=:'match'::uuid)=2
AND (SELECT count(*) FROM public.ranked_elo_events WHERE user_id=:'fixture'::uuid)=1
AND EXISTS(SELECT 1 FROM public.ranked_elo_events WHERE match_id=:'match'::uuid AND user_id=:'fixture'::uuid AND outcome='lost' AND policy_version=3 AND rating_before=1600 AND rating_delta=-21 AND rating_after=1579)
AND EXISTS(SELECT 1 FROM public.ranked_leaderboard_profiles WHERE user_id=:'fixture'::uuid AND rating=1579 AND games=1 AND wins=0 AND losses=1)
AND (SELECT count(*) FROM public.player_xp_match_receipts WHERE user_id=:'fixture'::uuid)=1
AND EXISTS(SELECT 1 FROM public.player_xp_match_receipts WHERE match_id=:'match'::uuid AND user_id=:'fixture'::uuid AND outcome='lost' AND amount=17)
AND (SELECT total_xp FROM public.player_xp_profiles WHERE user_id=:'fixture'::uuid)=17
AND NOT EXISTS(SELECT 1 FROM public.ranked_verified_results WHERE match_id=:'match'::uuid);
SQL
)
[[ $check == t ]] || { echo 'FAIL: persisted move, Elo, XP or result counts are incorrect.'; exit 1; }
echo 'PASS: exactly one v3 Elo receipt (-21), one XP receipt (+17), and one terminal move.'
echo 'Ranked concurrency checks passed.'
