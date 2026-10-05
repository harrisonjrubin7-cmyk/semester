-- The user-facing half of consented support access.
--
-- Students need a server-authoritative list of verified supporters and one
-- atomic operation that creates both consent and its bounded grant. Both
-- parties need a role-appropriate list of their own windows; neither should
-- assemble identity joins or authorization rules in the browser.

create or replace function public.available_supporters()
returns table (supporter_id uuid, label text)
language sql
stable
security definer
set search_path = ''
as $$
  with caller as (
    select p.school_id
      from public.profiles p
     where p.user_id = auth.uid()
       and p.school_id is not null
  )
  select distinct p.user_id,
         coalesce(nullif(trim(p.handle), ''), 'Verified university supporter')
    from caller c
    join public.role_grants g
      on g.scope_kind = 'school'
     and g.scope_id = c.school_id
     and g.revoked_at is null
     and (g.expires_at is null or g.expires_at > now())
    join public.role_capabilities rc
      on rc.role = g.role and rc.capability = 'support:read'
    join public.profiles p
      on p.user_id = g.subject and p.school_id = c.school_id
   where g.subject <> auth.uid()
   order by 2, 1;
$$;

create or replace function public.create_support_access(
  want_supporter uuid,
  want_reason text,
  want_days integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  student uuid := auth.uid();
  tenant text;
  consent uuid;
  created uuid;
  until_at timestamptz;
begin
  if student is null then
    raise exception using errcode = '42501', message = 'Sign in first.';
  end if;
  if want_supporter is null or want_supporter = student then
    raise exception using errcode = '22023', message = 'Choose a verified supporter.';
  end if;
  if want_days is null or want_days < 1 or want_days > 7 then
    raise exception using errcode = '22023', message = 'Support access must last between one and seven days.';
  end if;
  if want_reason is null or length(trim(want_reason)) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'Explain the support you want in 500 characters or fewer.';
  end if;

  select p.school_id into tenant
    from public.profiles p
   where p.user_id = student
   for update;
  if tenant is null then
    raise exception using errcode = '42501', message = 'A verified university is required.';
  end if;
  if not exists (
    select 1 from public.profiles p
     where p.user_id = want_supporter and p.school_id = tenant
  ) or not private.subject_has_capability(
    want_supporter, 'support:read', 'school', tenant
  ) then
    raise exception using errcode = '42501', message = 'That account is not a verified supporter for your university.';
  end if;
  if exists (
    select 1 from public.support_access_grant g
     where g.student_id = student
       and g.supporter_id = want_supporter
       and g.tenant_id = tenant
       and g.revoked_at is null
       and g.expires_at > now()
  ) then
    raise exception using errcode = '23505', message = 'An active support window already exists for this person.';
  end if;

  until_at := now() + make_interval(days => want_days);
  insert into public.consent_record (
    tenant_id, subject_user_id, capability, status, policy_version,
    recorded_by, expires_at, metadata
  ) values (
    tenant, student, 'support:read', 'consented',
    'support-access-v1/' || replace(gen_random_uuid()::text, '-', ''),
    student, until_at, jsonb_build_object('policy', 'support-access-v1')
  ) returning id into consent;

  insert into public.support_access_grant (
    tenant_id, student_id, supporter_id, consent_id,
    scopes, reason, expires_at
  ) values (
    tenant, student, want_supporter, consent,
    array['learning-progress'], trim(want_reason), until_at
  ) returning id into created;

  return created;
end $$;

create or replace function public.support_access_windows()
returns table (
  grant_id uuid,
  side text,
  counterpart_label text,
  reason text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id,
         case when g.student_id = auth.uid() then 'student' else 'supporter' end,
         coalesce(nullif(trim(p.handle), ''),
           case when g.student_id = auth.uid()
             then 'Verified university supporter' else 'Student' end),
         g.reason,
         g.expires_at,
         g.revoked_at,
         g.created_at
    from public.support_access_grant g
    left join public.profiles p
      on p.user_id = case
        when g.student_id = auth.uid() then g.supporter_id else g.student_id end
     and p.school_id = g.tenant_id
   where g.student_id = auth.uid()
      or (
        g.supporter_id = auth.uid()
        and g.revoked_at is null
        and g.expires_at > now()
        and private.support_consent_active(g.consent_id, g.tenant_id, g.student_id)
        and private.subject_has_capability(
          g.supporter_id, 'support:read', 'school', g.tenant_id
        )
      )
   order by g.created_at desc;
$$;

create or replace function public.revoke_support_access(want_grant uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  who uuid := auth.uid();
  consent uuid;
begin
  if who is null then
    raise exception using errcode = '42501', message = 'Sign in first.';
  end if;
  select g.consent_id into consent
    from public.support_access_grant g
   where g.id = want_grant and g.student_id = who;
  if consent is null then
    raise exception using errcode = '42501', message = 'Only the student who created this access can revoke it.';
  end if;

  update public.support_access_grant g
     set revoked_at = coalesce(g.revoked_at, now())
   where g.id = want_grant;
  update public.consent_record c
     set status = 'revoked', revoked_at = coalesce(c.revoked_at, now())
   where c.id = consent and c.subject_user_id = who and c.status <> 'revoked';
  return true;
end $$;

revoke all on function public.available_supporters()
  from public, anon, authenticated;
revoke all on function public.create_support_access(uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.support_access_windows()
  from public, anon, authenticated;
revoke all on function public.revoke_support_access(uuid)
  from public, anon, authenticated;
grant execute on function public.available_supporters() to authenticated;
grant execute on function public.create_support_access(uuid, text, integer) to authenticated;
grant execute on function public.support_access_windows() to authenticated;
grant execute on function public.revoke_support_access(uuid) to authenticated;

comment on function public.available_supporters() is
  'Lists only active support:read holders from the signed-in student university, using profile handles rather than email.';
comment on function public.create_support_access(uuid, text, integer) is
  'Atomically creates versioned consent and a one-to-seven-day aggregate-only support grant for one verified supporter.';
comment on function public.support_access_windows() is
  'Returns the caller own grants and, for a supporter, only currently active consented windows addressed to that caller.';
comment on function public.revoke_support_access(uuid) is
  'Lets only the student who created a support window atomically revoke both its grant and consent.';
