-- Semester — a school administrator binds roster people to accounts, sees who
-- is still unbound, and decides whether absence from a complete roster ends
-- roster-given access.
--
-- `20261020013100_roster_completeness_and_projection.sql` built all three and
-- left them to the service key: `private.roster_bind_identity`,
-- `private.roster_unbound` and `roster_import_config.absence_revokes_access`.
-- Nobody at a school could do any of it in the app. This gives them a desk —
-- four `public` definers, each checking one capability over the school — and
-- changes nothing about what a binding or the switch means.
--
-- What is decided here, and where:
--
--   * **Who.** `roster:administer`, held over the school scope
--     (`private.has_capability(.., 'school', <school>)`, which matches scope
--     exactly: a grant at another school, over a course or over an office
--     does not reach it). It goes to the two roles that already administer a
--     school's integrations: `integration_admin`, who configures connections
--     (and the roster import is one), and `university_admin`, who approves
--     them. Not to a registrar, a faculty member, a student or any platform
--     role; a platform operator reaches a school only through a break-glass
--     grant naming this capability, as for every school capability.
--   * **Never yourself.** A binding gives the bound account the roster's
--     course grants — `faculty` for a teacher. So an administrator cannot bind
--     their own account: that would be granting themselves a course role. A
--     colleague with the same capability can.
--   * **Only somebody on the roster.** A binding must name a sourcedId that is
--     a user in the school's live roster; anything else is refused before
--     `roster_bind_identity` runs, so a typo cannot park a binding that some
--     later roster would quietly activate.
--   * **Idempotency.** `private.roster_admin_operation`, the gradebook's
--     shape (`gradebook_operations`): the same caller, key and request return
--     the first answer and write nothing; the same key for anything else is
--     refused. Refusals are not stored.
--   * **The absence switch is optimistic.** `want_expect` is the value the
--     administrator saw. If it has changed since, nothing is written. Turning
--     it on re-projects at once, so the receipt says how many roster grants
--     ended; the read says beforehand how many would.
--   * **Audit.** Every write lands in `public.audit_event` through
--     `private.record_audit` (`roster.identity_bound`,
--     `roster.absence_setting_changed`): pseudonymous, no names. The grants a
--     binding makes are audited again, row by row, by the `role_grants`
--     trigger, as every roster grant already is.
--   * **No domain event.** None of `packages/institution/src/events.ts`'s
--     names says "a roster person was bound", and that file's rule is that a
--     new name arrives with its first consumer. There is none: nothing
--     downstream acts on a binding except the projection, which runs here in
--     the same transaction.
--   * **No unbind.** Removing a binding would leave every grant it produced
--     live — the projection takes back an owned grant only on an explicit
--     inactive status or on absence with the switch on — so access would
--     outlive the binding with nothing left to say why. A safe unbind needs to
--     revoke the grants that binding owned in the same transaction; that is a
--     change to the projection, not to this desk.
--
-- What a read returns: sourcedId, roster role, given and family name, and the
-- offerings a binding would grant. Never email (the roster has none) and never
-- a credential reference.
--
-- Additive. NOT APPLIED to production; applying it needs owner approval.

-- ── 1. The capability ─────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('roster:administer', 'At one school: bind roster people to Semester accounts, list who is unbound, and turn absence-means-removal on or off. Never one''s own account.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('integration_admin', 'roster:administer'),
  ('university_admin',  'roster:administer')
on conflict (role, capability) do nothing;

-- ── 2. The desk's ledger ──────────────────────────────────────────────────

create table if not exists private.roster_admin_operation (
  tenant_id       text        not null references public.schools(id) on delete cascade,
  idempotency_key text        not null check (idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'),
  actor           uuid        references auth.users on delete set null,
  kind            text        not null check (kind in ('bind', 'absence')),
  request         jsonb       not null,
  result          jsonb       not null,
  created_at      timestamptz not null default now(),
  primary key (tenant_id, idempotency_key)
);
create index if not exists roster_admin_operation_by_actor
  on private.roster_admin_operation (actor) where actor is not null;

alter table private.roster_admin_operation enable row level security;
revoke all on private.roster_admin_operation from public, anon, authenticated;

comment on table private.roster_admin_operation is
  'The roster desk''s answers, by idempotency key: a repeated request returns the first answer and writes nothing. Refusals are not stored.';

-- ── 3. Helpers ────────────────────────────────────────────────────────────

-- Raises unless the caller holds roster:administer over exactly this school.
create or replace function private.roster_admin_require(want_tenant text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'semester: not signed in' using errcode = 'insufficient_privilege';
  end if;
  if want_tenant is null
     or not private.has_capability('roster:administer', 'school', want_tenant) then
    raise exception 'semester: the roster desk needs roster:administer at this school' using errcode = 'insufficient_privilege';
  end if;
  return me;
end $$;

-- Null means go ahead; otherwise the first answer, to replay. Holds a lock on
-- the key until commit, so two calls with one key cannot both do the work.
create or replace function private.roster_admin_replay(want_tenant text, want_key text, want_kind text, want_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  op private.roster_admin_operation;
begin
  if want_key is null or want_key !~ '^[A-Za-z0-9:._-]{8,200}$' then
    raise exception 'semester: an idempotency key is 8 to 200 letters, digits or : . _ -' using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('roster-admin-op:' || want_tenant || ':' || want_key));
  select * into op from private.roster_admin_operation o
   where o.tenant_id = want_tenant and o.idempotency_key = want_key;
  if not found then return null; end if;
  if op.actor is distinct from (select auth.uid()) or op.kind <> want_kind or op.request <> want_request then
    raise exception 'semester: that idempotency key was already used for a different request' using errcode = 'unique_violation';
  end if;
  return op.result || jsonb_build_object('replayed', true);
end $$;

-- What turning absence-means-removal on would do now: whether the live roster
-- can speak for absence (it rests on a complete batch with no partial one
-- after it — the same test `roster_project_grants` makes), and how many
-- roster-given grants it no longer lists.
create or replace function private.roster_absence_reach(want_tenant text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with complete as (
    select coalesce(bool_and(b.completeness = 'complete'), false) as ok
      from private.roster_import_batch b
     where b.tenant_id = want_tenant and b.status = 'promoted'
       and b.promoted_at >= coalesce((select max(promoted_at) from private.roster_import_batch
                                       where tenant_id = want_tenant and status = 'promoted' and completeness = 'complete'),
                                     'infinity'::timestamptz)
  ),
  absent as (
    select count(*) as n
      from public.role_grants r
      join private.roster_grant rg on rg.grant_id = r.id and rg.tenant_id = want_tenant and rg.owned
     where r.revoked_at is null
       and not exists (select 1 from private.roster_desired_grants(want_tenant) dg
                        where dg.subject = r.subject and dg.role = r.role
                          and r.scope_kind = 'course' and dg.scope_id = r.scope_id)
  )
  select jsonb_build_object(
    'roster_complete', (select ok from complete),
    'would_end', case when (select ok from complete) then (select n from absent) else 0 end);
$$;

-- ── 4. The desk ───────────────────────────────────────────────────────────

-- Roster people at this school with no account bound, and what a binding
-- would give each: one row per person, at most 1000, by name.
create or replace function public.roster_admin_unbound(want_tenant text)
returns table (sourced_id text, role text, given_name text, family_name text, courses jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.roster_admin_require(want_tenant);
  return query
    select u.sourced_id,
           u.payload ->> 'role',
           u.payload ->> 'givenName',
           u.payload ->> 'familyName',
           coalesce((
             select jsonb_agg(distinct jsonb_build_object(
                      'course', c.payload ->> 'courseCode',
                      'term', c.payload ->> 'termCode',
                      'role', case lower(e.payload ->> 'role')
                                when 'student' then 'student'
                                when 'teacher' then 'faculty'
                                else 'teaching_assistant' end))
               from private.roster_current e
               join private.roster_current c
                 on c.tenant_id = e.tenant_id and c.entity = 'classes' and c.sourced_id = e.payload ->> 'classSourcedId'
              where e.tenant_id = u.tenant_id and e.entity = 'enrollments'
                and e.payload ->> 'userSourcedId' = u.sourced_id
                and coalesce(lower(e.payload ->> 'status'), 'active') in ('active', '')
                and coalesce(lower(c.payload ->> 'status'), 'active') in ('active', '')
                and lower(coalesce(e.payload ->> 'role', '')) in ('student', 'teacher', 'aide', 'teaching_assistant')
                and coalesce(c.payload ->> 'courseCode', '') ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$'
                and coalesce(c.payload ->> 'termCode', '') ~ '^[0-9]{4}(FA|SP|SU)$'
           ), '[]'::jsonb)
      from private.roster_current u
     where u.tenant_id = want_tenant and u.entity = 'users'
       and not exists (select 1 from private.roster_identity i
                        where i.tenant_id = u.tenant_id and i.sourced_id = u.sourced_id)
     order by lower(coalesce(u.payload ->> 'familyName', '')), lower(coalesce(u.payload ->> 'givenName', '')), u.sourced_id
     limit 1000;
end $$;

-- Bind one roster person to one account at this school, by an administrator's
-- review. Answers {outcome: bound | already-bound, grants: [{role, scope}],
-- replayed}.
create or replace function public.roster_admin_bind(want_tenant text, want_sourced_id text, want_subject uuid, want_key text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me      uuid := private.roster_admin_require(want_tenant);
  req     jsonb := jsonb_build_object('sourced_id', want_sourced_id, 'subject', want_subject);
  prior   jsonb;
  outcome text;
  grants  jsonb;
  answer  jsonb;
begin
  if coalesce(want_sourced_id, '') = '' or want_subject is null then
    raise exception 'semester: a binding names a roster person and an account' using errcode = 'check_violation';
  end if;

  prior := private.roster_admin_replay(want_tenant, want_key, 'bind', req);
  if prior is not null then return prior; end if;

  if want_subject = me then
    raise exception 'semester: you cannot bind your own account; another administrator at your school can' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from private.roster_current u
                  where u.tenant_id = want_tenant and u.entity = 'users' and u.sourced_id = want_sourced_id) then
    raise exception 'semester: that person is not on this school''s roster' using errcode = 'check_violation';
  end if;

  begin
    outcome := private.roster_bind_identity(want_tenant, want_sourced_id, want_subject, 'admin_review', me);
  exception
    when insufficient_privilege then
      raise exception 'semester: that account is not at this school' using errcode = 'insufficient_privilege';
    when unique_violation then
      raise exception 'semester: %', replace(sqlerrm, 'roster_bind_identity: ', '') using errcode = 'unique_violation';
  end;

  select coalesce(jsonb_agg(jsonb_build_object('role', d.role, 'scope', d.scope_id) order by d.scope_id, d.role), '[]'::jsonb)
    into grants
    from private.roster_desired_grants(want_tenant) d
   where d.subject = want_subject;

  if outcome = 'bound' then
    perform private.record_audit(want_tenant, 'roster.identity_bound', 'roster_identity', want_sourced_id, 'allowed',
      left(want_key, 100), jsonb_build_object('method', 'admin_review', 'grants', jsonb_array_length(grants)));
  end if;

  answer := jsonb_build_object('outcome', outcome, 'grants', grants, 'replayed', false);
  insert into private.roster_admin_operation (tenant_id, idempotency_key, actor, kind, request, result)
  values (want_tenant, want_key, me, 'bind', req, answer);
  return answer;
end $$;

-- The school's roster settings, and what turning absence-means-removal on
-- would do right now.
create or replace function public.roster_admin_config(want_tenant text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c private.roster_import_config;
begin
  perform private.roster_admin_require(want_tenant);
  select * into c from private.roster_import_config where tenant_id = want_tenant;
  return jsonb_build_object(
    'configured', c.tenant_id is not null,
    'source_kind', c.source_kind,
    'absence_revokes_access', coalesce(c.absence_revokes_access, false),
    'max_removal_pct', c.max_removal_pct,
    'updated_at', c.updated_at,
    'last_promoted_at', (select max(promoted_at) from private.roster_import_batch
                          where tenant_id = want_tenant and status = 'promoted'),
    'unbound', (select count(*) from private.roster_current u
                 where u.tenant_id = want_tenant and u.entity = 'users'
                   and not exists (select 1 from private.roster_identity i
                                    where i.tenant_id = u.tenant_id and i.sourced_id = u.sourced_id))
  ) || private.roster_absence_reach(want_tenant);
end $$;

-- Turn absence-means-removal on or off. `want_expect` is the value the
-- administrator saw; if it is no longer the value, nothing is written. The
-- roster is projected again at once, so the answer says what ended.
create or replace function public.roster_admin_set_absence(want_tenant text, want_on boolean, want_expect boolean, want_key text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me     uuid := private.roster_admin_require(want_tenant);
  req    jsonb := jsonb_build_object('on', want_on, 'expect', want_expect);
  prior  jsonb;
  c      private.roster_import_config;
  report jsonb;
  answer jsonb;
begin
  if want_on is null or want_expect is null then
    raise exception 'semester: say whether it should be on, and what you saw' using errcode = 'check_violation';
  end if;

  prior := private.roster_admin_replay(want_tenant, want_key, 'absence', req);
  if prior is not null then return prior; end if;

  select * into c from private.roster_import_config where tenant_id = want_tenant for update;
  if not found then
    raise exception 'semester: roster import is not set up for this school yet' using errcode = 'check_violation';
  end if;
  if c.absence_revokes_access is distinct from want_expect then
    raise exception 'semester: stale: someone changed this setting since you looked; nothing was changed' using errcode = 'serialization_failure';
  end if;

  if want_on = c.absence_revokes_access then
    answer := jsonb_build_object('outcome', 'unchanged', 'on', want_on, 'grants', null, 'replayed', false);
  else
    update private.roster_import_config
       set absence_revokes_access = want_on, updated_at = now()
     where tenant_id = want_tenant;
    report := private.roster_project_grants(want_tenant);
    perform private.record_audit(want_tenant, 'roster.absence_setting_changed', 'roster_import_config', want_tenant, 'allowed',
      left(want_key, 100), jsonb_build_object('from', c.absence_revokes_access, 'to', want_on,
                                              'revoked', coalesce((report ->> 'revoked')::int, 0)));
    answer := jsonb_build_object('outcome', case when want_on then 'turned-on' else 'turned-off' end,
                                 'on', want_on, 'grants', report, 'replayed', false);
  end if;

  insert into private.roster_admin_operation (tenant_id, idempotency_key, actor, kind, request, result)
  values (want_tenant, want_key, me, 'absence', req, answer);
  return answer;
end $$;

-- ── 5. Who may call what ──────────────────────────────────────────────────

revoke all on function private.roster_admin_require(text) from public, anon, authenticated;
revoke all on function private.roster_admin_replay(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.roster_absence_reach(text) from public, anon, authenticated;

revoke all on function public.roster_admin_unbound(text) from public, anon, authenticated;
revoke all on function public.roster_admin_bind(text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.roster_admin_config(text) from public, anon, authenticated;
revoke all on function public.roster_admin_set_absence(text, boolean, boolean, text) from public, anon, authenticated;
grant execute on function public.roster_admin_unbound(text) to authenticated;
grant execute on function public.roster_admin_bind(text, text, uuid, text) to authenticated;
grant execute on function public.roster_admin_config(text) to authenticated;
grant execute on function public.roster_admin_set_absence(text, boolean, boolean, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rolling back
--
--   begin;
--   drop function if exists public.roster_admin_set_absence(text, boolean, boolean, text);
--   drop function if exists public.roster_admin_config(text);
--   drop function if exists public.roster_admin_bind(text, text, uuid, text);
--   drop function if exists public.roster_admin_unbound(text);
--   drop function if exists private.roster_absence_reach(text);
--   drop function if exists private.roster_admin_replay(text, text, text, jsonb);
--   drop function if exists private.roster_admin_require(text);
--   drop table if exists private.roster_admin_operation;
--   delete from public.role_capabilities where capability = 'roster:administer';
--   delete from public.app_capabilities where capability = 'roster:administer';
--   commit;
--
-- Bindings made at the desk stay (`private.roster_identity`, method
-- `admin_review`) and so do the grants they produced; both belong to the
-- roster projection, which this file did not change.
