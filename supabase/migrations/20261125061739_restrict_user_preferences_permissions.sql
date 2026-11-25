-- Preferences are private to authenticated owners. Keep the existing RLS
-- policies and server grants; remove unused client privileges.
REVOKE ALL PRIVILEGES ON TABLE public.user_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_preferences TO authenticated;

-- Fail the migration if effective permissions differ from the intended contract.
DO $$
DECLARE
    privilege_name text;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class
        WHERE oid = 'public.user_preferences'::regclass AND relrowsecurity
    ) THEN
        RAISE EXCEPTION 'user_preferences must have RLS enabled';
    END IF;
    FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] LOOP
        IF has_table_privilege('anon', 'public.user_preferences', privilege_name) THEN
            RAISE EXCEPTION 'Unexpected anonymous preferences privilege: %', privilege_name;
        END IF;
        IF has_table_privilege('authenticated', 'public.user_preferences', privilege_name)
            IS DISTINCT FROM (privilege_name IN ('SELECT', 'INSERT', 'UPDATE')) THEN
            RAISE EXCEPTION 'Unexpected authenticated preferences privilege: %', privilege_name;
        END IF;
    END LOOP;
END;
$$;
