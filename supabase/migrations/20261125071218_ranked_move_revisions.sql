-- Batch 21.3C: revision-checked Ranked moves. Apply before deploying the new API.
-- Preserve the four-argument server-only RPCs for the currently deployed server.
-- The five-argument overload locks and checks the revision in the same transaction
-- as the original move; no state or reward logic is duplicated.

CREATE FUNCTION public.reveal_first_ranked_cell(
  p_match_id uuid, p_user_id uuid, p_row integer, p_column integer,
  p_expected_move_count integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_move_count integer;
BEGIN
  SELECT move_count INTO v_move_count
  FROM public.ranked_matches
  WHERE id = p_match_id AND user_id = p_user_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND OR p_expected_move_count IS NULL
     OR v_move_count IS DISTINCT FROM p_expected_move_count THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'Ranked board revision is stale';
  END IF;

  RETURN public.reveal_first_ranked_cell(p_match_id, p_user_id, p_row, p_column);
END;
$function$;
REVOKE ALL ON FUNCTION public.reveal_first_ranked_cell(uuid, uuid, integer, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reveal_first_ranked_cell(uuid, uuid, integer, integer, integer)
  TO service_role;

CREATE FUNCTION public.reveal_ranked_cell(
  p_match_id uuid, p_user_id uuid, p_row integer, p_column integer,
  p_expected_move_count integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_move_count integer;
BEGIN
  SELECT move_count INTO v_move_count
  FROM public.ranked_matches
  WHERE id = p_match_id AND user_id = p_user_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND OR p_expected_move_count IS NULL
     OR v_move_count IS DISTINCT FROM p_expected_move_count THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'Ranked board revision is stale';
  END IF;

  RETURN public.reveal_ranked_cell(p_match_id, p_user_id, p_row, p_column);
END;
$function$;
REVOKE ALL ON FUNCTION public.reveal_ranked_cell(uuid, uuid, integer, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reveal_ranked_cell(uuid, uuid, integer, integer, integer)
  TO service_role;

CREATE FUNCTION public.toggle_ranked_flag(
  p_match_id uuid, p_user_id uuid, p_row integer, p_column integer,
  p_expected_move_count integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_move_count integer;
BEGIN
  SELECT move_count INTO v_move_count
  FROM public.ranked_matches
  WHERE id = p_match_id AND user_id = p_user_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND OR p_expected_move_count IS NULL
     OR v_move_count IS DISTINCT FROM p_expected_move_count THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'Ranked board revision is stale';
  END IF;

  RETURN public.toggle_ranked_flag(p_match_id, p_user_id, p_row, p_column);
END;
$function$;
REVOKE ALL ON FUNCTION public.toggle_ranked_flag(uuid, uuid, integer, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.toggle_ranked_flag(uuid, uuid, integer, integer, integer)
  TO service_role;

CREATE FUNCTION public.chord_ranked_cell(
  p_match_id uuid, p_user_id uuid, p_row integer, p_column integer,
  p_expected_move_count integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_move_count integer;
BEGIN
  SELECT move_count INTO v_move_count
  FROM public.ranked_matches
  WHERE id = p_match_id AND user_id = p_user_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND OR p_expected_move_count IS NULL
     OR v_move_count IS DISTINCT FROM p_expected_move_count THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'Ranked board revision is stale';
  END IF;

  RETURN public.chord_ranked_cell(p_match_id, p_user_id, p_row, p_column);
END;
$function$;
REVOKE ALL ON FUNCTION public.chord_ranked_cell(uuid, uuid, integer, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chord_ranked_cell(uuid, uuid, integer, integer, integer)
  TO service_role;

-- Recovery must read move_count and visible state from one consistent board.
-- All existing move functions acquire the match lock before updating state.
CREATE OR REPLACE FUNCTION public.get_ranked_visible_board(p_match_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
    v_match public.ranked_matches%ROWTYPE;
    v_state public.ranked_match_state%ROWTYPE;
    v_revealed JSONB;
    v_flags JSONB;
BEGIN
    SELECT *
    INTO v_match
    FROM public.ranked_matches
    WHERE id = p_match_id
      AND user_id = p_user_id
      AND status = 'active'
    FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active Ranked match not found';
    END IF;
    SELECT *
    INTO v_state
    FROM public.ranked_match_state
    WHERE match_id = p_match_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ranked board state missing';
    END IF;
    IF v_state.first_move_done
       AND v_state.mine_positions IS NULL THEN
        RAISE EXCEPTION 'Invalid Ranked board state';
    END IF;
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'row', cell.position / 16,
                'column', cell.position % 16,
                'adjacentMines', (
                    SELECT count(*)
                    FROM unnest(v_state.mine_positions)
                        AS mine(position)
                    WHERE abs(
                        mine.position / 16 - cell.position / 16
                    ) <= 1
                    AND abs(
                        mine.position % 16 - cell.position % 16
                    ) <= 1
                )
            )
            ORDER BY cell.position
        ),
        '[]'::JSONB
    )
    INTO v_revealed
    FROM unnest(v_state.revealed_positions)
        AS cell(position);
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'row', flag.position / 16,
                'column', flag.position % 16
            )
            ORDER BY flag.position
        ),
        '[]'::JSONB
    )
    INTO v_flags
    FROM unnest(v_state.flagged_positions)
        AS flag(position);
    RETURN jsonb_build_object(
        'matchId', p_match_id,
        'status', v_match.status,
        'rows', v_match.rows,
        'columns', v_match.columns,
        'mineCount', v_match.mine_count,
        'moveCount', v_match.move_count,
        'firstMoveDone', v_state.first_move_done,
        'startedAt', CASE
            WHEN v_state.first_move_done
            THEN v_match.started_at
            ELSE NULL
        END,
        'revealedCells', v_revealed,
        'flaggedCells', v_flags,
        'flagCount', cardinality(v_state.flagged_positions)
    );
END;
$function$;
REVOKE ALL ON FUNCTION public.get_ranked_visible_board(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_ranked_visible_board(uuid, uuid)
  TO service_role;
