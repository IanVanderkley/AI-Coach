import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sql = readFileSync(
  new URL(
    "../supabase/migrations/20261125050118_account_deletion_email_verification.sql",
    import.meta.url,
  ),
  "utf8",
).toLowerCase();

test("deletion challenge data cascades with the account and is server-only", () => {
  assert.match(sql, /references auth\.users\(id\) on delete cascade/);
  assert.match(sql, /enable row level security/);
  assert.match(
    sql,
    /revoke all on table[^;]+from public, anon, authenticated, service_role/,
  );
  assert.match(sql, /grant select, insert, update on table[^;]+to service_role/);
  assert.doesNotMatch(sql, /security definer/);
  for (const name of ["issue", "consume", "cancel"]) {
    assert.match(
      sql,
      new RegExp(
        `revoke all on function public\\.${name}_account_deletion_challenge[^;]+from public, anon, authenticated, service_role`,
      ),
    );
    assert.match(
      sql,
      new RegExp(
        `grant execute on function public\\.${name}_account_deletion_challenge[^;]+to service_role`,
      ),
    );
  }
});

test("issuance locks the account row and uses database-enforced rolling limits", () => {
  assert.match(sql, /on conflict \(user_id\) do nothing/);
  assert.match(sql, /for update/);
  assert.match(sql, /interval '1 hour'/);
  assert.match(sql, /cardinality\(v_recent\) >= 5/);
  assert.match(sql, /interval '60 seconds'/);
  assert.match(sql, /interval '10 minutes'/);
});

test("verification is scoped to the account, session, address, and challenge", () => {
  const consume = sql
    .split("create function public.consume_account_deletion_challenge")[1]
    .split("create function public.cancel_account_deletion_challenge")[0];
  assert.match(consume, /where user_id = p_user_id for update/);
  for (const field of ["challenge_id", "session_id", "email"]) {
    assert.match(consume, new RegExp(`v_row\\.${field} is distinct from p_${field}`));
  }
  assert.match(consume, /v_row\.expires_at <= clock_timestamp\(\)/);
  assert.match(
    consume,
    /v_row\.code_digest = p_code_digest[\s\S]*?code_digest = null[\s\S]*?return 'consumed'/,
  );
  assert.match(
    consume,
    /v_attempts >= 5[\s\S]*?code_digest = null[\s\S]*?return 'locked'/,
  );
});

test("cancellation preserves resend history and cannot affect another session", () => {
  const cancel = sql
    .split("create function public.cancel_account_deletion_challenge")[1]
    .split("revoke all on function")[0];
  assert.match(
    cancel,
    /where user_id = p_user_id and challenge_id = p_challenge_id and session_id = p_session_id/,
  );
  assert.doesNotMatch(cancel, /request_times\s*=/);
  assert.match(cancel, /code_digest = null/);
});
