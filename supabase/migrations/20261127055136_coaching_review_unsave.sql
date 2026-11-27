-- Allow the trusted report endpoint to remove an owner's saved snapshots.
-- No privileges for browser roles; no changes to original games or rewards.
GRANT DELETE ON TABLE public.coaching_reviews TO service_role;
