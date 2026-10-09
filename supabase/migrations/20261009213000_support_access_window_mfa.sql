-- Keep consent-window metadata behind the same aal2 boundary as the
-- support_agent capability that exposes it. Students may still list their own
-- grants at aal1; only the supporter branch is elevated.

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
        and coalesce((select auth.jwt() ->> 'aal') = 'aal2', false)
        and g.revoked_at is null
        and g.expires_at > now()
        and private.support_consent_active(g.consent_id, g.tenant_id, g.student_id)
        and private.subject_has_capability(
          g.supporter_id, 'support:read', 'school', g.tenant_id
        )
        and (
          g.ticket_id is null
          or private.subject_has_capability(
            g.supporter_id, 'support:ticket', 'platform', ''
          )
        )
      )
   order by g.created_at desc;
$$;

revoke all on function public.support_access_windows()
  from public, anon;
grant execute on function public.support_access_windows() to authenticated;

comment on function public.support_access_windows() is
  'The caller own support consent windows. Student-owned rows remain available at aal1; supporter rows require an aal2 JWT as well as live consent and capability grants.';
