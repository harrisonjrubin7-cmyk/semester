-- New Supabase previews do not give postgres-created tables implicit CRUD.
-- The app reads its own/classmate profiles and its own claimed school.
-- Preserve the existing column-only INSERT/UPDATE grants, especially the
-- school_id pin in 20260921211500_pin_profile_school.sql.
grant select on table public.profiles to authenticated;

-- Publishing and rotating a calendar link use upsert; reading it uses SELECT.
-- The existing owner-only USING/WITH CHECK policy still decides whose rows
-- are reachable. Account erasure uses an Edge Function/RPC, so these callers
-- do not justify a new direct-client DELETE grant.
grant select, insert, update on table public.calendar_feeds to authenticated;
