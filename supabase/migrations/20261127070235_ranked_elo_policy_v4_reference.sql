-- Batch 26A.2a: inactive, private calculation. No award path or constraint changes.
BEGIN;
CREATE FUNCTION ranked_internal.calculate_rating_v4(p_rating integer, p_outcome text)
RETURNS TABLE (
  rating_after integer,
  rating_delta integer,
  nominal_delta integer,
  demotion_protected boolean
)
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = ''
AS $policy$
DECLARE
  v_win integer;
  v_loss integer;
  v_floor integer;
  v_nominal integer;
  v_raw bigint;
  v_after integer;
  v_protected boolean;
BEGIN
  IF p_rating IS NULL OR p_rating > 10000 OR p_outcome IS NULL
     OR p_outcome NOT IN ('won', 'lost') THEN
    RAISE EXCEPTION 'Invalid rating or outcome' USING ERRCODE = '22023';
  END IF;
  CASE
    WHEN p_rating < 500 THEN v_win := 160; v_loss := 10;
    WHEN p_rating < 1000 THEN v_win := 140; v_loss := 10;
    WHEN p_rating < 1500 THEN v_win := 120; v_loss := 10;
    WHEN p_rating < 2000 THEN v_win := 110; v_loss := 12;
    WHEN p_rating < 2500 THEN v_win := 100; v_loss := 15;
    WHEN p_rating < 3000 THEN v_win := 85; v_loss := 18;
    WHEN p_rating < 3300 THEN v_win := 70; v_loss := 22;
    ELSE v_win := 50; v_loss := 25;
  END CASE;
  v_floor := CASE WHEN p_rating < 100 THEN NULL
                  WHEN p_rating >= 3300 THEN 3300
                  ELSE (p_rating / 100) * 100 END;
  v_nominal := CASE WHEN p_outcome = 'won' THEN v_win ELSE -v_loss END;
  -- Widen before arithmetic to avoid overflow at the signed integer boundary.
  v_raw := p_rating::bigint + v_nominal;
  v_protected := p_outcome = 'lost' AND v_floor IS NOT NULL
    AND p_rating > v_floor AND v_raw < v_floor;
  v_after := greatest(-2147483648::bigint, least(10000::bigint,
    CASE WHEN v_protected THEN v_floor::bigint ELSE v_raw END))::integer;
  RETURN QUERY SELECT v_after, (v_after::bigint - p_rating)::integer, v_nominal, v_protected;
END;
$policy$;
REVOKE ALL ON FUNCTION ranked_internal.calculate_rating_v4(integer,text)
  FROM PUBLIC, anon, authenticated, service_role;
COMMIT;
