-- `my_capabilities()` tells the caller about the break-glass grant they hold.
--
-- `private.has_capability` has honoured an open break-glass grant over its
-- tenant since 20260929110000: a school-scope check passes when the caller has
-- an unclosed, unexpired `break_glass_grant` whose `scope` names the
-- capability. `my_capabilities()` (20260928010000) was written first and reads
-- only `role_grants`, so it never learned of that second source. The responder
-- the two approvers approved was allowed by every policy and offered nothing by
-- the screen that asks what to offer.
--
-- This adds the same rows `has_capability` would grant, and no others: one row
-- per capability named in an open grant, over `school` and the grant's tenant.
-- Break-glass widens who, never where, so nothing is returned over the
-- platform. The predicate is copied from `has_capability`, not re-derived
-- (not closed, not expired); supabase/my-capabilities.check.sql holds the two
-- to each other row by row.
--
-- It grants nothing: every policy still decides what any of this reaches, and
-- the client uses the answer to decide what to *offer*, never to authorize.
--
-- Rolling back: re-create the function from 20260928010000.

create or replace function public.my_capabilities()
returns table (capability text, scope_kind text, scope_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct c.capability, c.scope_kind, c.scope_id
    from (
      select rc.capability, g.scope_kind, g.scope_id
        from public.role_grants g
        join public.role_capabilities rc on rc.role = g.role
       where g.subject = (select auth.uid())
         and g.revoked_at is null
         and (g.expires_at is null or g.expires_at > now())
      union all
      select cap, 'school'::text, b.tenant_id
        from public.break_glass_grant b
       cross join lateral unnest(string_to_array(b.scope, ' ')) as cap
       where b.subject = (select auth.uid())
         and b.closed_at is null
         and b.expires_at > now()
    ) c
   order by 1, 2, 3;
$$;

revoke all on function public.my_capabilities() from public, anon;
grant execute on function public.my_capabilities() to authenticated;

comment on function public.my_capabilities() is
  'The caller''s own live capabilities and their scopes, with private.has_capability''s predicate, including an open break-glass grant over its tenant. For deciding what a screen offers; every table''s policies still authorize.';
