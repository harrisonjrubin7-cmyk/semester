-- The caller's own live capabilities, so staff screens can open for staff.
--
-- Until now nothing told the client which capabilities a signed-in person
-- holds. `role_grants` is readable by its subject, but whether a grant counts
-- — not revoked, not expired — lives inside `private.has_capability`, and a
-- client re-deriving that predicate is a second copy that drifts. So the
-- Operations studio and the Control tab stayed closed for everybody, by
-- design: a role picked in the UI is not authorization.
--
-- This returns the caller's own (capability, scope_kind, scope_id) rows with
-- exactly the predicate `has_capability` uses, joined through the same
-- role_capabilities matrix. It is about the caller only, names nobody else,
-- and grants nothing: every table's own policies still decide what any of it
-- reaches. The client uses it to decide what to *offer*, never to authorize.
--
-- `my_moderation_access()` (20260928000000) answers the same question for two
-- capabilities and stays, because the report queue already relies on it.

create or replace function public.my_capabilities()
returns table (capability text, scope_kind text, scope_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct rc.capability, g.scope_kind, g.scope_id
    from public.role_grants g
    join public.role_capabilities rc on rc.role = g.role
   where g.subject = (select auth.uid())
     and g.revoked_at is null
     and (g.expires_at is null or g.expires_at > now())
   order by 1, 2, 3;
$$;

revoke all on function public.my_capabilities() from public, anon;
grant execute on function public.my_capabilities() to authenticated;

comment on function public.my_capabilities() is
  'The caller''s own live capabilities and their scopes, with private.has_capability''s predicate. For deciding what a screen offers; every table''s policies still authorize.';

-- Rolling back: `drop function if exists public.my_capabilities();`
