import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sql = readFileSync(
  new URL(
    "../supabase/migrations/20261125061739_restrict_user_preferences_permissions.sql",
    import.meta.url,
  ),
  "utf8",
).replace(/--[^\n]*/g, "");

test("preferences migration removes all client grants before restoring owner operations", () => {
  const revoke =
    /REVOKE\s+ALL PRIVILEGES\s+ON TABLE public\.user_preferences\s+FROM PUBLIC,\s*anon,\s*authenticated\s*;/i;
  const grant =
    /GRANT\s+SELECT,\s*INSERT,\s*UPDATE\s+ON TABLE public\.user_preferences\s+TO authenticated\s*;/i;
  assert.match(sql, revoke);
  assert.match(sql, grant);
  assert.ok(sql.search(revoke) < sql.search(grant));
  assert.equal([...sql.matchAll(/\bGRANT\s+[^;]+;/gi)].length, 1);
  assert.doesNotMatch(sql, /DISABLE ROW LEVEL SECURITY|DROP POLICY|TRUNCATE TABLE/i);
});

test("preferences migration asserts effective grants and RLS in PostgreSQL", () => {
  assert.match(sql, /relrowsecurity/);
  assert.match(
    sql,
    /has_table_privilege\('anon', 'public\.user_preferences', privilege_name\)/,
  );
  assert.match(
    sql,
    /has_table_privilege\('authenticated', 'public\.user_preferences', privilege_name\)/,
  );
  assert.match(
    sql,
    /IS DISTINCT FROM \(privilege_name IN \('SELECT', 'INSERT', 'UPDATE'\)\)/,
  );
  for (const privilege of ["DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"])
    assert.match(sql, new RegExp(`'${privilege}'`));
  assert.match(sql, /RAISE EXCEPTION/);
});
