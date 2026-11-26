-- Require a compatible server-side Ranked policy version.
-- NULL keeps compatibility enforcement disabled until release.

ALTER TABLE ranked_internal.release_maintenance
ADD COLUMN required_policy_version smallint
CHECK (required_policy_version IN (3));

CREATE OR REPLACE FUNCTION ranked_internal.guard_release_maintenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    maintenance_enabled boolean;
    required_version smallint;
    supplied_version text;
BEGIN
    SELECT enabled, required_policy_version
    INTO maintenance_enabled, required_version
    FROM ranked_internal.release_maintenance
    WHERE singleton = true
    FOR SHARE;

    IF maintenance_enabled IS DISTINCT FROM false THEN
        RAISE EXCEPTION USING
            ERRCODE = 'PT503',
            MESSAGE = 'Ranked is temporarily unavailable for maintenance.';
    END IF;

    IF required_version IS NOT NULL THEN
        supplied_version :=
            NULLIF(current_setting('request.headers', true), '')::jsonb
            ->> 'x-ai-coach-ranked-policy';

        IF supplied_version IS DISTINCT FROM required_version::text THEN
            RAISE EXCEPTION USING
                ERRCODE = 'PT503',
                MESSAGE = 'Incompatible Ranked application version.';
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION ranked_internal.guard_release_maintenance()
FROM PUBLIC, anon, authenticated, service_role;
