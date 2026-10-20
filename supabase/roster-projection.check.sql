-- supabase/roster-projection.check.sql — a roster becomes course-and-term
-- access, and the ways a roster sync goes wrong at scale do not.
--
-- For 20261020013100_roster_completeness_and_projection.sql. One school,
-- rp-u, one class, HIST 2100 in 2026FA, with two students, an instructor, a
-- co-teacher, a teaching assistant and one roster person nobody has bound;
-- a second school, rp-other, whose account must never be bound here. What it
-- proves:
--
--   * a roster person is linked to an account only by an explicit binding:
--     one account per person and one person per account, never an account at
--     another school; an unbound person gets nothing and is listed for review;
--   * promoting a complete roster grants each bound person the grant
--     Semester already checks — student, faculty (co-teachers too) and
--     teaching_assistant on `rp-u/HIST 2100/2026FA` — and those grants carry
--     the capabilities the gradebook reads;
--   * a partial roster that leaves someone out removes nobody, and its report
--     says removed 0;
--   * a batch read from the source before the roster in place is refused;
--   * replaying a batch duplicates nothing;
--   * absence is not withdrawal by default: a complete roster without
--     someone ends nothing until the school turns on absence-means-removal;
--     then it revokes the grant the roster gave, and still leaves alone a
--     grant an administrator gave before the roster did;
--   * an explicit inactive status ends the roster's grant even in a partial
--     batch, and a later active status restores it;
--   * a large drop is held for a second person, and grants do not move until
--     it is approved;
--   * rolling back restores what the rolled-back roster revoked;
--   * a class with no usable course code or term, and an inactive
--     enrollment, grant nothing.
--
-- The control: each refusal comes after the same call working on good input.
--
--   How to run it: supabase/check.sh roster-projection

begin;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, replace(split_part(address, '@', 1), '.', '_'), school);
  return who;
end $$;

create or replace function pg_temp.said(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got, 'null'); end if;
  raise notice 'ok  % (%)', what, got;
end $$;

-- The error a statement raises, or null when it ran.
create or replace function pg_temp.err(statement text)
returns text language plpgsql as $$
begin
  execute statement;
  return null;
exception when others then
  return sqlerrm;
end $$;

create or replace function pg_temp.refused(what text, statement text, because text)
returns void language plpgsql as $$
declare e text := pg_temp.err(statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  if e not like '%' || because || '%' then raise exception 'FAILED: % — refused, but not because %: %', what, because, e; end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;

create or replace function pg_temp.hash(ent text, sid text, payload jsonb)
returns text language sql as $$
  select encode(sha256(convert_to(ent || ':' || sid || ':' || payload::text, 'UTF8')), 'hex')
$$;

-- A batch as a producer builds it: the rows, and a manifest that digests them.
-- `tag` keeps two otherwise-equal batches from sharing a manifest digest.
create or replace function pg_temp.batch(rows jsonb, tag text)
returns jsonb language plpgsql as $$
declare
  files jsonb := '[]'::jsonb;
  ent text; digest text; n int;
begin
  foreach ent in array array['users', 'classes', 'enrollments'] loop
    select count(*), encode(sha256(convert_to(coalesce(string_agg(pg_temp.hash(r ->> 'entity', r ->> 'sourcedId', r -> 'payload'), E'\n'
             order by pg_temp.hash(r ->> 'entity', r ->> 'sourcedId', r -> 'payload')), ''), 'UTF8')), 'hex')
      into n, digest from jsonb_array_elements(rows) r where r ->> 'entity' = ent;
    if n > 0 then files := files || jsonb_build_object('entity', ent, 'rows', n, 'sha256', digest); end if;
  end loop;
  return jsonb_build_object('manifest', jsonb_build_object('files', files, 'tag', tag), 'rows', rows);
end $$;

create or replace function pg_temp.person(sid text, role text)
returns jsonb language sql as $$
  select jsonb_build_object('entity', 'users', 'sourcedId', sid,
    'payload', jsonb_build_object('status', 'active', 'role', role, 'givenName', sid, 'familyName', 'X'))
$$;

create or replace function pg_temp.klass(sid text, code text, term text)
returns jsonb language sql as $$
  select jsonb_build_object('entity', 'classes', 'sourcedId', sid,
    'payload', jsonb_build_object('title', code, 'courseCode', code, 'status', 'active', 'termCode', term))
$$;

create or replace function pg_temp.enrol(usr text, cls text, role text, status text default 'active')
returns jsonb language sql as $$
  select jsonb_build_object('entity', 'enrollments', 'sourcedId', usr || '@' || cls,
    'payload', jsonb_build_object('userSourcedId', usr, 'classSourcedId', cls, 'role', role, 'status', status))
$$;

-- The live grant, or 'none' / 'revoked'.
create or replace function pg_temp.grant_of(who uuid, want_role text, scope text)
returns text language sql as $$
  select coalesce((select case when revoked_at is null then provenance else 'revoked' end
                     from public.role_grants
                    where subject = who and role = want_role and scope_kind = 'course' and scope_id = scope), 'none')
$$;

do $$
declare
  maya uuid; ben uuid; prof uuid; coprof uuid; ta uuid; away uuid; stager uuid; approver uuid;
  scope constant text := 'rp-u/HIST 2100/2026FA';
  full_rows jsonb; b jsonb; b1 uuid; b2 uuid; b3 uuid; b4 uuid; b5 uuid; b6 uuid; b1_again uuid;
  st text; n bigint;
begin
  insert into public.schools (id, name, email_domains) values
    ('rp-u', 'Roster Projection University', array['rp-u.example']),
    ('rp-other', 'Other University', array['rp-other.example']);
  maya     := pg_temp.newuser('maya@rp-u.example', 'rp-u');
  ben      := pg_temp.newuser('ben@rp-u.example', 'rp-u');
  prof     := pg_temp.newuser('prof@rp-u.example', 'rp-u');
  coprof   := pg_temp.newuser('coprof@rp-u.example', 'rp-u');
  ta       := pg_temp.newuser('ta@rp-u.example', 'rp-u');
  stager   := pg_temp.newuser('stager@rp-u.example', 'rp-u');
  approver := pg_temp.newuser('approver@rp-u.example', 'rp-u');
  away     := pg_temp.newuser('away@rp-other.example', 'rp-other');

  -- An administrator granted the co-teacher before any roster existed.
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (coprof, 'faculty', 'course', scope, 'institution');

  -- ── Binding ─────────────────────────────────────────────────────────────
  perform pg_temp.said('CONTROL: a roster person is bound to an account at the school',
    private.roster_bind_identity('rp-u', 'S1', maya, 'sso_subject'), 'bound');
  perform pg_temp.said('the same binding again is a no-op',
    private.roster_bind_identity('rp-u', 'S1', maya, 'sso_subject'), 'already-bound');
  perform pg_temp.refused('binding that roster person to a second account',
    $q$select private.roster_bind_identity('rp-u', 'S1', (select user_id from public.profiles where handle = 'ben'), 'admin_review')$q$,
    'already bound to another account');
  perform pg_temp.refused('binding the same account to a second roster person',
    format($q$select private.roster_bind_identity('rp-u', 'S2', %L, 'admin_review')$q$, maya),
    'already bound to another roster person');
  perform pg_temp.refused('binding an account at another school',
    format($q$select private.roster_bind_identity('rp-u', 'S9', %L, 'admin_review')$q$, away),
    'not at this school');
  perform pg_temp.refused('binding by an unknown method (email is not one)',
    format($q$select private.roster_bind_identity('rp-u', 'S2', %L, 'email')$q$, ben),
    'method must be');
  perform private.roster_bind_identity('rp-u', 'S2', ben, 'scim');
  perform private.roster_bind_identity('rp-u', 'T1', prof, 'scim');
  perform private.roster_bind_identity('rp-u', 'T2', coprof, 'scim');
  perform private.roster_bind_identity('rp-u', 'A1', ta, 'scim');
  perform pg_temp.said('bindings alone grant nothing before a roster is promoted', pg_temp.grant_of(maya, 'student', scope), 'none');

  -- ── A complete roster becomes access ───────────────────────────────────
  full_rows := jsonb_build_array(
    pg_temp.person('S1', 'student'), pg_temp.person('S2', 'student'), pg_temp.person('S3', 'student'),
    pg_temp.person('T1', 'teacher'), pg_temp.person('T2', 'teacher'), pg_temp.person('A1', 'aide'),
    pg_temp.klass('C1', 'HIST 2100', '2026FA'),
    pg_temp.klass('C2', 'Hist 2100', '2026FA'),          -- not a course code
    pg_temp.klass('C3', 'ECON 1020', 'Fall 2026'),       -- not a term code
    pg_temp.enrol('S1', 'C1', 'student'), pg_temp.enrol('S2', 'C1', 'student'), pg_temp.enrol('S3', 'C1', 'student'),
    pg_temp.enrol('T1', 'C1', 'teacher'), pg_temp.enrol('T2', 'C1', 'teacher'), pg_temp.enrol('A1', 'C1', 'aide'),
    pg_temp.enrol('S1', 'C2', 'student'), pg_temp.enrol('S1', 'C3', 'student'));
  b := pg_temp.batch(full_rows, 'v1');
  b1 := private.roster_stage_batch('rp-u', 'csv', b -> 'manifest', b -> 'rows', stager, 'complete', 'sis-842', '2026-10-19T23:00:00Z');
  perform pg_temp.said('CONTROL: the complete roster validates', private.roster_validate(b1), 'validated');
  perform pg_temp.said('and promotes', private.roster_promote(b1), 'promoted');

  perform pg_temp.said('a bound student gets the student grant on the offering', pg_temp.grant_of(maya, 'student', scope), 'institution');
  perform pg_temp.said('the second student too', pg_temp.grant_of(ben, 'student', scope), 'institution');
  perform pg_temp.said('the teacher gets faculty', pg_temp.grant_of(prof, 'faculty', scope), 'institution');
  perform pg_temp.said('the co-teacher keeps a faculty grant', pg_temp.grant_of(coprof, 'faculty', scope), 'institution');
  perform pg_temp.said('the aide gets teaching_assistant', pg_temp.grant_of(ta, 'teaching_assistant', scope), 'institution');
  perform pg_temp.said('the student grant carries the gradebook roster capability',
    private.subject_has_capability(maya, 'grades:receive', 'course', scope)::text, 'true');
  perform pg_temp.said('the teacher grant carries release',
    private.subject_has_capability(prof, 'grades:release', 'course', scope)::text, 'true');
  perform pg_temp.said('the aide grant enters but does not release',
    (private.subject_has_capability(ta, 'grades:enter', 'course', scope)
     and not private.subject_has_capability(ta, 'grades:release', 'course', scope))::text, 'true');
  perform pg_temp.said('a class with no usable course code grants nothing',
    (select count(*)::text from public.role_grants where scope_id like 'rp-u/Hist%'), '0');
  perform pg_temp.said('a class with no usable term grants nothing',
    (select count(*)::text from public.role_grants where scope_id like 'rp-u/ECON 1020%'), '0');
  perform pg_temp.said('the unbound roster person is listed for review',
    (select string_agg(sourced_id, ',') from private.roster_unbound('rp-u')), 'S3');
  perform pg_temp.said('the roster owns the grants it made, not the one an administrator made',
    (select string_agg(owned::text, ',' order by owned) from private.roster_grant g
       join public.role_grants r on r.id = g.grant_id where r.subject in (coprof, maya)), 'false,true');
  perform pg_temp.said('the batch report records what the projection did',
    (select (report -> 'grants' ->> 'granted') from private.roster_import_batch where id = b1), '4');

  -- ── Replay ──────────────────────────────────────────────────────────────
  n := (select count(*) from public.role_grants where scope_id = scope);
  b1_again := private.roster_stage_batch('rp-u', 'csv', b -> 'manifest', b -> 'rows', stager, 'complete', 'sis-842', '2026-10-19T23:00:00Z');
  perform pg_temp.said('the same batch again is the same batch', (b1_again = b1)::text, 'true');
  perform pg_temp.said('promoting it again does nothing', private.roster_promote(b1), 'already-promoted');
  perform pg_temp.said('and duplicates no grant', (select count(*) from public.role_grants where scope_id = scope)::text, n::text);
end $$;

do $$
declare
  maya uuid := (select user_id from public.profiles where handle = 'maya');
  ben uuid := (select user_id from public.profiles where handle = 'ben');
  coprof uuid := (select user_id from public.profiles where handle = 'coprof');
  stager uuid := (select user_id from public.profiles where handle = 'stager');
  approver uuid := (select user_id from public.profiles where handle = 'approver');
  scope constant text := 'rp-u/HIST 2100/2026FA';
  b jsonb; b2 uuid; b3 uuid; b4 uuid; b5 uuid; b6 uuid; rows_without_ben jsonb;
begin
  -- ── A partial roster removes nobody ─────────────────────────────────────
  b := pg_temp.batch(jsonb_build_array(pg_temp.person('S1', 'student'), pg_temp.enrol('S1', 'C1', 'student')), 'partial-1');
  b2 := private.roster_stage_batch('rp-u', 'csv', b -> 'manifest', b -> 'rows', stager, 'partial', 'sis-843', '2026-10-19T23:30:00Z');
  perform pg_temp.said('CONTROL: a partial batch that names only Maya validates (her class is already live)',
    private.roster_validate(b2), 'validated');
  perform pg_temp.said('it promotes without being held', private.roster_promote(b2), 'promoted');
  perform pg_temp.said('its report removes nothing',
    (select report ->> 'removed' from private.roster_import_batch where id = b2), '0');
  perform pg_temp.said('and says how many live rows it did not mention',
    ((select (report ->> 'not_seen')::int from private.roster_import_batch where id = b2) > 0)::text, 'true');
  perform pg_temp.said('Ben, not in the partial batch, keeps his grant', pg_temp.grant_of(ben, 'student', scope), 'institution');
  perform pg_temp.said('and stays in the live roster',
    (select count(*)::text from private.roster_current where tenant_id = 'rp-u' and sourced_id = 'S2@C1'), '1');
  perform pg_temp.refused('an unknown completeness',
    format($q$select private.roster_stage_batch('rp-u', 'csv', '{"files":[]}'::jsonb, '[]'::jsonb, null, 'mostly', null, null)$q$),
    'completeness must be');

  -- ── No going back in time ───────────────────────────────────────────────
  b := pg_temp.batch(jsonb_build_array(pg_temp.person('S1', 'student'), pg_temp.enrol('S1', 'C1', 'student')), 'stale');
  b3 := private.roster_stage_batch('rp-u', 'csv', b -> 'manifest', b -> 'rows', stager, 'partial', 'sis-800', '2026-10-18T09:00:00Z');
  perform private.roster_validate(b3);
  perform pg_temp.refused('promoting a batch read before the roster in place',
    format('select private.roster_promote(%L)', b3), 'newer roster is not overwritten');

  -- ── A complete roster without Ben or the co-teacher ─────────────────────
  rows_without_ben := jsonb_build_array(
    pg_temp.person('S1', 'student'), pg_temp.person('S3', 'student'),
    pg_temp.person('T1', 'teacher'), pg_temp.person('A1', 'aide'),
    pg_temp.klass('C1', 'HIST 2100', '2026FA'), pg_temp.klass('C2', 'Hist 2100', '2026FA'), pg_temp.klass('C3', 'ECON 1020', 'Fall 2026'),
    pg_temp.enrol('S1', 'C1', 'student'), pg_temp.enrol('S3', 'C1', 'student'),
    pg_temp.enrol('T1', 'C1', 'teacher'), pg_temp.enrol('A1', 'C1', 'aide'),
    pg_temp.enrol('S1', 'C2', 'student'), pg_temp.enrol('S1', 'C3', 'student'));
  b := pg_temp.batch(rows_without_ben, 'v2');
  b4 := private.roster_stage_batch('rp-u', 'csv', b -> 'manifest', b -> 'rows', stager, 'complete', 'sis-844', '2026-10-20T08:00:00Z');
  perform private.roster_validate(b4);
  perform pg_temp.said('a complete roster dropping 4 of 17 rows is held for a second person', private.roster_promote(b4), 'held');
  perform pg_temp.said('while held, Ben keeps his grant', pg_temp.grant_of(ben, 'student', scope), 'institution');
  perform pg_temp.refused('the person who staged it approving it',
    format('select private.roster_promote(%L, %L)', b4, stager), 'must not be the person who staged');
  perform pg_temp.said('a second person approves it', private.roster_promote(b4, approver), 'promoted');
  perform pg_temp.said('CONTROL: with absence-means-removal off (the default), Ben''s absence ends nothing',
    pg_temp.grant_of(ben, 'student', scope), 'institution');
  perform pg_temp.said('and the report says absence could not remove',
    (select report -> 'grants' ->> 'absence_removal_allowed' from private.roster_import_batch where id = b4), 'false');
  perform pg_temp.said('rolling that promotion back', private.roster_rollback(b4), 'rolled-back');

  -- The school approves reading absence as withdrawal.
  insert into private.roster_import_config (tenant_id, source_kind, absence_revokes_access) values ('rp-u', 'csv', true);
  b := pg_temp.batch(rows_without_ben, 'v2-approved');
  b4 := private.roster_stage_batch('rp-u', 'csv', b -> 'manifest', b -> 'rows', stager, 'complete', 'sis-844b', '2026-10-20T08:30:00Z');
  perform private.roster_validate(b4);
  perform pg_temp.said('the same complete roster, staged again, is held again', private.roster_promote(b4), 'held');
  perform pg_temp.said('and approved by a second person', private.roster_promote(b4, approver), 'promoted');
  perform pg_temp.said('now Ben''s roster grant is revoked', pg_temp.grant_of(ben, 'student', scope), 'revoked');
  perform pg_temp.said('his gradebook roster capability with it',
    private.subject_has_capability(ben, 'grades:receive', 'course', scope)::text, 'false');
  perform pg_temp.said('Maya keeps hers', pg_temp.grant_of(maya, 'student', scope), 'institution');
  perform pg_temp.said('the co-teacher''s administrator-made grant is left alone', pg_temp.grant_of(coprof, 'faculty', scope), 'institution');
  perform pg_temp.said('the revocation is in the grant audit',
    (select count(*)::text from public.role_grant_audit_event
      where scope_id = scope and action = 'update' and revoked_at is not null), '1');

  -- ── Rolling back restores what that roster revoked ──────────────────────
  perform pg_temp.said('rolling back the last promotion', private.roster_rollback(b4), 'rolled-back');
  perform pg_temp.said('restores Ben''s grant', pg_temp.grant_of(ben, 'student', scope), 'institution');

  -- ── An explicit end counts even in a partial batch ──────────────────────
  update private.roster_import_config set absence_revokes_access = false where tenant_id = 'rp-u';
  b := pg_temp.batch(jsonb_build_array(pg_temp.person('S2', 'student'), pg_temp.enrol('S2', 'C1', 'student', 'inactive')), 'inactive');
  b5 := private.roster_stage_batch('rp-u', 'csv', b -> 'manifest', b -> 'rows', stager, 'partial', 'sis-845', '2026-10-20T09:00:00Z');
  perform private.roster_validate(b5);
  perform pg_temp.said('a partial batch marking Ben inactive promotes', private.roster_promote(b5), 'promoted');
  perform pg_temp.said('and ends his grant: an explicit status is a statement, not an absence',
    pg_temp.grant_of(ben, 'student', scope), 'revoked');
  perform pg_temp.said('it ends nothing else', pg_temp.grant_of(maya, 'student', scope), 'institution');
  b := pg_temp.batch(jsonb_build_array(pg_temp.person('S2', 'student'), pg_temp.enrol('S2', 'C1', 'student')), 'reactivated');
  b6 := private.roster_stage_batch('rp-u', 'csv', b -> 'manifest', b -> 'rows', stager, 'partial', 'sis-846', '2026-10-20T10:00:00Z');
  perform private.roster_validate(b6);
  perform private.roster_promote(b6);
  perform pg_temp.said('a later batch marking him active again restores it', pg_temp.grant_of(ben, 'student', scope), 'institution');

  -- ── Nothing here is a client's ──────────────────────────────────────────
  perform pg_temp.said('a signed-in account cannot call the projection or the binder',
    (has_function_privilege('authenticated', 'private.roster_project_grants(text)', 'execute')
     or has_function_privilege('authenticated', 'private.roster_bind_identity(text,text,uuid,text,uuid)', 'execute'))::text, 'false');
  perform pg_temp.said('or read the identity table',
    has_table_privilege('authenticated', 'private.roster_identity', 'select')::text, 'false');
end $$;

rollback;
