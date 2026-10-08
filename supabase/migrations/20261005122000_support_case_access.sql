-- Case-bound support access for the Operations Console.
--
-- The support queue remains identity-free and metadata-first. A case reader
-- can see whether the student created an access window for that exact ticket,
-- but aggregate learning signals require a second, explicit route that
-- re-checks the ticket, named supporter, school capability, scope, consent,
-- expiry, revocation and fresh MFA before delegating to the existing audited
-- aggregate reader. Raw student content is never returned by either route.

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.support_tickets'::regclass
       and conname = 'support_tickets_id_student_unique'
  ) then
    alter table public.support_tickets
      add constraint support_tickets_id_student_unique unique (id, student_id);
  end if;
end $$;

alter table public.support_access_grant
  add column if not exists ticket_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.support_access_grant'::regclass
       and conname = 'support_access_ticket_student_fk'
  ) then
    alter table public.support_access_grant
      add constraint support_access_ticket_student_fk
      foreign key (ticket_id, student_id)
      references public.support_tickets(id, student_id) on delete cascade;
  end if;
end $$;

create index if not exists support_access_by_ticket_supporter
  on public.support_access_grant (ticket_id, supporter_id, created_at desc)
  where ticket_id is not null;

create index if not exists support_access_ticket_student_fk_idx
  on public.support_access_grant (ticket_id, student_id);

create or replace function private.support_grant_current(want_id uuid)
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
       and g.revoked_at is null
       and g.expires_at > now()
       and 'learning-progress' = any(g.scopes)
       and private.support_consent_active(g.consent_id, g.tenant_id, g.student_id)
       and private.subject_has_capability(g.supporter_id, 'support:read', 'school', g.tenant_id)
       and (g.ticket_id is null or private.subject_has_capability(
         g.supporter_id, 'support:ticket', 'platform', ''
       ))
  );
$$;

revoke all on function private.support_grant_current(uuid) from public, anon, authenticated;

create or replace function private.assert_support_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  end if;

  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.tenant_id is distinct from old.tenant_id
    or new.student_id is distinct from old.student_id
    or new.supporter_id is distinct from old.supporter_id
    or new.consent_id is distinct from old.consent_id
    or new.ticket_id is distinct from old.ticket_id
    or new.created_at is distinct from old.created_at
    or (old.revoked_at is not null and new.revoked_at is null)
  ) then
    raise exception 'A support grant identity, case and revocation are immutable.';
  end if;

  if new.ticket_id is not null and new.revoked_at is null and not exists (
    select 1
      from public.support_tickets t
     where t.id = new.ticket_id
       and t.student_id = new.student_id
       and t.status in ('open', 'waiting_on_student')
  ) then
    raise exception using
      errcode = '42501',
      message = 'Case-bound access requires the student''s open support ticket.';
  end if;

  if new.ticket_id is not null and new.revoked_at is null and not private.subject_has_capability(
    new.supporter_id, 'support:ticket', 'platform', ''
  ) then
    raise exception using
      errcode = '42501',
      message = 'Case-bound access requires a verified support case agent.';
  end if;

  if new.revoked_at is null and (
    not private.support_consent_active(new.consent_id, new.tenant_id, new.student_id)
    or not private.subject_has_capability(
      new.supporter_id, 'support:read', 'school', new.tenant_id
    )
  ) then
    raise exception 'Active student consent and a verified support role are required.';
  end if;

  new.updated_at := now();
  return new;
end $$;

create or replace function private.revoke_case_support_access_on_close()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'closed' and old.status is distinct from 'closed' then
    update public.support_access_grant g
       set revoked_at = coalesce(g.revoked_at, now()), updated_at = now()
     where g.ticket_id = new.id and g.revoked_at is null;

    update public.consent_record c
       set status = 'revoked', revoked_at = coalesce(c.revoked_at, now())
      from public.support_access_grant g
     where g.ticket_id = new.id
       and c.id = g.consent_id
       and c.status <> 'revoked';
  end if;
  return new;
end $$;

revoke all on function private.revoke_case_support_access_on_close()
  from public, anon, authenticated;

create or replace trigger close_revokes_case_support_access
  after update of status on public.support_tickets
  for each row execute function private.revoke_case_support_access_on_close();

create or replace function public.available_case_supporters()
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
         coalesce(nullif(trim(p.handle), ''), 'Verified support case agent')
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
     and private.subject_has_capability(
       g.subject, 'support:ticket', 'platform', ''
     )
   order by 2, 1;
$$;

drop function if exists public.create_support_access(uuid, text, integer);

create or replace function public.create_support_access(
  want_supporter uuid,
  want_reason text,
  want_days integer,
  want_ticket uuid default null
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
  if want_ticket is not null and not exists (
    select 1
      from public.support_tickets t
     where t.id = want_ticket
       and t.student_id = student
       and t.status in ('open', 'waiting_on_student')
  ) then
    raise exception using
      errcode = '42501',
      message = 'Choose one of your open support tickets.';
  end if;
  if want_ticket is not null and not private.subject_has_capability(
    want_supporter, 'support:ticket', 'platform', ''
  ) then
    raise exception using
      errcode = '42501',
      message = 'Choose a verified support case agent.';
  end if;
  if exists (
    select 1 from public.support_access_grant g
     where g.student_id = student
       and g.supporter_id = want_supporter
       and g.tenant_id = tenant
       and g.ticket_id is not distinct from want_ticket
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
    'support-access-v2/' || replace(gen_random_uuid()::text, '-', ''),
    student, until_at,
    jsonb_strip_nulls(jsonb_build_object(
      'policy', 'support-access-v2',
      'ticket_id', want_ticket
    ))
  ) returning id into consent;

  insert into public.support_access_grant (
    tenant_id, student_id, supporter_id, consent_id, ticket_id,
    scopes, reason, expires_at
  ) values (
    tenant, student, want_supporter, consent, want_ticket,
    array['learning-progress'], trim(want_reason), until_at
  ) returning id into created;

  return created;
end $$;

drop function if exists public.support_access_windows();

create function public.support_access_windows()
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
          or private.subject_has_capability(
            g.supporter_id, 'support:ticket', 'platform', ''
          )
        )
      )
   order by g.created_at desc;
$$;

create or replace function public.support_case_access(want_ticket uuid)
returns table (
  ticket_id uuid,
  grant_id uuid,
  scope text,
  reason text,
  expires_at timestamptz,
  consent_state text,
  active boolean,
  last_sensitive_read_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.support_agent() then
    raise exception using errcode = '42501', message = 'support:ticket is required';
  end if;
  if not exists (
    select 1 from public.support_tickets t
     where t.id = want_ticket and t.status in ('open', 'waiting_on_student')
  ) then
    raise exception using errcode = '42501', message = 'An open support case is required.';
  end if;

  return query
  select want_ticket,
         g.id,
         case when 'learning-progress' = any(g.scopes)
           then 'learning-progress'::text else null::text end,
         g.reason,
         g.expires_at,
         case
           when g.id is null then 'not_granted'
           when c.status <> 'consented' or c.revoked_at is not null then 'revoked'
           when c.expires_at is not null and c.expires_at <= now() then 'expired'
           when g.revoked_at is not null then 'revoked'
           when g.expires_at <= now() then 'expired'
           when not ('learning-progress' = any(g.scopes)) then 'wrong_scope'
           when not private.subject_has_capability(
             auth.uid(), 'support:read', 'school', g.tenant_id
           ) then 'role_missing'
           else 'active'
         end,
         coalesce(
           g.revoked_at is null
           and g.expires_at > now()
           and 'learning-progress' = any(g.scopes)
           and private.support_consent_active(g.consent_id, g.tenant_id, g.student_id)
           and private.subject_has_capability(
             auth.uid(), 'support:read', 'school', g.tenant_id
           ),
           false
         ),
         (
           select max(e.occurred_at)
             from public.support_access_event e
            where e.grant_id = g.id and e.action = 'signals_viewed'
         )
    from (select 1) seed
    left join lateral (
      select candidate.*
        from public.support_access_grant candidate
       where candidate.ticket_id = want_ticket
         and candidate.supporter_id = auth.uid()
       order by candidate.created_at desc
       limit 1
    ) g on true
    left join public.consent_record c on c.id = g.consent_id;
end $$;

create or replace function public.read_support_case_signals(want_ticket uuid)
returns table (
  course_id text,
  evidence_count bigint,
  average_score numeric,
  mistake_count bigint,
  last_observed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_grant uuid;
begin
  if not private.support_agent() then
    raise exception using errcode = '42501', message = 'support:ticket is required';
  end if;
  perform private.assert_fresh_mfa();

  select g.id into linked_grant
    from public.support_access_grant g
    join public.support_tickets t
      on t.id = g.ticket_id and t.student_id = g.student_id
   where t.id = want_ticket
     and t.status in ('open', 'waiting_on_student')
     and g.supporter_id = auth.uid()
     and g.revoked_at is null
     and g.expires_at > now()
     and 'learning-progress' = any(g.scopes)
     and private.support_consent_active(g.consent_id, g.tenant_id, g.student_id)
     and private.subject_has_capability(
       auth.uid(), 'support:read', 'school', g.tenant_id
     )
   order by g.created_at desc
   limit 1;

  if linked_grant is null then
    raise exception using
      errcode = '42501',
      message = 'Active consent for this support case is required.';
  end if;

  return query select * from public.read_support_signals(linked_grant);
end $$;

create or replace function public.read_support_signals(want_grant uuid)
returns table (
  course_id text,
  evidence_count bigint,
  average_score numeric,
  mistake_count bigint,
  last_observed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  grant_row public.support_access_grant;
  caller uuid := auth.uid();
begin
  select * into grant_row
    from public.support_access_grant g
   where g.id = want_grant;

  if grant_row.ticket_id is not null then
    if not private.support_agent() or not exists (
      select 1
        from public.support_tickets t
       where t.id = grant_row.ticket_id
         and t.student_id = grant_row.student_id
         and t.status in ('open', 'waiting_on_student')
    ) then
      raise exception using
        errcode = '42501',
        message = 'Active consent for this support case is required.';
    end if;
    perform private.assert_fresh_mfa();
  end if;

  if caller is null
     or grant_row.id is null
     or grant_row.supporter_id <> caller
     or grant_row.revoked_at is not null
     or grant_row.expires_at <= now()
     or not ('learning-progress' = any(grant_row.scopes))
     or not private.support_consent_active(
       grant_row.consent_id, grant_row.tenant_id, grant_row.student_id
     )
     or not private.subject_has_capability(
       caller, 'support:read', 'school', grant_row.tenant_id
     ) then
    raise exception using
      errcode = '42501',
      message = 'An active student-granted support window is required.';
  end if;

  insert into public.support_access_event (
    tenant_id, grant_id, action, student_sha256, supporter_sha256,
    actor_sha256
  ) values (
    grant_row.tenant_id,
    grant_row.id,
    'signals_viewed',
    private.role_audit_sha256(grant_row.student_id::text),
    private.role_audit_sha256(grant_row.supporter_id::text),
    private.role_audit_sha256(caller::text)
  );

  return query
  with concepts as (
    select c.course_id,
           count(*)::bigint as evidence_count,
           avg(c.score)::numeric as average_score,
           max(c.observed_at) as last_observed_at
      from public.concept_evidence c
     where c.tenant_id = grant_row.tenant_id
       and c.person_id = grant_row.student_id
     group by c.course_id
  ), mistakes as (
    select m.course_id,
           count(*)::bigint as mistake_count,
           max(m.observed_at) as last_observed_at
      from public.mistake_evidence m
     where m.tenant_id = grant_row.tenant_id
       and m.person_id = grant_row.student_id
     group by m.course_id
  )
  select coalesce(c.course_id, m.course_id),
         coalesce(c.evidence_count, 0),
         c.average_score,
         coalesce(m.mistake_count, 0),
         greatest(c.last_observed_at, m.last_observed_at)
    from concepts c
    full join mistakes m using (course_id)
   order by coalesce(c.course_id, m.course_id);
end $$;

revoke all on function public.create_support_access(uuid, text, integer, uuid)
  from public, anon, authenticated;
revoke all on function public.available_case_supporters()
  from public, anon, authenticated;
revoke all on function public.support_access_windows()
  from public, anon, authenticated;
revoke all on function public.support_case_access(uuid)
  from public, anon, authenticated;
revoke all on function public.read_support_case_signals(uuid)
  from public, anon, authenticated;
grant execute on function public.create_support_access(uuid, text, integer, uuid)
  to authenticated;
grant execute on function public.available_case_supporters() to authenticated;
grant execute on function public.support_access_windows() to authenticated;
grant execute on function public.support_case_access(uuid) to authenticated;
grant execute on function public.read_support_case_signals(uuid) to authenticated;

comment on column public.support_access_grant.ticket_id is
  'Optional student-owned support ticket that bounds a grant to one case; null preserves general support access outside the case workspace.';
comment on function public.available_case_supporters() is
  'Lists only same-school support:read holders who also have active platform support:ticket duty, so a case grant always names an eligible case operator.';
comment on function public.create_support_access(uuid, text, integer, uuid) is
  'Atomically creates versioned consent and a one-to-seven-day aggregate-only support grant, optionally bound to one open ticket owned by the student.';
comment on function public.support_access_windows() is
  'Returns the caller own grants and, for a supporter, only currently active consented windows addressed to that caller, including case, scope and consent metadata.';
comment on function public.support_case_access(uuid) is
  'Returns identity-free access metadata for an open support case and only for a grant addressed to the calling support agent; no student content or tenant identity.';
comment on function public.read_support_case_signals(uuid) is
  'Requires support-ticket duty, fresh MFA and active case-bound student consent, then returns only audited aggregate learning signals.';
