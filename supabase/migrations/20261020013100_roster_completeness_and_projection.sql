-- A roster import knows whether it is the whole roster, refuses to go back in
-- time, links roster people to accounts only by an explicit binding, and turns
-- the promoted roster into the course-and-term grants the rest of Semester
-- already checks.
--
-- The first step of replacing a rostering service (Clever Secure Sync, a SIS
-- export, OneRoster): `20260930220000_roster_import_staging.sql` built the
-- staging area — closed row shapes, a manifest, a removal threshold with a
-- second approver, last-known-good rollback — and said nothing read
-- `roster_current`. This makes it something a student's access depends on,
-- and closes the three ways a roster sync goes wrong at scale.
--
-- What it decides, and where:
--
--   * **Completeness.** A batch says whether it is the whole roster
--     (`complete`), part of it (`partial`) or cannot tell (`unknown`). Only a
--     complete batch can remove anything: promoting a partial or unknown batch
--     adds and changes rows and leaves every row it did not mention exactly
--     where it was. A fetch that timed out halfway can no longer read as
--     "everyone missing has withdrawn". Batches staged by the old signature
--     keep their old meaning (`complete`), so nothing already written changes.
--   * **No going back in time.** A batch may carry the time the source was
--     read (`observed_at`) and the source's own version. A batch observed
--     before the most recent promoted batch for the same school is refused at
--     promotion, so a replayed or delayed export cannot overwrite a newer one.
--   * **Identity by binding, never by email.** `private.roster_identity` maps
--     a roster user's sourcedId to one Semester account at that school.
--     Bindings are made by the service (from SCIM, an approved SSO subject, or
--     an administrator's review) through `roster_bind_identity`, which refuses
--     an account at another school and refuses moving a sourcedId to a second
--     account. The roster's own rows carry no email (the staging allowlist
--     never admitted one), so there is nothing to guess from. An unbound
--     roster user simply gets nothing until somebody binds them;
--     `roster_unbound` lists them for review.
--   * **The roster becomes access.** After every promotion and rollback,
--     `roster_project_grants` derives, for each enrollment whose user is bound
--     and whose class names a course code and a term (`termCode`, now on the
--     class allowlist), the grant Semester already uses for that offering:
--     scope `<school>/<CODE>/<TERM>`, role `student` for a student,
--     `faculty` for a teacher, `teaching_assistant` for an aide or TA. Those
--     are the grants `grades:receive`, `submissions:create` and the gradebook's
--     staff capabilities read. Co-teachers each get their own grant.
--     Provenance is `institution`.
--   * **The roster only takes back what it gave, and absence is not a
--     withdrawal unless the school says so.** `private.roster_grant` records
--     each grant the projection created or re-activated; a grant an
--     administrator, an LTI launch or SCIM made before the roster is noted
--     and never revoked by it. A grant the roster gave ends in two ways:
--     the source says so explicitly (an enrollment marked `inactive` or
--     `tobedeleted`, in any batch), or — only when the school has turned on
--     `roster_import_config.absence_revokes_access` (off by default) and the
--     live roster rests on a complete batch with no partial batch after it —
--     the enrollment is simply no longer there. A Clever-style deletion can
--     mean "no longer shared" rather than "withdrew"; treating absence as
--     withdrawal is the school's decision, not the connector's. Revocation is
--     `revoked_at`, so the grant audit trigger records it and a later roster
--     can restore it.
--   * **Roster scopes on approved connections.** Owner decision, 20 October
--     2026: an outside application may receive roster data when the school
--     approves the connection. `integration_scopes` no longer lists `roster`
--     among the names a scope can never have; a roster scope must be `read`
--     or `event` and must declare the education-record ceiling `T3`, and it
--     is still approved only through `integration_approve_scope`, which
--     refuses the person who proposed it. Grades, submissions, accommodations,
--     health, counselling, conduct, instructor notes and aid stay on the
--     never list.
--
-- Everything here stays server-only: tables in `private` with no client
-- grants, functions executable by `service_role` alone.
--
-- Additive. NOT APPLIED to production; applying it needs owner approval.

-- ── Batches say what they are ─────────────────────────────────────────────

alter table private.roster_import_batch
  add column if not exists completeness text not null default 'complete'
    check (completeness in ('complete', 'partial', 'unknown')),
  add column if not exists source_version text
    check (source_version is null or length(source_version) between 1 and 200),
  add column if not exists observed_at timestamptz;

alter table private.roster_import_config
  add column if not exists absence_revokes_access boolean not null default false;

comment on column private.roster_import_config.absence_revokes_access is
  'Whether a complete roster that no longer lists an enrollment ends the access the roster gave. Off until the school approves that reading; an explicit inactive or tobedeleted status ends it either way.';

comment on column private.roster_import_batch.completeness is
  'Whether the batch is the whole roster. Only a complete batch can remove rows or revoke roster grants.';

-- A class may name its term code, so the projection can build `<school>/<CODE>/<TERM>`.
create or replace function private.roster_allowed_keys(want_entity text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case want_entity
    when 'orgs'        then array['name', 'type', 'status', 'parentSourcedId']
    when 'users'       then array['status', 'role', 'givenName', 'familyName', 'orgSourcedIds']
    when 'classes'     then array['title', 'courseCode', 'status', 'orgSourcedId', 'termSourcedId', 'termCode']
    when 'enrollments' then array['userSourcedId', 'classSourcedId', 'role', 'status']
  end;
$$;

-- ── Stage, with completeness and the source's clock ───────────────────────
-- A new name rather than an overload: a second `roster_stage` with defaulted
-- extra arguments would make every five-argument call ambiguous. The
-- five-argument `roster_stage` keeps its signature and meaning, and calls this
-- with `complete`.

create or replace function private.roster_stage_batch(
  want_tenant text,
  want_source text,
  want_manifest jsonb,
  want_rows jsonb,
  want_staged_by uuid,
  want_completeness text,
  want_source_version text,
  want_observed_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  digest text;
  batch uuid;
  r jsonb;
  problem text;
  bad jsonb := '[]'::jsonb;
  n integer := 0;
begin
  if not exists (select 1 from public.schools where id = want_tenant) then
    raise exception 'roster_stage: no such school' using errcode = '22023';
  end if;
  if want_source not in ('csv', 'rest') then
    raise exception 'roster_stage: source must be csv or rest' using errcode = '22023';
  end if;
  if want_completeness is null or want_completeness not in ('complete', 'partial', 'unknown') then
    raise exception 'roster_stage_batch: completeness must be complete, partial or unknown' using errcode = '22023';
  end if;
  if want_source = 'rest' and not exists (
    select 1 from private.roster_import_config c
     where c.tenant_id = want_tenant and c.source_kind = 'rest' and c.credentials_reference is not null
  ) then
    raise exception 'roster_stage: a REST batch needs a configured REST source with a credential reference for this school' using errcode = '42501';
  end if;
  if jsonb_typeof(want_manifest -> 'files') is distinct from 'array'
     or jsonb_typeof(want_rows) is distinct from 'array' then
    raise exception 'roster_stage: manifest.files and rows must be arrays' using errcode = '22023';
  end if;
  if jsonb_array_length(want_rows) > 200000 then
    raise exception 'roster_stage: more than 200000 rows in one batch' using errcode = '22023';
  end if;

  digest := encode(sha256(convert_to(want_manifest::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(hashtext('roster:' || want_tenant));

  select id into batch from private.roster_import_batch
   where tenant_id = want_tenant and manifest_sha256 = digest;
  if batch is not null then return batch; end if;

  insert into private.roster_import_batch
    (tenant_id, source_kind, manifest, manifest_sha256, staged_by, completeness, source_version, observed_at)
  values (want_tenant, want_source, want_manifest, digest, want_staged_by, want_completeness,
          nullif(btrim(coalesce(want_source_version, '')), ''), want_observed_at)
  returning id into batch;

  for r in select * from jsonb_array_elements(want_rows) loop
    n := n + 1;
    problem := private.roster_row_problem(r ->> 'entity', r -> 'payload');
    if problem is null and coalesce(r ->> 'sourcedId', '') = '' then problem := 'row has no sourcedId'; end if;
    if problem is not null then
      if jsonb_array_length(bad) < 20 then
        bad := bad || jsonb_build_object('row', n, 'problem', problem);
      end if;
      continue;
    end if;
    insert into private.roster_staged_row (batch_id, tenant_id, entity, sourced_id, payload, row_hash)
    values (batch, want_tenant, r ->> 'entity', r ->> 'sourcedId', r -> 'payload',
            encode(sha256(convert_to((r ->> 'entity') || ':' || (r ->> 'sourcedId') || ':' || (r -> 'payload')::text, 'UTF8')), 'hex'))
    on conflict (batch_id, entity, sourced_id) do update set payload = excluded.payload
    where false;
    if not found then
      if jsonb_array_length(bad) < 20 then
        bad := bad || jsonb_build_object('row', n, 'problem', 'duplicate sourcedId in this batch');
      end if;
    end if;
  end loop;

  if jsonb_array_length(bad) > 0 then
    update private.roster_import_batch set status = 'rejected', problems = bad where id = batch;
  end if;
  return batch;
end;
$$;

create or replace function private.roster_stage(
  want_tenant text,
  want_source text,
  want_manifest jsonb,
  want_rows jsonb,
  want_staged_by uuid default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select private.roster_stage_batch(want_tenant, want_source, want_manifest, want_rows, want_staged_by, 'complete', null, null);
$$;

-- ── Validate: an incomplete batch need not carry every referenced row ─────
-- A partial batch may enroll somebody already in the live roster, so an
-- enrollment may point at a user or class that is staged **or** current.

create or replace function private.roster_validate(want_batch uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  b private.roster_import_batch%rowtype;
  f jsonb;
  ent text;
  staged_rows bigint;
  bad jsonb := '[]'::jsonb;
  listed text[] := '{}';
begin
  select * into b from private.roster_import_batch where id = want_batch for update;
  if not found then raise exception 'roster_validate: no such batch' using errcode = '22023'; end if;
  if b.status <> 'staged' then return b.status; end if;

  for f in select * from jsonb_array_elements(b.manifest -> 'files') loop
    ent := f ->> 'entity';
    if ent is null or ent not in ('orgs', 'users', 'classes', 'enrollments') then
      bad := bad || jsonb_build_object('problem', 'manifest lists an unknown entity');
      continue;
    end if;
    if ent = any (listed) then
      bad := bad || jsonb_build_object('entity', ent, 'problem', 'manifest lists the entity twice');
      continue;
    end if;
    listed := listed || ent;
    select count(*) into staged_rows from private.roster_staged_row where batch_id = b.id and entity = ent;
    if staged_rows <> coalesce((f ->> 'rows')::bigint, -1) then
      bad := bad || jsonb_build_object('entity', ent, 'problem', 'row count differs from the manifest');
    end if;
    if private.roster_entity_digest(b.id, ent) is distinct from (f ->> 'sha256') then
      bad := bad || jsonb_build_object('entity', ent, 'problem', 'content digest differs from the manifest');
    end if;
  end loop;

  for ent in
    select distinct entity from private.roster_staged_row
     where batch_id = b.id and not (entity = any (listed))
  loop
    bad := bad || jsonb_build_object('entity', ent, 'problem', 'rows staged for an entity the manifest does not list');
  end loop;

  if exists (
    select 1 from private.roster_staged_row e
     where e.batch_id = b.id and e.entity = 'enrollments'
       and (not (exists (select 1 from private.roster_staged_row u
                          where u.batch_id = b.id and u.entity = 'users' and u.sourced_id = e.payload ->> 'userSourcedId')
                 or (b.completeness <> 'complete' and exists (
                       select 1 from private.roster_current u
                        where u.tenant_id = b.tenant_id and u.entity = 'users' and u.sourced_id = e.payload ->> 'userSourcedId')))
         or not (exists (select 1 from private.roster_staged_row c
                          where c.batch_id = b.id and c.entity = 'classes' and c.sourced_id = e.payload ->> 'classSourcedId')
                 or (b.completeness <> 'complete' and exists (
                       select 1 from private.roster_current c
                        where c.tenant_id = b.tenant_id and c.entity = 'classes' and c.sourced_id = e.payload ->> 'classSourcedId'))))
  ) then
    bad := bad || jsonb_build_object('entity', 'enrollments', 'problem', 'an enrollment names a user or class that is not in the batch');
  end if;

  update private.roster_import_batch
     set status = case when jsonb_array_length(bad) = 0 then 'validated' else 'rejected' end,
         problems = bad
   where id = b.id;
  return case when jsonb_array_length(bad) = 0 then 'validated' else 'rejected' end;
end;
$$;

-- ── Reconcile: an incomplete batch removes nothing ────────────────────────

create or replace function private.roster_reconcile(want_batch uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with b as (select id, tenant_id, completeness from private.roster_import_batch where id = want_batch),
  ents as (select unnest(array['orgs', 'users', 'classes', 'enrollments']) as entity),
  per as (
    select e.entity,
      (select count(*) from private.roster_staged_row s join b on s.batch_id = b.id
        where s.entity = e.entity
          and not exists (select 1 from private.roster_current c
                           where c.tenant_id = b.tenant_id and c.entity = e.entity and c.sourced_id = s.sourced_id)) as added,
      (select count(*) from private.roster_staged_row s join b on s.batch_id = b.id
         join private.roster_current c on c.tenant_id = b.tenant_id and c.entity = e.entity and c.sourced_id = s.sourced_id
        where s.entity = e.entity and c.row_hash <> s.row_hash) as changed,
      (select count(*) from private.roster_staged_row s join b on s.batch_id = b.id
         join private.roster_current c on c.tenant_id = b.tenant_id and c.entity = e.entity and c.sourced_id = s.sourced_id
        where s.entity = e.entity and c.row_hash = s.row_hash) as unchanged,
      (select count(*) from private.roster_current c join b on c.tenant_id = b.tenant_id
        where c.entity = e.entity
          and not exists (select 1 from private.roster_staged_row s
                           where s.batch_id = b.id and s.entity = e.entity and s.sourced_id = c.sourced_id)) as not_seen,
      (select count(*) from private.roster_current c join b on c.tenant_id = b.tenant_id
        where c.entity = e.entity) as current_rows
    from ents e
  )
  select jsonb_build_object(
    'completeness', (select completeness from b),
    'entities', coalesce(jsonb_object_agg(entity, jsonb_build_object(
        'added', added, 'changed', changed, 'unchanged', unchanged,
        'removed', case when (select completeness from b) = 'complete' then not_seen else 0 end,
        'not_seen', not_seen)), '{}'::jsonb),
    'added', coalesce(sum(added), 0), 'changed', coalesce(sum(changed), 0),
    'unchanged', coalesce(sum(unchanged), 0),
    'removed', case when (select completeness from b) = 'complete' then coalesce(sum(not_seen), 0) else 0 end,
    'not_seen', coalesce(sum(not_seen), 0),
    'current_rows', coalesce(sum(current_rows), 0)
  ) from per;
$$;

-- ── Identity: an explicit binding, one account per roster person ──────────

create table if not exists private.roster_identity (
  tenant_id  text        not null references public.schools(id) on delete cascade,
  sourced_id text        not null check (length(sourced_id) between 1 and 200),
  subject    uuid        not null references auth.users on delete cascade,
  method     text        not null check (method in ('scim', 'sso_subject', 'admin_review')),
  bound_by   uuid        references auth.users on delete set null,
  bound_at   timestamptz not null default now(),
  primary key (tenant_id, sourced_id),
  unique (tenant_id, subject)
);
create index if not exists roster_identity_by_subject on private.roster_identity (subject);
create index if not exists roster_identity_by_bound_by on private.roster_identity (bound_by) where bound_by is not null;

alter table private.roster_identity enable row level security;
revoke all on private.roster_identity from public, anon, authenticated;

comment on table private.roster_identity is
  'Which Semester account a roster person is, at one school. Made only by an explicit binding, never by matching email.';

-- Bind a roster person to an account. The same binding again is a no-op;
-- a sourcedId already bound to someone else, or an account already bound to
-- another sourcedId, or an account at another school, is refused.
create or replace function private.roster_bind_identity(
  want_tenant text, want_sourced_id text, want_subject uuid, want_method text, want_bound_by uuid default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  was private.roster_identity%rowtype;
begin
  if want_method is null or want_method not in ('scim', 'sso_subject', 'admin_review') then
    raise exception 'roster_bind_identity: method must be scim, sso_subject or admin_review' using errcode = '22023';
  end if;
  if coalesce(want_sourced_id, '') = '' or want_subject is null then
    raise exception 'roster_bind_identity: a binding names a roster person and an account' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = want_subject and p.school_id = want_tenant) then
    raise exception 'roster_bind_identity: that account is not at this school' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('roster-identity:' || want_tenant));
  select * into was from private.roster_identity where tenant_id = want_tenant and sourced_id = want_sourced_id;
  if found then
    if was.subject = want_subject then return 'already-bound'; end if;
    raise exception 'roster_bind_identity: that roster person is already bound to another account; unbind it first' using errcode = '23505';
  end if;
  if exists (select 1 from private.roster_identity where tenant_id = want_tenant and subject = want_subject) then
    raise exception 'roster_bind_identity: that account is already bound to another roster person' using errcode = '23505';
  end if;
  insert into private.roster_identity (tenant_id, sourced_id, subject, method, bound_by)
  values (want_tenant, want_sourced_id, want_subject, want_method, want_bound_by);
  perform private.roster_project_grants(want_tenant);
  return 'bound';
end;
$$;

-- Roster users with no binding: the review list.
create or replace function private.roster_unbound(want_tenant text)
returns table (sourced_id text, role text, enrollments bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select u.sourced_id, u.payload ->> 'role',
         (select count(*) from private.roster_current e
           where e.tenant_id = u.tenant_id and e.entity = 'enrollments' and e.payload ->> 'userSourcedId' = u.sourced_id)
    from private.roster_current u
   where u.tenant_id = want_tenant and u.entity = 'users'
     and not exists (select 1 from private.roster_identity i where i.tenant_id = u.tenant_id and i.sourced_id = u.sourced_id)
   order by u.sourced_id;
$$;

-- ── The grants the roster made ────────────────────────────────────────────

create table if not exists private.roster_grant (
  tenant_id text        not null references public.schools(id) on delete cascade,
  grant_id  uuid        not null references public.role_grants(id) on delete cascade,
  -- True when the roster created the row or re-activated a revoked one; false
  -- when the grant was already live from another source and the roster only
  -- noted it. Only a grant the roster gave is one the roster may take back.
  owned     boolean     not null,
  noted_at  timestamptz not null default now(),
  primary key (tenant_id, grant_id)
);
create index if not exists roster_grant_by_grant on private.roster_grant (grant_id);

alter table private.roster_grant enable row level security;
revoke all on private.roster_grant from public, anon, authenticated;

comment on table private.roster_grant is
  'Course-and-term grants the roster projection created or noted. The projection revokes only rows it owns.';

-- The grants the live roster implies, one per (account, role, offering).
create or replace function private.roster_desired_grants(want_tenant text)
returns table (subject uuid, role text, scope_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct i.subject,
         case lower(coalesce(e.payload ->> 'role', ''))
           when 'student' then 'student'
           when 'teacher' then 'faculty'
           when 'aide' then 'teaching_assistant'
           when 'teaching_assistant' then 'teaching_assistant'
         end,
         want_tenant || '/' || (c.payload ->> 'courseCode') || '/' || (c.payload ->> 'termCode')
    from private.roster_current e
    join private.roster_current c
      on c.tenant_id = e.tenant_id and c.entity = 'classes' and c.sourced_id = e.payload ->> 'classSourcedId'
    join private.roster_identity i
      on i.tenant_id = e.tenant_id and i.sourced_id = e.payload ->> 'userSourcedId'
   where e.tenant_id = want_tenant and e.entity = 'enrollments'
     and coalesce(lower(e.payload ->> 'status'), 'active') in ('active', '')
     and coalesce(lower(c.payload ->> 'status'), 'active') in ('active', '')
     and lower(coalesce(e.payload ->> 'role', '')) in ('student', 'teacher', 'aide', 'teaching_assistant')
     and coalesce(c.payload ->> 'courseCode', '') ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$'
     and coalesce(c.payload ->> 'termCode', '') ~ '^[0-9]{4}(FA|SP|SU)$';
$$;

-- The grants the live roster explicitly ends: enrollments the source marks
-- inactive or tobedeleted, mapped the same way as the desired grants.
create or replace function private.roster_ended_grants(want_tenant text)
returns table (subject uuid, role text, scope_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct i.subject,
         case lower(coalesce(e.payload ->> 'role', ''))
           when 'student' then 'student'
           when 'teacher' then 'faculty'
           when 'aide' then 'teaching_assistant'
           when 'teaching_assistant' then 'teaching_assistant'
         end,
         want_tenant || '/' || (c.payload ->> 'courseCode') || '/' || (c.payload ->> 'termCode')
    from private.roster_current e
    join private.roster_current c
      on c.tenant_id = e.tenant_id and c.entity = 'classes' and c.sourced_id = e.payload ->> 'classSourcedId'
    join private.roster_identity i
      on i.tenant_id = e.tenant_id and i.sourced_id = e.payload ->> 'userSourcedId'
   where e.tenant_id = want_tenant and e.entity = 'enrollments'
     and lower(coalesce(e.payload ->> 'status', '')) in ('inactive', 'tobedeleted')
     and lower(coalesce(e.payload ->> 'role', '')) in ('student', 'teacher', 'aide', 'teaching_assistant')
     and coalesce(c.payload ->> 'courseCode', '') ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$'
     and coalesce(c.payload ->> 'termCode', '') ~ '^[0-9]{4}(FA|SP|SU)$';
$$;

-- Bring role_grants into line with the live roster for one school. Grants
-- missing are created (or re-activated); grants the roster owns and no longer
-- implies are revoked — but only when the live roster came from a complete
-- batch. Answers {granted, revoked, kept}.
create or replace function private.roster_project_grants(want_tenant text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d record;
  g public.role_grants%rowtype;
  granted integer := 0;
  revoked integer := 0;
  kept integer := 0;
  complete boolean;
begin
  perform pg_advisory_xact_lock(hashtext('roster-grants:' || want_tenant));

  for d in select * from private.roster_desired_grants(want_tenant) loop
    select * into g from public.role_grants r
     where r.subject = d.subject and r.role = d.role and r.scope_kind = 'course' and r.scope_id = d.scope_id;
    if not found then
      insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
      values (d.subject, d.role, 'course', d.scope_id, 'institution')
      returning * into g;
      insert into private.roster_grant (tenant_id, grant_id, owned) values (want_tenant, g.id, true)
      on conflict (tenant_id, grant_id) do update set owned = true, noted_at = now();
      granted := granted + 1;
    elsif g.revoked_at is not null or (g.expires_at is not null and g.expires_at <= now()) then
      update public.role_grants set revoked_at = null, expires_at = null where id = g.id;
      insert into private.roster_grant (tenant_id, grant_id, owned) values (want_tenant, g.id, true)
      on conflict (tenant_id, grant_id) do update set owned = true, noted_at = now();
      granted := granted + 1;
    else
      insert into private.roster_grant (tenant_id, grant_id, owned) values (want_tenant, g.id, false)
      on conflict (tenant_id, grant_id) do nothing;
      kept := kept + 1;
    end if;
  end loop;

  -- An explicit end — the source says inactive or tobedeleted — ends the
  -- access the roster gave, whatever the batch's completeness: it is a
  -- statement, not an absence.
  for g in
    select r.* from public.role_grants r
      join private.roster_grant rg on rg.grant_id = r.id and rg.tenant_id = want_tenant and rg.owned
     where r.revoked_at is null
       and exists (select 1 from private.roster_ended_grants(want_tenant) eg
                    where eg.subject = r.subject and eg.role = r.role and r.scope_kind = 'course' and eg.scope_id = r.scope_id)
       and not exists (select 1 from private.roster_desired_grants(want_tenant) dg
                        where dg.subject = r.subject and dg.role = r.role and r.scope_kind = 'course' and dg.scope_id = r.scope_id)
  loop
    update public.role_grants set revoked_at = now() where id = g.id;
    revoked := revoked + 1;
  end loop;

  -- Absence ends access only when the school has said it should, and only
  -- when the live roster can speak for absence: the batch whose rows are live
  -- must rest on a complete batch with no partial one promoted after it.
  select coalesce(bool_and(b.completeness = 'complete'), false) into complete
    from private.roster_import_batch b
   where b.tenant_id = want_tenant and b.status = 'promoted'
     and b.promoted_at >= coalesce((select max(promoted_at) from private.roster_import_batch
                                     where tenant_id = want_tenant and status = 'promoted' and completeness = 'complete'),
                                   'infinity'::timestamptz);
  complete := complete and coalesce((select c.absence_revokes_access from private.roster_import_config c
                                      where c.tenant_id = want_tenant), false);

  if complete then
    for g in
      select r.* from public.role_grants r
        join private.roster_grant rg on rg.grant_id = r.id and rg.tenant_id = want_tenant and rg.owned
       where r.revoked_at is null
         and not exists (select 1 from private.roster_desired_grants(want_tenant) dg
                          where dg.subject = r.subject and dg.role = r.role and r.scope_kind = 'course' and dg.scope_id = r.scope_id)
    loop
      update public.role_grants set revoked_at = now() where id = g.id;
      revoked := revoked + 1;
    end loop;
  end if;

  return jsonb_build_object('granted', granted, 'revoked', revoked, 'kept', kept, 'absence_removal_allowed', complete);
end;
$$;

-- ── Promote: no going back in time; incomplete batches merge ──────────────

create or replace function private.roster_promote(want_batch uuid, want_approver uuid default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  b private.roster_import_batch%rowtype;
  rep jsonb;
  cap integer;
  removal_pct numeric;
  newest timestamptz;
begin
  select * into b from private.roster_import_batch where id = want_batch;
  if not found then raise exception 'roster_promote: no such batch' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtext('roster:' || b.tenant_id));
  select * into b from private.roster_import_batch where id = want_batch for update;

  if b.status = 'promoted' then return 'already-promoted'; end if;
  if b.status not in ('validated', 'held') then
    raise exception 'roster_promote: a % batch cannot be promoted', b.status using errcode = '22023';
  end if;

  if b.observed_at is not null then
    select max(observed_at) into newest from private.roster_import_batch
     where tenant_id = b.tenant_id and status = 'promoted' and observed_at is not null;
    if newest is not null and b.observed_at < newest then
      raise exception 'roster_promote: this batch was read from the source before the roster already in place; a newer roster is not overwritten by an older one'
        using errcode = '22023';
    end if;
  end if;

  rep := private.roster_reconcile(b.id);
  select coalesce((select max_removal_pct from private.roster_import_config where tenant_id = b.tenant_id), 10) into cap;
  removal_pct := case when (rep ->> 'current_rows')::numeric = 0 then 0
                      else (rep ->> 'removed')::numeric * 100 / (rep ->> 'current_rows')::numeric end;

  if removal_pct > cap then
    if want_approver is null then
      update private.roster_import_batch
         set status = 'held', report = rep,
             held_reason = format('would remove %s%% of the roster; the limit is %s%%', round(removal_pct, 1), cap)
       where id = b.id;
      return 'held';
    end if;
    if b.staged_by is not null and b.staged_by = want_approver then
      raise exception 'roster_promote: the approver must not be the person who staged the batch' using errcode = '42501';
    end if;
  end if;

  insert into private.roster_snapshot (batch_id, tenant_id, entity, sourced_id, payload, row_hash, origin_batch_id)
  select b.id, tenant_id, entity, sourced_id, payload, row_hash, batch_id
    from private.roster_current where tenant_id = b.tenant_id;

  if b.completeness = 'complete' then
    delete from private.roster_current where tenant_id = b.tenant_id;
    insert into private.roster_current (tenant_id, entity, sourced_id, payload, row_hash, batch_id)
    select tenant_id, entity, sourced_id, payload, row_hash, batch_id
      from private.roster_staged_row where batch_id = b.id;
  else
    -- A partial or unknown batch merges: what it names is added or changed,
    -- what it does not name stays.
    insert into private.roster_current (tenant_id, entity, sourced_id, payload, row_hash, batch_id)
    select tenant_id, entity, sourced_id, payload, row_hash, batch_id
      from private.roster_staged_row where batch_id = b.id
    on conflict (tenant_id, entity, sourced_id)
      do update set payload = excluded.payload, row_hash = excluded.row_hash, batch_id = excluded.batch_id;
  end if;

  update private.roster_import_batch
     set status = 'promoted', report = rep, promoted_at = clock_timestamp(),
         approved_by = coalesce(want_approver, approved_by), held_reason = null
   where id = b.id;
  -- After the batch is promoted, so the projection sees it as the live roster.
  update private.roster_import_batch
     set report = rep || jsonb_build_object('grants', private.roster_project_grants(b.tenant_id))
   where id = b.id;
  return 'promoted';
end;
$$;

-- ── Roll back: re-project after putting the last known good back ──────────

create or replace function private.roster_rollback(want_batch uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  b private.roster_import_batch%rowtype;
begin
  select * into b from private.roster_import_batch where id = want_batch;
  if not found then raise exception 'roster_rollback: no such batch' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtext('roster:' || b.tenant_id));
  select * into b from private.roster_import_batch where id = want_batch for update;

  if b.status = 'rolled_back' then return 'already-rolled-back'; end if;
  if b.status <> 'promoted' then
    raise exception 'roster_rollback: a % batch was never promoted', b.status using errcode = '22023';
  end if;
  if exists (select 1 from private.roster_import_batch
              where tenant_id = b.tenant_id and status = 'promoted' and promoted_at > b.promoted_at) then
    raise exception 'roster_rollback: a later batch has been promoted; roll that one back first' using errcode = '22023';
  end if;

  delete from private.roster_current where tenant_id = b.tenant_id;
  insert into private.roster_current (tenant_id, entity, sourced_id, payload, row_hash, batch_id)
  select s.tenant_id, s.entity, s.sourced_id, s.payload, s.row_hash, s.origin_batch_id
    from private.roster_snapshot s where s.batch_id = b.id;

  update private.roster_import_batch set status = 'rolled_back', rolled_back_at = clock_timestamp() where id = b.id;
  perform private.roster_project_grants(b.tenant_id);
  return 'rolled-back';
end;
$$;

-- ── Roster scopes on approved connections (owner decision, 20 Oct 2026) ───

alter table public.integration_scopes drop constraint if exists scope_not_on_the_never_list;
alter table public.integration_scopes add constraint scope_not_on_the_never_list
  check (scope_key !~ '\.(grades?|gpa|gradebook|submissions?|accommodations?|health|counseling|conduct|instructor_notes|financial_aid|aid_award)(_|$)');

alter table public.integration_scopes drop constraint if exists scope_roster_is_read_at_t3;
alter table public.integration_scopes add constraint scope_roster_is_read_at_t3
  check (scope_key !~ '\.roster(_|$)'
         or (scope_type in ('read', 'event') and data_classification_ceiling = 'T3'));

comment on table public.integration_scopes is
  'What a connection may read or do, one purpose each. Grades, submissions, accommodations, health, conduct and aid are refused by name; a roster scope is read or event only, declared at T3, and approved like any other.';

-- ── Who may call what ─────────────────────────────────────────────────────

revoke all on function private.roster_allowed_keys(text) from public, anon, authenticated;
revoke all on function private.roster_stage(text, text, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke all on function private.roster_stage_batch(text, text, jsonb, jsonb, uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function private.roster_validate(uuid) from public, anon, authenticated;
revoke all on function private.roster_reconcile(uuid) from public, anon, authenticated;
revoke all on function private.roster_promote(uuid, uuid) from public, anon, authenticated;
revoke all on function private.roster_rollback(uuid) from public, anon, authenticated;
revoke all on function private.roster_bind_identity(text, text, uuid, text, uuid) from public, anon, authenticated;
revoke all on function private.roster_unbound(text) from public, anon, authenticated;
revoke all on function private.roster_desired_grants(text) from public, anon, authenticated;
revoke all on function private.roster_ended_grants(text) from public, anon, authenticated;
revoke all on function private.roster_project_grants(text) from public, anon, authenticated;

grant execute on function private.roster_stage(text, text, jsonb, jsonb, uuid) to service_role;
grant execute on function private.roster_stage_batch(text, text, jsonb, jsonb, uuid, text, text, timestamptz) to service_role;
grant execute on function private.roster_validate(uuid) to service_role;
grant execute on function private.roster_reconcile(uuid) to service_role;
grant execute on function private.roster_promote(uuid, uuid) to service_role;
grant execute on function private.roster_rollback(uuid) to service_role;
grant execute on function private.roster_bind_identity(text, text, uuid, text, uuid) to service_role;
grant execute on function private.roster_unbound(text) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rolling back
--
--   begin;
--   -- Revoke what the roster gave, then drop its records.
--   update public.role_grants r set revoked_at = now()
--     from private.roster_grant g where g.grant_id = r.id and g.owned and r.revoked_at is null;
--   drop function if exists private.roster_unbound(text);
--   drop function if exists private.roster_bind_identity(text, text, uuid, text, uuid);
--   drop function if exists private.roster_project_grants(text);
--   drop function if exists private.roster_desired_grants(text);
--   drop function if exists private.roster_ended_grants(text);
--   drop table if exists private.roster_grant, private.roster_identity;
--   drop function if exists private.roster_stage_batch(text, text, jsonb, jsonb, uuid, text, text, timestamptz);
--   -- then re-run roster_stage, roster_validate, roster_reconcile, roster_promote,
--   -- roster_rollback and roster_allowed_keys from 20260930220000, and:
--   alter table private.roster_import_batch drop column if exists completeness,
--     drop column if exists source_version, drop column if exists observed_at;
--   alter table private.roster_import_config drop column if exists absence_revokes_access;
--   alter table public.integration_scopes drop constraint if exists scope_roster_is_read_at_t3;
--   alter table public.integration_scopes drop constraint if exists scope_not_on_the_never_list;
--   alter table public.integration_scopes add constraint scope_not_on_the_never_list
--     check (scope_key !~ '\.(grades?|gpa|gradebook|roster|submissions?|accommodations?|health|counseling|conduct|instructor_notes|financial_aid|aid_award)(_|$)');
--   commit;
