-- Additive: the six-argument RPC remains compatible with existing getUser callers.
-- The claims path must use the seven-argument overload. Never expose it to browser roles.
BEGIN;
CREATE SCHEMA ranked_auth_private;
REVOKE ALL ON SCHEMA ranked_auth_private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA ranked_auth_private TO service_role;

-- Narrow privileged lookup, rather than granting service_role direct access to auth tables.
-- The caller is the server's service role, not an end-user JWT. The API verifies the JWT
-- before forwarding its signed subject/session pair. auth.uid() is not the end user here.
CREATE FUNCTION ranked_auth_private.session_is_active(p_user_id uuid, p_session_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM auth.sessions AS s
    JOIN auth.users AS u ON u.id = s.user_id
    WHERE s.id = p_session_id AND s.user_id = p_user_id
      AND (s.not_after IS NULL OR s.not_after > pg_catalog.now())
      AND u.deleted_at IS NULL
      AND (u.banned_until IS NULL OR u.banned_until <= pg_catalog.now())
  );
$function$;
REVOKE ALL ON FUNCTION ranked_auth_private.session_is_active(uuid,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION ranked_auth_private.session_is_active(uuid,uuid) TO service_role;

-- Recovery is not a per-move hot path. Check before returning any board data.
CREATE FUNCTION public.ranked_session_is_active(p_user_id uuid, p_session_id uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $function$
  SELECT ranked_auth_private.session_is_active(p_user_id, p_session_id);
$function$;
REVOKE ALL ON FUNCTION public.ranked_session_is_active(uuid,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ranked_session_is_active(uuid,uuid) TO service_role;

-- Distinct named argument set, no defaults. Session validation and gameplay share one RPC.
CREATE FUNCTION public.execute_ranked_move(
  p_user_id uuid, p_match_id uuid, p_action text, p_row integer,
  p_column integer, p_expected_move_count integer, p_session_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $function$
BEGIN
  IF ranked_auth_private.session_is_active(p_user_id, p_session_id) IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;
  RETURN public.execute_ranked_move(p_user_id, p_match_id, p_action, p_row,
    p_column, p_expected_move_count);
END;
$function$;
REVOKE ALL ON FUNCTION public.execute_ranked_move(uuid,uuid,text,integer,integer,integer,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.execute_ranked_move(uuid,uuid,text,integer,integer,integer,uuid)
  TO service_role;
COMMIT;
