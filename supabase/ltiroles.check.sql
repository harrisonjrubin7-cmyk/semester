-- What one launch asserted, and the four things it is not allowed to touch.
--
-- `public.record_lti_roles` turns an LTI launch's `roles` claim into
-- institution-provenance rows in `public.role_grants`. It is the only writer of
-- them, it is callable by `service_role` alone, and its blast radius is one
-- person on one course.
--
-- What this covers:
--
--   * `Instructor` becomes a live `faculty` grant over `issuer/context` — the
--     control, because every refusal below is vacuous if nothing is ever
--     written.
--   * The **context-scoped URI form** maps to the role after the last `#`.
--     `…/membership/Instructor#TeachingAssistant` is a teaching assistant, and a
--     tool that compared whole URIs — or took the segment before the `#` — would
--     make that person a professor. That is the bug the suffix match exists for
--     and it is asserted rather than trusted.
--   * `Administrator`, `Mentor` and `ContentDeveloper` map to **nothing**. Those
--     three absences are the security of the whole file: an LMS administrator is
--     not a Semester university administrator, and item 275 is why.
--   * A launch that stops asserting a role **revokes** it, and one that asserts
--     it again lifts the revocation. The institution is the source of truth in
--     both directions or it is not one.
--   * It may not touch a `self` grant or a `platform` grant, on the same scope,
--     in either direction. A launch is authoritative about its own course and
--     about nothing else.
--   * No context, no write. A launch that is not about a course has no course to
--     scope a grant to.
--   * `anon` and `authenticated` cannot call it at all.
--
--   How to run it: supabase/check.sh ltiroles

begin;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.said(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got, 'null');
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.newuser(address text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          address, now(), now(), now());
  return who;
end $$;

/** The role URIs the standard actually sends. */
create or replace function pg_temp.uri(short text)
returns text language sql immutable as $$
  select 'http://purl.imsglobal.org/vocab/lis/v2/membership#' || short;
$$;

do $$
declare
  prof    uuid;
  ta      uuid;
  learner uuid;
  tutor   uuid;
  issuer  text := 'https://brightspace.vanderbilt.edu';
  course  text := '104729';
  scope   text := 'https://brightspace.vanderbilt.edu/104729';
  n       bigint;
  live    integer;
  st      text;
begin
  prof    := pg_temp.newuser('prof@ltiroles.test');
  ta      := pg_temp.newuser('ta@ltiroles.test');
  learner := pg_temp.newuser('learner@ltiroles.test');
  tutor   := pg_temp.newuser('tutor@ltiroles.test');

  -- ── What it writes — THE CONTROL ────────────────────────────────────────

  live := public.record_lti_roles(prof, issuer, course, array[pg_temp.uri('Instructor')]);
  perform pg_temp.counted('one grant live after an instructor launch — THE CONTROL', live, 1);

  select count(*) into n from public.role_grants
   where subject = prof and role = 'faculty' and scope_kind = 'course'
     and scope_id = scope and provenance = 'institution' and revoked_at is null;
  perform pg_temp.counted('Instructor became a live institution-granted faculty row', n, 1);

  -- The scope is the platform's course, qualified by the platform. Not a
  -- Semester course code, because no correspondence between the two exists.
  select scope_id into st from public.role_grants where subject = prof;
  perform pg_temp.said('scoped to the issuer and the context id', st, scope);

  -- ── The URI form that would make a TA a professor ───────────────────────

  live := public.record_lti_roles(ta, issuer, course,
    array['http://purl.imsglobal.org/vocab/lis/v2/membership/Instructor#TeachingAssistant']);
  perform pg_temp.counted('the context-scoped form writes one grant', live, 1);

  select count(*) into n from public.role_grants
   where subject = ta and role = 'teaching_assistant' and revoked_at is null;
  perform pg_temp.counted('…and it is a teaching assistant', n, 1);
  select count(*) into n from public.role_grants where subject = ta and role = 'faculty';
  perform pg_temp.counted('…and not a professor, which is what reading before the # would give',
                          n, 0);

  -- ── Learner, and the spelling some deployments use ──────────────────────

  live := public.record_lti_roles(learner, issuer, course, array[pg_temp.uri('Learner')]);
  perform pg_temp.counted('a learner launch writes one', live, 1);
  select count(*) into n from public.role_grants
   where subject = learner and role = 'student' and provenance = 'institution' and revoked_at is null;
  perform pg_temp.counted('Learner is the institution saying enrolled', n, 1);

  -- `Student` is the same assertion spelled differently, and lands on the same
  -- row rather than a second one.
  live := public.record_lti_roles(learner, issuer, course,
    array[pg_temp.uri('Learner'), pg_temp.uri('Student')]);
  select count(*) into n from public.role_grants
   where subject = learner and scope_id = scope;
  perform pg_temp.counted('Learner and Student together are still one row', n, 1);

  -- ── The three that map to nothing ───────────────────────────────────────

  live := public.record_lti_roles(prof, issuer, course, array[
    pg_temp.uri('Instructor'),
    'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator',
    pg_temp.uri('Mentor'),
    pg_temp.uri('ContentDeveloper'),
    'http://example.test/vocab#Registrar']);
  perform pg_temp.counted('a launch carrying four more roles still writes one', live, 1);

  select count(*) into n from public.role_grants
   where subject = prof and role in ('university_admin', 'academic_advisor', 'department_admin');
  perform pg_temp.counted('Administrator and Mentor granted nothing', n, 0);

  -- An unrecognised URI is ignored rather than fatal: `lti.ts` keeps the ones it
  -- does not know, and a launch from a platform with a local vocabulary must not
  -- fail because of one.
  select count(*) into n from public.role_grants where subject = prof and revoked_at is null;
  perform pg_temp.counted('and an unknown vocabulary did not raise', n, 1);

  -- ── Stopping asserting it ───────────────────────────────────────────────

  live := public.record_lti_roles(prof, issuer, course, array[pg_temp.uri('Learner')]);
  perform pg_temp.counted('the next launch says learner, so one is live', live, 1);

  select count(*) into n from public.role_grants
   where subject = prof and role = 'faculty' and revoked_at is not null;
  perform pg_temp.counted('the faculty grant it stopped asserting is revoked', n, 1);
  select count(*) into n from public.role_grants where subject = prof and role = 'faculty';
  perform pg_temp.counted('…and kept rather than deleted, so they can see why', n, 1);

  -- And asserting it again lifts it, which is what re-enrolment looks like.
  live := public.record_lti_roles(prof, issuer, course, array[pg_temp.uri('Instructor')]);
  select count(*) into n from public.role_grants
   where subject = prof and role = 'faculty' and revoked_at is null;
  perform pg_temp.counted('a later launch restoring the role lifts the revocation', n, 1);

  -- ── What a launch may not touch ─────────────────────────────────────────
  --
  -- The safety property of the whole function: a tutor opted in themselves, on
  -- this very course, and no launch may revoke that.

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (tutor, 'tutor', 'course', scope, 'self');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (tutor, 'moderator', 'platform', '', 'platform');

  live := public.record_lti_roles(tutor, issuer, course, array[pg_temp.uri('Learner')]);
  perform pg_temp.counted('a launch by that person writes their student grant', live, 2);

  select count(*) into n from public.role_grants
   where subject = tutor and role = 'tutor' and provenance = 'self' and revoked_at is null;
  perform pg_temp.counted('their self-granted tutor role is untouched', n, 1);
  select count(*) into n from public.role_grants
   where subject = tutor and role = 'moderator' and provenance = 'platform' and revoked_at is null;
  perform pg_temp.counted('and the platform grant on another scope too', n, 1);

  -- A launch that asserts nothing at all still may not reach either of them.
  live := public.record_lti_roles(tutor, issuer, course, array[]::text[]);
  select count(*) into n from public.role_grants
   where subject = tutor and provenance in ('self', 'platform') and revoked_at is null;
  perform pg_temp.counted('an empty launch revokes neither', n, 2);
  select count(*) into n from public.role_grants
   where subject = tutor and provenance = 'institution' and revoked_at is null;
  perform pg_temp.counted('and does revoke what it had asserted', n, 0);

  -- ── Nothing to scope it to ──────────────────────────────────────────────

  live := public.record_lti_roles(learner, issuer, '', array[pg_temp.uri('Instructor')]);
  perform pg_temp.counted('a launch with no context writes nothing', live, 0);
  live := public.record_lti_roles(learner, issuer, null, array[pg_temp.uri('Instructor')]);
  perform pg_temp.counted('nor one with a null context', live, 0);
  select count(*) into n from public.role_grants where subject = learner and role = 'faculty';
  perform pg_temp.counted('and no faculty row appeared from either', n, 0);

  -- ── Who may call it ─────────────────────────────────────────────────────

  perform pg_temp.counted('anon cannot call it',
    (has_function_privilege('anon',
      'public.record_lti_roles(uuid, text, text, text[])', 'EXECUTE'))::int::bigint, 0);
  perform pg_temp.counted('nor authenticated',
    (has_function_privilege('authenticated',
      'public.record_lti_roles(uuid, text, text, text[])', 'EXECUTE'))::int::bigint, 0);
  perform pg_temp.counted('service_role may — which is the launch',
    (has_function_privilege('service_role',
      'public.record_lti_roles(uuid, text, text, text[])', 'EXECUTE'))::int::bigint, 1);

  -- Definer with the path pinned, for the reason
  -- `20260907134823_harden_security_definer_helpers.sql` gives.
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'record_lti_roles'
     and p.prosecdef
     and p.proconfig is not null
     and 'search_path=' = any (select left(c, 12) from unnest(p.proconfig) c);
  perform pg_temp.counted('definer, with the search path pinned', n, 1);

  -- ── The map itself ──────────────────────────────────────────────────────

  select count(*) into n from public.lti_role_map;
  perform pg_temp.counted('four launch roles are mapped', n, 4);
  select count(*) into n from public.lti_role_map
   where lti_role in ('Administrator', 'Mentor', 'ContentDeveloper');
  perform pg_temp.counted('and the three that must not be are absent', n, 0);
  select count(*) into n from public.lti_role_map m
   where not exists (select 1 from public.app_roles r where r.role = m.role);
  perform pg_temp.counted('every role it maps to is in the one vocabulary', n, 0);

  raise notice 'ltiroles: every check passed';
end $$;

rollback;
