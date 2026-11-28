/** Emit rollback-only SQL parity checks from the TypeScript reference.
 * Pipe to local psql with ON_ERROR_STOP and shell pipefail. Never use on hosted data.
 */
import {
  calculateRankPolicyV4,
  RANK_POLICY_V4,
} from "../lib/leaderboard/rank-policy-v4.ts";

const ratings = [
  RANK_POLICY_V4.minimum,
  RANK_POLICY_V4.minimum + 1,
  -1000000,
  ...Array.from({ length: 12001 }, (_, index) => index - 2000),
];
const tuples = ratings.flatMap((rating) =>
  ["won", "lost"].map((outcome) => {
    const expected = calculateRankPolicyV4(rating, outcome);
    return `(${rating},'${outcome}',${expected.rating},${expected.delta},${expected.nominalDelta},${expected.demotionProtected})`;
  }),
);
console.log(`BEGIN;
SET LOCAL statement_timeout = '30s';
CREATE TEMP TABLE expected_v4 (
  rating_before integer, outcome text, rating_after integer, rating_delta integer,
  nominal_delta integer, demotion_protected boolean,
  PRIMARY KEY (rating_before, outcome)
) ON COMMIT DROP;`);
for (let index = 0; index < tuples.length; index += 500) {
  console.log(
    `INSERT INTO expected_v4 VALUES\n${tuples.slice(index, index + 500).join(",\n")};`,
  );
}
console.log(`DO $checks$
DECLARE
  mismatch record;
  actual_count integer;
  fn oid := pg_catalog.to_regprocedure('ranked_internal.calculate_rating_v4(integer,text)');
BEGIN
  IF fn IS NULL THEN RAISE EXCEPTION 'Missing v4 calculation'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid = fn AND (prosecdef OR provolatile <> 'i'))
    THEN RAISE EXCEPTION 'Function must be immutable and security invoker'; END IF;
  IF pg_catalog.has_function_privilege('anon',fn,'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated',fn,'EXECUTE')
     OR pg_catalog.has_function_privilege('service_role',fn,'EXECUTE')
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p,
       LATERAL pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f',p.proowner))) a
       WHERE p.oid=fn AND a.grantee=0 AND a.privilege_type='EXECUTE')
    THEN RAISE EXCEPTION 'Unexpected v4 execute permission'; END IF;
  SELECT count(*) INTO actual_count FROM expected_v4 e
    CROSS JOIN LATERAL ranked_internal.calculate_rating_v4(e.rating_before,e.outcome) a;
  IF actual_count <> ${tuples.length} THEN RAISE EXCEPTION 'Wrong parity row count: %', actual_count; END IF;
  SELECT e.*, a.rating_after AS actual_after, a.rating_delta AS actual_delta,
    a.nominal_delta AS actual_nominal, a.demotion_protected AS actual_protected
  INTO mismatch
  FROM expected_v4 e
  LEFT JOIN LATERAL ranked_internal.calculate_rating_v4(e.rating_before,e.outcome) a ON true
  WHERE (e.rating_after,e.rating_delta,e.nominal_delta,e.demotion_protected)
    IS DISTINCT FROM (a.rating_after,a.rating_delta,a.nominal_delta,a.demotion_protected)
  LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'SQL/TypeScript mismatch: %', row_to_json(mismatch); END IF;
  BEGIN PERFORM ranked_internal.calculate_rating_v4(10001,'won');
    RAISE EXCEPTION 'Invalid rating accepted'; EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  BEGIN PERFORM ranked_internal.calculate_rating_v4(NULL,'won');
    RAISE EXCEPTION 'Null rating accepted'; EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  BEGIN PERFORM ranked_internal.calculate_rating_v4(1500,NULL);
    RAISE EXCEPTION 'Null outcome accepted'; EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  BEGIN PERFORM ranked_internal.calculate_rating_v4(1500,'abandoned');
    RAISE EXCEPTION 'Invalid outcome accepted'; EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  IF pg_catalog.to_regprocedure('ranked_internal.rating_delta_v3(integer,text)') IS NULL
    OR (SELECT prosrc FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('ranked_internal.apply_verified_match_rating(uuid)'))
        NOT LIKE '%ranked_internal.rating_delta_v3(v_rating, v_match.status)%'
    OR pg_catalog.to_regprocedure('ranked_internal.apply_verified_match_rating(uuid)') IS NULL
    THEN RAISE EXCEPTION 'Expected active v3 award path'; END IF;
END;
$checks$;
ROLLBACK;
SELECT 'PASS: ${tuples.length} v4 SQL/TypeScript comparisons; private function; v3 award path unchanged' AS result;`);
