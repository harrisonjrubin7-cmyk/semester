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

-- Approval duties also ask whether the caller holds a named role. Keep the
-- same two privileged grants dormant there, so request_approval cannot bypass
-- the capability boundary by calling private.party_held instead.
create or replace function private.party_held(party text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when party = 'student' then false
    when party like 'role:%' then exists (
      select 1
        from public.role_grants g
       where g.subject = (select auth.uid())
         and g.role = substr(party, 6)
         and g.revoked_at is null
         and (g.expires_at is null or g.expires_at > now())
         and (
           g.role not in ('platform_admin', 'support_agent')
           or coalesce((select auth.jwt() ->> 'aal') = 'aal2', false)
         )
    )
    else private.holds_seat(party)
  end;
$$;

revoke all on function private.party_held(text) from public, anon, authenticated;

-- The app-level elevation gate needs to distinguish an ordinary account from
-- an aal1 account whose privileged grant is deliberately dormant. It returns
-- only the caller's own yes/no status and grants no capability.
create or replace function public.privileged_mfa_required()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2'
     and exists (
       select 1
         from public.role_grants g
        where g.subject = (select auth.uid())
          and g.role in ('platform_admin', 'support_agent')
          and g.revoked_at is null
          and (g.expires_at is null or g.expires_at > now())
     );
$$;

revoke all on function public.privileged_mfa_required() from public, anon;
grant execute on function public.privileged_mfa_required() to authenticated;

comment on function public.privileged_mfa_required() is
  'Whether the caller has a live platform_admin or support_agent grant whose current JWT is below aal2. For displaying the app-level elevation gate; grants no access.';

-- The client capability projection promises to mirror has_capability. Keep a
-- privileged grant out of that projection while it is dormant at aal1, while
-- leaving ordinary and break-glass grants unchanged.
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
         and (
           g.role not in ('platform_admin', 'support_agent')
           or coalesce((select auth.jwt() ->> 'aal') = 'aal2', false)
         )
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
  'The caller''s own currently active capabilities and scopes, including break-glass. platform_admin and support_agent grant rows are omitted below aal2, matching private.has_capability. For deciding what a screen offers; every policy still authorizes.';

-- Auth-js records phone factor verification as `mfa/phone`. Keep the server's
-- fresh-MFA predicate aligned with the client and with the existing plain
-- `phone` spelling so a verified phone session can perform the action it was
-- challenged for.
create or replace function private.mfa_fresh(within interval default '15 minutes')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select (j.claims ->> 'aal') = 'aal2'
       and exists (
         select 1
           from jsonb_array_elements(
                  case when jsonb_typeof(j.claims -> 'amr') = 'array'
                       then j.claims -> 'amr' else '[]'::jsonb end) as m
          where (m ->> 'method') in ('totp', 'webauthn', 'phone', 'mfa/totp', 'mfa/phone')
            and (m ->> 'timestamp') ~ '^[0-9]+(\.[0-9]+)?$'
            and to_timestamp((m ->> 'timestamp')::double precision) >= now() - within
       )
      from (select auth.jwt() as claims) j
  ), false);
$$;

revoke all on function private.mfa_fresh(interval) from public, anon, authenticated;

comment on function private.mfa_fresh(interval) is
  'Whether the caller''s JWT says a second factor (totp, webauthn, phone, including auth-js mfa/totp and mfa/phone spellings) was verified within the interval. Read from auth.jwt(); the client''s own MFA state is never consulted.';
