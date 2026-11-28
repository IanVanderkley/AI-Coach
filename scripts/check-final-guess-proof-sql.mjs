/** Emit rollback-only SQL fixtures from the TypeScript proof. LOCAL ONLY. */
import assert from "node:assert/strict";
import { proveFinalFiftyFifty } from "../lib/ranked/final-guess-proof.ts";
const N = 256;
const touching = (a, b) =>
  a !== b &&
  Math.abs((a % 16) - (b % 16)) <= 1 &&
  Math.abs(Math.floor(a / 16) - Math.floor(b / 16)) <= 1;
const opening = [119, 120, 121, 135, 136, 137, 151, 152, 153];
function layout(seed, forced, excluded) {
  const mines = new Set(forced);
  let x = seed >>> 0;
  while (mines.size < 40) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    const i = (x >>> 16) % N;
    if (!excluded.includes(i)) mines.add(i);
  }
  return [...mines].sort((a, b) => a - b);
}
const cluesFor = (mines, safe) =>
  Array.from({ length: N }, (_, i) =>
    mines.includes(i) || i === safe ? null : mines.filter((m) => touching(i, m)).length,
  );
const arr = (a) =>
  a === null
    ? "NULL::integer[]"
    : `ARRAY[${a.map((x) => (x === null ? "NULL" : x)).join(",")}]::integer[]`;
const cases = [];
for (let seed = 1; seed <= 96; seed++) {
  const safe = seed % 2 === 0 ? 0 : 136;
  cases.push(
    cluesFor(layout(seed, safe === 0 ? [1, 2, 18] : [], [safe, ...opening]), safe),
  );
}
const mines = layout(21, [1, 2, 18], [0, ...opening]);
const pair = cluesFor(mines, 0);
assert.deepEqual(proveFinalFiftyFifty(pair), [0, 1]);
const other = mines
  .filter((m) => m !== 1)
  .concat(0)
  .sort((a, b) => a - b);
assert.deepEqual(cluesFor(other, 1), pair);
cases.push(
  pair,
  cluesFor(other, 1),
  cluesFor(layout(11, [], [136, ...opening]), 136),
  cluesFor(layout(31, [1, 2, 16, 17, 18, 32, 33, 34], [0, ...opening]), 0),
);
for (const v of [null, 9, 8]) {
  const bad = [...pair];
  bad[136] = v;
  cases.push(bad);
}
cases.push([], null);
const revealed = Array.from({ length: N }, (_, i) => i).filter(
  (i) => !mines.includes(i) && i !== 0,
);
const revealOther = Array.from({ length: N }, (_, i) => i).filter(
  (i) => !other.includes(i) && i !== 1,
);
const adapters = [
  [mines, revealed, 136, 1, true],
  [other, revealOther, 136, 0, true],
  [mines, revealed, 136, 2, false],
  [mines, revealed, 136, 0, false],
  [mines, revealed.slice(1), 136, 1, false],
  [mines, revealed, 0, 1, false],
  [[...mines.slice(1), mines[1]], revealed, 136, 1, false],
  [mines, [...revealed.slice(1), revealed[1]], 136, 1, false],
  [mines, [...revealed.slice(1), 1], 136, 1, false],
  [null, revealed, 136, 1, false],
  [mines, revealed, null, 1, false],
  [mines, revealed, 136, null, false],
  [mines, revealed, 136, 256, false],
];
console.log(
  "BEGIN;\nCREATE TEMP TABLE proof_cases(id integer, clues integer[], expected integer[]);",
);
console.log(
  "INSERT INTO proof_cases VALUES\n" +
    cases
      .map((c, i) => `(${i + 1},${arr(c)},${arr(proveFinalFiftyFifty(c))})`)
      .join(",\n") +
    ";",
);
console.log(
  "CREATE TEMP TABLE adapter_cases(id integer, mines integer[], revealed integer[], first_cell integer, target integer, expected boolean);",
);
console.log(
  "INSERT INTO adapter_cases VALUES\n" +
    adapters
      .map(
        ([m, r, f, t, e], i) =>
          `(${i + 1},${arr(m)},${arr(r)},${f ?? "NULL"},${t ?? "NULL"},${e})`,
      )
      .join(",\n") +
    ";",
);
console.log(`DO $test$
DECLARE bad integer; role_name text; sig text;
BEGIN
  SELECT id INTO bad FROM proof_cases WHERE ranked_internal.final_guess_candidates_v1(clues) IS DISTINCT FROM expected LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'Visible proof mismatch: %',bad; END IF;
  SELECT id INTO bad FROM adapter_cases WHERE ranked_internal.prove_final_guess_loss_v1(mines,revealed,first_cell,target) IS DISTINCT FROM expected LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'Board adapter mismatch: %',bad; END IF;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    FOREACH sig IN ARRAY ARRAY['ranked_internal.final_guess_candidates_v1(integer[])','ranked_internal.prove_final_guess_loss_v1(integer[],integer[],integer,integer)'] LOOP
      IF has_function_privilege(role_name,sig,'EXECUTE') THEN RAISE EXCEPTION 'Unexpected proof grant: % %',role_name,sig; END IF;
    END LOOP;
  END LOOP;
  IF coalesce((SELECT prosrc FROM pg_proc WHERE oid=to_regprocedure('ranked_internal.apply_verified_match_rating(uuid)')),'') NOT LIKE '%calculate_rating_v4(v_rating, v_match.status)%' THEN RAISE EXCEPTION 'v4 award path changed'; END IF;
  IF (SELECT required_policy_version FROM ranked_internal.release_maintenance WHERE singleton) IS DISTINCT FROM 4 THEN RAISE EXCEPTION 'v4 write guard changed'; END IF;
END;
$test$;
ROLLBACK;
SELECT 'PASS: ${cases.length} visible-board parity cases; ${adapters.length} private board adapter cases; v4 settlement unchanged' AS result;`);
