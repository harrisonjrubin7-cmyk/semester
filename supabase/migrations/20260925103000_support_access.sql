-- Student-controlled access for university support staff.
--
-- A school role carrying `support:read` is necessary and deliberately not
-- sufficient. One named student must also create a short-lived grant naming
-- one named supporter, backed by an active versioned consent record. The only
-- readable academic result is an aggregate learning-progress summary; raw
-- evidence, excerpts, mistake detail, notes and captures remain behind their
-- existing owner-only policies.

create or replace function private.subject_has_capability(
  want_subject uuid,
  want_capability text,
  want_scope_kind text,
  want_scope_id text
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
     where g.subject = want_subject
       and rc.capability = want_capability
       and g.scope_kind = want_scope_kind
       and g.scope_id = want_scope_id
       and g.revoked_at is null
       and (g.expires_at is null or g.expires_at > now())
  );
$$;

revoke all on function private.subject_has_capability(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function private.subject_has_capability(uuid, text, text, text)
  to authenticated;

create or replace function private.support_consent_active(
  want_consent uuid,
  want_tenant text,
  want_student uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.consent_record c
     where c.id = want_consent
       and c.tenant_id = want_tenant
       and c.subject_user_id = want_student
       and c.capability = 'support:read'
       and c.status = 'consented'
       and c.revoked_at is null
       and (c.expires_at is null or c.expires_at > now())
  );
$$;

revoke all on function private.support_consent_active(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function private.support_consent_active(uuid, text, uuid)
  to authenticated;

create table if not exists public.support_access_grant (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.schools(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  supporter_id uuid not null references auth.users(id) on delete cascade,
  consent_id uuid not null,
  scopes text[] not null default array['learning-progress'],
  reason text not null check (length(trim(reason)) between 1 and 500),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id, student_id),
  foreign key (consent_id, tenant_id, student_id)
    references public.consent_record(id, tenant_id, subject_user_id) on delete cascade,
  constraint support_access_two_people check (student_id <> supporter_id),
  constraint support_access_scopes_valid check (
    cardinality(scopes) > 0
    and array_position(scopes, null) is null
    and scopes <@ array['learning-progress']::text[]
  ),
  constraint support_access_short_lived check (
    expires_at > created_at and expires_at <= created_at + interval '7 days'
  ),
  constraint support_access_revocation_time check (
    revoked_at is null or revoked_at >= created_at
  )
);

create index if not exists support_access_by_student
  on public.support_access_grant (student_id, created_at desc);
create index if not exists support_access_by_supporter
  on public.support_access_grant (supporter_id, expires_at desc);
create index if not exists support_access_by_consent
  on public.support_access_grant (consent_id, tenant_id, student_id);
create index if not exists support_access_by_tenant
  on public.support_access_grant (tenant_id, expires_at desc);

create table if not exists public.support_access_event (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  grant_id uuid not null,
  action text not null check (action in (
    'grant_created', 'grant_updated', 'grant_revoked', 'grant_deleted',
    'signals_viewed'
  )),
  scope text not null default 'learning-progress'
    check (scope = 'learning-progress'),
  student_sha256 text not null check (student_sha256 ~ '^[0-9a-f]{64}$'),
  supporter_sha256 text not null check (supporter_sha256 ~ '^[0-9a-f]{64}$'),
  actor_sha256 text check (actor_sha256 is null or actor_sha256 ~ '^[0-9a-f]{64}$'),
  old_expires_at timestamptz,
  new_expires_at timestamptz,
  old_revoked_at timestamptz,
  new_revoked_at timestamptz,
  occurred_at timestamptz not null default now()
);

create index if not exists support_access_event_by_tenant_time
  on public.support_access_event (tenant_id, occurred_at desc);
create index if not exists support_access_event_by_grant_time
  on public.support_access_event (grant_id, occurred_at desc);
create index if not exists support_access_event_by_student
  on public.support_access_event (student_sha256, occurred_at desc);
create index if not exists support_access_event_by_supporter
  on public.support_access_event (supporter_sha256, occurred_at desc);

alter table public.support_access_grant enable row level security;
alter table public.support_access_event enable row level security;

revoke all on table public.support_access_grant from anon, authenticated;
revoke all on table public.support_access_event from anon, authenticated;
grant select, insert, update on table public.support_access_grant to authenticated;
grant select on table public.support_access_event to authenticated;

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
  );
$$;

revoke all on function private.support_grant_active(uuid)
  from public, anon, authenticated;
grant execute on function private.support_grant_active(uuid) to authenticated;

create or replace function private.can_read_support_event(
  want_tenant text,
  want_student_sha256 text,
  want_supporter_sha256 text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then false
    else
      want_student_sha256 = private.role_audit_sha256(auth.uid()::text)
      or want_supporter_sha256 = private.role_audit_sha256(auth.uid()::text)
      or private.has_capability('audit:read', 'school', want_tenant)
  end;
$$;

revoke all on function private.can_read_support_event(text, text, text)
  from public, anon, authenticated;
grant execute on function private.can_read_support_event(text, text, text)
  to authenticated;

create policy "students read their support grants"
  on public.support_access_grant for select to authenticated
  using (student_id = (select auth.uid()));

create policy "supporters read only active grants addressed to them"
  on public.support_access_grant for select to authenticated
  using (private.support_grant_active(id));

create policy "students create bounded support grants"
  on public.support_access_grant for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and tenant_id = (
      select p.school_id from public.profiles p
       where p.user_id = (select auth.uid())
    )
    and private.support_consent_active(consent_id, tenant_id, student_id)
    and private.subject_has_capability(
      supporter_id, 'support:read', 'school', tenant_id
    )
  );

create policy "students change their support grants"
  on public.support_access_grant for update to authenticated
  using (student_id = (select auth.uid()))
  with check (
    student_id = (select auth.uid())
    and tenant_id = (
      select p.school_id from public.profiles p
       where p.user_id = (select auth.uid())
    )
  );

create policy "people read support access evidence about themselves"
  on public.support_access_event for select to authenticated
  using (private.can_read_support_event(
    tenant_id, student_sha256, supporter_sha256
  ));

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
    or new.created_at is distinct from old.created_at
    or (old.revoked_at is not null and new.revoked_at is null)
  ) then
    raise exception 'A support grant identity and revocation are immutable.';
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

create or replace function private.audit_support_grant_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data public.support_access_grant := case when tg_op = 'DELETE' then old else new end;
  caller uuid := auth.uid();
  event_action text;
begin
  event_action := case
    when tg_op = 'INSERT' then 'grant_created'
    when tg_op = 'DELETE' then 'grant_deleted'
    when old.revoked_at is null and new.revoked_at is not null then 'grant_revoked'
    else 'grant_updated'
  end;

  insert into public.support_access_event (
    tenant_id, grant_id, action, student_sha256, supporter_sha256,
    actor_sha256, old_expires_at, new_expires_at,
    old_revoked_at, new_revoked_at
  ) values (
    row_data.tenant_id,
    row_data.id,
    event_action,
    private.role_audit_sha256(row_data.student_id::text),
    private.role_audit_sha256(row_data.supporter_id::text),
    case when caller is null then null
      else private.role_audit_sha256(caller::text) end,
    case when tg_op = 'INSERT' then null else old.expires_at end,
    case when tg_op = 'DELETE' then null else new.expires_at end,
    case when tg_op = 'INSERT' then null else old.revoked_at end,
    case when tg_op = 'DELETE' then null else new.revoked_at end
  );
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create or replace function private.revoke_support_grants_with_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'consented'
     or new.revoked_at is not null
     or (new.expires_at is not null and new.expires_at <= now()) then
    update public.support_access_grant
       set revoked_at = coalesce(revoked_at, now()), updated_at = now()
     where consent_id = new.id and revoked_at is null;
  end if;
  return new;
end $$;

create or replace function private.refuse_support_access_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Support access events are immutable.';
end $$;

revoke all on function private.assert_support_grant()
  from public, anon, authenticated;
revoke all on function private.audit_support_grant_change()
  from public, anon, authenticated;
revoke all on function private.revoke_support_grants_with_consent()
  from public, anon, authenticated;
revoke all on function private.refuse_support_access_event_change()
  from public, anon, authenticated;

create trigger support_grant_is_bounded
  before insert or update on public.support_access_grant
  for each row execute function private.assert_support_grant();
create trigger audit_support_grant
  after insert or update or delete on public.support_access_grant
  for each row execute function private.audit_support_grant_change();
create trigger consent_revokes_support_grants
  after update of status, revoked_at, expires_at on public.consent_record
  for each row execute function private.revoke_support_grants_with_consent();
create trigger keep_support_access_events_immutable
  before update or delete on public.support_access_event
  for each row execute function private.refuse_support_access_event_change();

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

create or replace function public.forget_my_support_access()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  who uuid := auth.uid();
  removed bigint;
begin
  if who is null then
    raise exception using errcode = '42501', message = 'Sign in first.';
  end if;

  delete from public.support_access_grant
   where student_id = who or supporter_id = who;
  get diagnostics removed = row_count;
  return removed;
end $$;

revoke all on function public.read_support_signals(uuid)
  from public, anon, authenticated;
revoke all on function public.forget_my_support_access()
  from public, anon, authenticated;
grant execute on function public.read_support_signals(uuid) to authenticated;
grant execute on function public.forget_my_support_access() to authenticated;

-- An LTI-provisioned account that created or received a support grant is not
-- empty and must not be retired during account linking. This is the complete
-- latest definition, not a delta: CREATE OR REPLACE replaces the whole body.
create or replace function public.lti_account_untouched(who uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t record;
  hit integer;
begin
  for t in
    select * from (values
      ('public.state',                'user_id'),
      ('public.courses',              'user_id'),
      ('public.notes',                'user_id'),
      ('public.tasks',                'user_id'),
      ('public.appointments',         'user_id'),
      ('public.sittings',             'user_id'),
      ('public.calendar_feeds',       'user_id'),
      ('public.messages',             'user_id'),
      ('public.message_reactions',    'user_id'),
      ('public.group_members',        'user_id'),
      ('public.enrollments',          'user_id'),
      ('public.blocks',               'user_id'),
      ('public.referrals',            'user_id'),
      ('public.referral_codes',       'user_id'),
      ('public.forms',                'owner'),
      ('public.family_grants',        'student_id'),
      ('public.feedback',             'author'),
      ('public.organization_members', 'user_id'),
      ('public.support_access_grant', 'student_id'),
      ('public.support_access_grant', 'supporter_id')
    ) as x(rel, col)
  loop
    if pg_catalog.to_regclass(t.rel) is null then continue; end if;
    execute pg_catalog.format(
      'select 1 from %s where %I = $1 limit 1', t.rel, t.col
    ) into hit using who;
    if hit is not null then return false; end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.lti_account_untouched(uuid) from public;
revoke all on function public.lti_account_untouched(uuid)
  from anon, authenticated;

comment on table public.support_access_grant is
  'One student, one verified supporter, one aggregate-only scope and at most seven days; revocation is permanent.';
comment on table public.support_access_event is
  'Immutable pseudonymous evidence of support-grant lifecycle and each aggregate signal read; no academic content.';
comment on function public.read_support_signals(uuid) is
  'Returns aggregate learning evidence only after role, tenant, consent, recipient, scope, expiry and revocation checks; records every read.';
comment on function public.forget_my_support_access() is
  'Deletes support grants where the caller is either student or supporter; immutable pseudonymous events remain.';
