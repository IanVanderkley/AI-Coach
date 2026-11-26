-- Server-side Ranked maintenance protection.
-- Disabled by default. Only database administrators can change it.

CREATE TABLE ranked_internal.release_maintenance (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    enabled boolean NOT NULL DEFAULT false
);

INSERT INTO ranked_internal.release_maintenance
    (singleton, enabled)
VALUES (true, false);

ALTER TABLE ranked_internal.release_maintenance
    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE ranked_internal.release_maintenance
FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION ranked_internal.guard_release_maintenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    maintenance_enabled boolean;
BEGIN
    SELECT enabled INTO maintenance_enabled
    FROM ranked_internal.release_maintenance
    WHERE singleton = true
    FOR SHARE;

    IF maintenance_enabled IS DISTINCT FROM false THEN
        RAISE EXCEPTION USING
            ERRCODE = 'PT503',
            MESSAGE = 'Ranked is temporarily unavailable for maintenance.';
    END IF;

    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION ranked_internal.guard_release_maintenance()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER ranked_release_guard
BEFORE INSERT OR UPDATE ON public.ranked_matches
FOR EACH STATEMENT
EXECUTE FUNCTION ranked_internal.guard_release_maintenance();

CREATE TRIGGER ranked_release_guard
BEFORE INSERT OR UPDATE ON public.ranked_match_state
FOR EACH STATEMENT
EXECUTE FUNCTION ranked_internal.guard_release_maintenance();

CREATE TRIGGER ranked_release_guard
BEFORE INSERT OR UPDATE ON public.ranked_match_moves
FOR EACH STATEMENT
EXECUTE FUNCTION ranked_internal.guard_release_maintenance();

CREATE TRIGGER ranked_release_guard
BEFORE INSERT OR UPDATE ON public.ranked_elo_events
FOR EACH STATEMENT
EXECUTE FUNCTION ranked_internal.guard_release_maintenance();

CREATE TRIGGER ranked_release_guard
BEFORE INSERT OR UPDATE ON public.ranked_verified_results
FOR EACH STATEMENT
EXECUTE FUNCTION ranked_internal.guard_release_maintenance();
