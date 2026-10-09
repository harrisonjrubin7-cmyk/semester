-- Privileged platform roles must arrive with a verified second factor.
--
-- The operations console already enrols and challenges TOTP, and individual
-- high-risk RPCs call `private.assert_fresh_mfa()`.  The shared capability
-- predicate was still willing to authorize every other policy from an aal1
-- JWT, however, so a platform_admin or support_agent session could reach
-- capability-protected reads without completing MFA.
--
-- Keep the check attached to the grant row, not the person.  If the same
-- person also holds an ordinary role that independently carries a capability,
-- that ordinary grant remains usable at aal1.  Break-glass keeps its existing
-- separately approved and action-level fresh-MFA boundary.

create or replace function private.has_capability(
  want_capability text,
  want_scope_kind text default 'platform',
  want_scope_id   text default ''
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.role_grants g
      join public.role_capabilities rc on rc.role = g.role
     where g.subject = (select auth.uid())
       and rc.capability = want_capability
       and g.scope_kind = want_scope_kind
       and g.scope_id = want_scope_id
       and g.revoked_at is null
       and (g.expires_at is null or g.expires_at > now())
       and (
         g.role not in ('platform_admin', 'support_agent')
         or coalesce((select auth.jwt() ->> 'aal') = 'aal2', false)
       )
  )
  or (
    want_scope_kind = 'school'
    and exists (
      select 1
        from public.break_glass_grant b
       where b.subject = (select auth.uid())
         and b.tenant_id = want_scope_id
         and b.closed_at is null
         and b.expires_at > now()
         and want_capability = any (string_to_array(b.scope, ' '))
    )
  );
$$;

revoke all on function private.has_capability(text, text, text)
  from public;
grant execute on function private.has_capability(text, text, text)
  to anon, authenticated;

comment on function private.has_capability(text, text, text) is
  'Whether the caller holds a live role carrying this capability over this scope. platform_admin and support_agent grants require an aal2 JWT; ordinary-role grants remain independent. For policies to read; deliberately not reachable from a client.';
