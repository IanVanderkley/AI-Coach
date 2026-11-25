-- Batch 22G.1: combine admission and the existing revision-checked move.
-- Additive migration: all existing RPCs remain available for the deployed API.
BEGIN;

CREATE FUNCTION public.execute_ranked_move(
  p_user_id uuid, p_match_id uuid, p_action text, p_row integer,
  p_column integer, p_expected_move_count integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_admitted boolean;
  v_first_move_done boolean;
  v_move_count integer;
  v_result jsonb;
BEGIN
  -- Reserve outside the move subtransaction so a rejected move still costs quota.
  v_admitted := public.reserve_ranked_api_request(p_user_id, 'move');
  IF v_admitted IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('status', CASE WHEN v_admitted = false
      THEN 'rate_limited' ELSE 'unavailable' END);
  END IF;

  BEGIN
    IF p_match_id IS NULL OR p_row IS NULL OR p_column IS NULL
      OR p_row NOT BETWEEN 0 AND 15 OR p_column NOT BETWEEN 0 AND 15
      OR p_expected_move_count IS NULL OR p_expected_move_count < 0 THEN
      RETURN jsonb_build_object('status', 'rejected');
    END IF;

    CASE p_action
      WHEN 'reveal' THEN
        -- Route first and later reveals using server-owned state, never a client hint.
        -- Lock the owner's active match before reading state; the existing overload
        -- independently checks the revision and delegates to the original move RPC.
        SELECT move_count INTO v_move_count
        FROM public.ranked_matches
        WHERE id = p_match_id AND user_id = p_user_id AND status = 'active'
        FOR UPDATE;
        IF NOT FOUND OR v_move_count IS DISTINCT FROM p_expected_move_count THEN
          RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'Ranked board revision is stale';
        END IF;
        SELECT first_move_done INTO v_first_move_done
        FROM public.ranked_match_state WHERE match_id = p_match_id;
        IF NOT FOUND OR v_first_move_done IS NULL THEN
          RAISE EXCEPTION USING ERRCODE = 'XX000', MESSAGE = 'Ranked state unavailable';
        END IF;
        IF v_first_move_done THEN
          v_result := public.reveal_ranked_cell(p_match_id, p_user_id, p_row,
            p_column, p_expected_move_count);
        ELSE
          v_result := public.reveal_first_ranked_cell(p_match_id, p_user_id, p_row,
            p_column, p_expected_move_count);
        END IF;
      WHEN 'flag' THEN
        v_result := public.toggle_ranked_flag(p_match_id, p_user_id, p_row,
          p_column, p_expected_move_count);
      WHEN 'chord' THEN
        v_result := public.chord_ranked_cell(p_match_id, p_user_id, p_row,
          p_column, p_expected_move_count);
      ELSE
        RETURN jsonb_build_object('status', 'rejected');
    END CASE;

    IF jsonb_typeof(v_result) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION USING ERRCODE = 'XX000', MESSAGE = 'Invalid Ranked result';
    END IF;
    RETURN jsonb_build_object('status', 'ok', 'result', v_result);
  EXCEPTION
    WHEN SQLSTATE 'PT409' THEN
      RETURN jsonb_build_object('status', 'conflict');
    WHEN SQLSTATE 'P0001' THEN
      RETURN jsonb_build_object('status', 'rejected');
    WHEN OTHERS THEN
      -- The exception block rolls back any partial move, not the quota reservation.
      -- Never expose SQL details, hidden board state or internal identifiers on failure.
      RETURN jsonb_build_object('status', 'unavailable');
  END;
END;
$function$;

REVOKE ALL ON FUNCTION public.execute_ranked_move(uuid, uuid, text, integer, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.execute_ranked_move(uuid, uuid, text, integer, integer, integer)
  TO service_role;
COMMIT;
