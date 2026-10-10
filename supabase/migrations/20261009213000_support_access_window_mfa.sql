-- Keep case-bound consent-window metadata behind the same aal2 boundary as
-- the support_agent capability that exposes it. An ordinary university staff
-- grant remains usable at aal1 for a student-created, non-ticket window; the
-- privileged support-ticket branch does not. Apply the same rule to the table
-- policy helper as to the UI RPC so PostgREST cannot bypass the boundary.

create or replace function private.support_grant_active(want_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.support_access_grant g
     where g.id = want_id
       and g.supporter_id = (select auth.uid())
       and g.revoked_at is null
       and g.expires_at > now()
       and 'learning-progress' = any(g.scopes)
       and private.support_consent_active(g.consent_id, g.tenant_id, g.student_id)
       and private.subject_has_capability(
         g.supporter_id, 'support:read', 'school', g.tenant_id
       )
       and (
         g.ticket_id is null
         or private.has_capability('support:ticket', 'platform', '')
       )
  );
$$;

revoke all on function private.support_grant_active(uuid)
  from public, anon, authenticated;
grant execute on function private.support_grant_active(uuid) to authenticated;

create or replace function public.support_access_windows()
returns table (
  grant_id uuid,
  side text,
  counterpart_label text,
  reason text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz,
  ticket_id uuid,
  scopes text[],
  consent_state text
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
         g.created_at,
         g.ticket_id,
         g.scopes,
         case
           when c.status <> 'consented' or c.revoked_at is not null then 'revoked'
           when c.expires_at is not null and c.expires_at <= now() then 'expired'
           when g.expires_at <= now() then 'expired'
           else 'active'
         end
    from public.support_access_grant g
    join public.consent_record c on c.id = g.consent_id
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
        and (
          g.ticket_id is null
          or private.has_capability('support:ticket', 'platform', '')
        )
      )
   order by g.created_at desc;
$$;

revoke all on function public.support_access_windows()
  from public, anon;
grant execute on function public.support_access_windows() to authenticated;

comment on function public.support_access_windows() is
  'The caller own support consent windows. Student and ordinary staff rows remain available at aal1; ticket-bound support_agent rows require the aal2-gated support:ticket capability as well as live consent.';
