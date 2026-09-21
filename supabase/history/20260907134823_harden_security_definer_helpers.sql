-- Close the security advisor's findings, three different ways.
--
-- ── Why `revoke ... from public` did not already do this ──────────────────
--
-- classmates.sql ends each helper with `revoke all on function ... from
-- public; grant execute ... to authenticated`, which reads like it locks
-- anon out. It does not. Supabase ships default privileges that grant
-- EXECUTE on new functions in `public` to anon, authenticated and
-- service_role, so `anon=X/postgres` is an explicit grant — and revoking
-- from the PUBLIC pseudo-role leaves it untouched. The revoke was aimed at
-- the wrong grantee, and every one of these has been callable by anyone
-- holding the publishable key since the day it shipped.
--
-- ── Why these move rather than lose their grants ──────────────────────────
--
-- `classmate`, `in_class` and `verified_student` are the helpers seven RLS
-- policies are built on, across enrollments, messages, profiles and reports.
-- Every one of those policies is `TO public`, so the expression is evaluated
-- for anon as well — revoking EXECUTE would turn "you see nothing" into "the
-- query errors", which is a worse answer to the same question.
--
-- So they move out of the schema PostgREST publishes. The policies follow
-- them: a policy stores the function's OID, not its name, so moving does not
-- rewrite a single one. What changes is that `/rest/v1/rpc/classmate` stops
-- existing, which is the whole finding.
create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

alter function public.verified_student() set schema private;
alter function public.classmate(uuid) set schema private;
alter function public.in_class(text, text) set schema private;

-- Their bodies already qualify every table (`public.enrollments`,
-- `auth.users`), so an empty search_path costs nothing and removes the last
-- way a shadowed name could change what they read.
alter function private.verified_student() set search_path = '';
alter function private.classmate(uuid) set search_path = '';
alter function private.in_class(text, text) set search_path = '';

-- ── The two that are not called by anything ───────────────────────────────
--
-- `touch_updated_at` is a trigger function and `rls_auto_enable` an event
-- trigger function. Neither is reachable through PostgREST in a way that does
-- anything — one returns `trigger`, the other `event_trigger` — and neither
-- needs EXECUTE to fire: Postgres checks that privilege when a trigger is
-- created, not each time it runs. So the grants are simply surface.
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- The one genuine finding on `touch_updated_at`: no search_path at all, so it
-- resolved names against whatever the caller had set. Its body calls only
-- `now()`, which lives in pg_catalog and is always reachable, so '' is safe.
alter function public.touch_updated_at() set search_path = '';