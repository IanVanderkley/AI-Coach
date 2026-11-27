-- Batch 26B.2: inactive private final-guess proof. No award or trigger changes.
BEGIN;
CREATE FUNCTION ranked_internal.final_guess_candidates_v1(p_clues integer[])
RETURNS integer[] LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = ''
AS $proof$
DECLARE
  covered integer[];
  candidates integer[];
  i integer;
  clue integer;
  n integer;
BEGIN
  IF p_clues IS NULL OR array_ndims(p_clues) IS DISTINCT FROM 1
    OR array_lower(p_clues,1) IS DISTINCT FROM 1 OR cardinality(p_clues) <> 256 THEN
    RETURN NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_clues) AS c(value) WHERE value NOT BETWEEN 0 AND 8) THEN
    RETURN NULL;
  END IF;
  SELECT array_agg(s ORDER BY s) INTO covered FROM generate_series(0,255) AS g(s)
    WHERE p_clues[s+1] IS NULL;
  IF cardinality(covered) IS DISTINCT FROM 41 THEN RETURN NULL; END IF;
  candidates := covered;
  FOR i IN 0..255 LOOP
    clue := p_clues[i+1];
    IF clue IS NULL THEN CONTINUE; END IF;
    SELECT count(*)::integer INTO n FROM unnest(covered) AS h(pos)
      WHERE abs(pos/16-i/16)<=1 AND abs(pos%16-i%16)<=1;
    IF clue <> n AND clue <> n-1 THEN RETURN NULL; END IF;
    SELECT array_agg(pos ORDER BY pos) INTO candidates FROM unnest(candidates) AS h(pos)
      WHERE clue = n - CASE WHEN abs(pos/16-i/16)<=1 AND abs(pos%16-i%16)<=1 THEN 1 ELSE 0 END;
    IF candidates IS NULL THEN RETURN NULL; END IF;
  END LOOP;
  IF cardinality(candidates) = 2 THEN RETURN candidates; END IF;
  RETURN NULL;
END;
$proof$;
REVOKE ALL ON FUNCTION ranked_internal.final_guess_candidates_v1(integer[]) FROM PUBLIC, anon, authenticated, service_role;

-- Server-side board adapter. The caller must separately establish the actual
-- recorded direct reveal, match identity, ownership and terminal transition.
-- No flag data: flags are not evidence. Do not call this on an active board
-- from any public RPC or expose the candidate positions to the browser.
CREATE FUNCTION ranked_internal.prove_final_guess_loss_v1(p_mines integer[], p_revealed integer[], p_first integer, p_target integer)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = ''
AS $proof$
DECLARE
  clues integer[];
  pair integer[];
BEGIN
  IF p_mines IS NULL OR p_revealed IS NULL OR p_first IS NULL OR p_target IS NULL
    OR p_first NOT BETWEEN 0 AND 255 OR p_target NOT BETWEEN 0 AND 255
    OR array_ndims(p_mines) IS DISTINCT FROM 1 OR array_ndims(p_revealed) IS DISTINCT FROM 1
    OR array_lower(p_mines,1) IS DISTINCT FROM 1 OR array_lower(p_revealed,1) IS DISTINCT FROM 1
    OR cardinality(p_mines) <> 40 OR cardinality(p_revealed) <> 215
    OR (SELECT count(DISTINCT pos) FROM unnest(p_mines) AS m(pos)) <> 40
    OR (SELECT count(DISTINCT pos) FROM unnest(p_revealed) AS r(pos)) <> 215
    OR EXISTS (SELECT 1 FROM unnest(p_mines) AS m(pos) WHERE pos IS NULL OR pos NOT BETWEEN 0 AND 255)
    OR EXISTS (SELECT 1 FROM unnest(p_revealed) AS r(pos) WHERE pos IS NULL OR pos NOT BETWEEN 0 AND 255 OR pos = ANY(p_mines))
    OR NOT (p_target = ANY(p_mines)) THEN
    RETURN false;
  END IF;
  -- The generator guarantees the opening neighborhood is mine-free and its
  -- first expansion reveals that entire neighborhood. Both possible worlds
  -- must honor this public opening constraint.
  IF EXISTS (SELECT 1 FROM generate_series(0,255) AS g(pos)
    WHERE abs(pos/16-p_first/16)<=1 AND abs(pos%16-p_first%16)<=1
      AND NOT (pos = ANY(p_revealed))) THEN RETURN false; END IF;
  SELECT array_agg(CASE WHEN pos = ANY(p_revealed) THEN
    (SELECT count(*)::integer FROM unnest(p_mines) AS m(mine)
      WHERE abs(mine/16-pos/16)<=1 AND abs(mine%16-pos%16)<=1)
    ELSE NULL END ORDER BY pos) INTO clues FROM generate_series(0,255) AS g(pos);
  pair := ranked_internal.final_guess_candidates_v1(clues);
  RETURN coalesce(p_target = ANY(pair), false);
END;
$proof$;
REVOKE ALL ON FUNCTION ranked_internal.prove_final_guess_loss_v1(integer[],integer[],integer,integer) FROM PUBLIC, anon, authenticated, service_role;
COMMIT;
