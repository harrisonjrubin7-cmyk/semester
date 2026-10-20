-- supabase/roster-admin-desk.check.sql — a school administrator binds roster
-- people to accounts and decides whether absence ends access; nobody else does.
--
-- For 20261021090000_roster_admin_desk.sql. One school, ra-u, one class,
-- HIST 2100 in 2026FA, with a student (Maya) and a teacher on the roster, and
-- a roster person who is never bound; a university administrator, an
-- integration administrator, a registrar, a faculty member and a student at
-- ra-u; and a university administrator and an account at ra-other. What it
-- proves:
--
--   * a student, a faculty member, a registrar and another school's
--     administrator are refused every desk call, reads included;
--   * the unbound list gives sourcedId, role, names and the offerings a
--     binding would grant, and no email;
--   * binding Maya grants `student` on `ra-u/HIST 2100/2026FA`, and the
--     answer names that grant; she leaves the unbound list;
--   * the same key replays the same answer and writes nothing; the same key
--     for another request is refused;
--   * a second account for Maya, a second person for one account, an account
--     at another school, somebody not on the roster, and the administrator's
--     own account are refused;
--   * the absence switch refuses a stale `expect`, and turning it on ends the
--     roster's grant for somebody no longer on a complete roster, says so
--     beforehand, and says so in its answer;
--   * every write leaves one pseudonymous audit row, and refusals leave none.
--
-- The control: each refusal comes after the same call working for the right
-- person, so a refusal is the rule's doing and not a broken fixture.
--
--   How to run it: supabase/check.sh roster-admin-desk

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

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
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got, 'null');
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.err(who uuid, statement text)
returns text language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute statement;
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlerrm;
end $$;

create or replace function pg_temp.refused(what text, who uuid, statement text, because text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  if e not like '%' || because || '%' then
    raise exception 'FAILED: % — refused, but not because %: %', what, because, e;
  end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;

create or replace function pg_temp.ask(who uuid, q text)
returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.become(who);
  execute q into v;
  execute 'reset role';
  return v;
end $$;

create or replace function pg_temp.hash(ent text, sid text, payload jsonb)
returns text language sql as $$
  select encode(sha256(convert_to(ent || ':' || sid || ':' || payload::text, 'UTF8')), 'hex')
$$;

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

create or replace function pg_temp.person(sid text, role text, given text)
returns jsonb language sql as $$
  select jsonb_build_object('entity', 'users', 'sourcedId', sid,
    'payload', jsonb_build_object('status', 'active', 'role', role, 'givenName', given, 'familyName', 'Rostered'))
$$;

create or replace function pg_temp.klass(sid text, code text, term text)
returns jsonb language sql as $$
  select jsonb_build_object('entity', 'classes', 'sourcedId', sid,
    'payload', jsonb_build_object('title', code, 'courseCode', code, 'status', 'active', 'termCode', term))
$$;

create or replace function pg_temp.enrol(usr text, cls text, role text)
returns jsonb language sql as $$
  select jsonb_build_object('entity', 'enrollments', 'sourcedId', usr || '@' || cls,
    'payload', jsonb_build_object('userSourcedId', usr, 'classSourcedId', cls, 'role', role, 'status', 'active'))
$$;

-- Stage, validate and promote one batch for ra-u.
create or replace function pg_temp.promote(rows jsonb, tag text, completeness text, observed timestamptz)
returns text language plpgsql as $$
declare b jsonb := pg_temp.batch(rows, tag); id uuid;
begin
  id := private.roster_stage_batch('ra-u', 'csv', b -> 'manifest', b -> 'rows', null, completeness, null, observed);
  perform private.roster_validate(id);
  return private.roster_promote(id);
end $$;

create or replace function pg_temp.grant_of(who uuid, want_role text, scope text)
returns text language sql as $$
  select coalesce((select case when revoked_at is null then provenance else 'revoked' end
                     from public.role_grants
                    where subject = who and role = want_role and scope_kind = 'course' and scope_id = scope), 'none')
$$;

do $$
declare
  uadmin uuid; iadmin uuid; registrar uuid; faculty uuid; student uuid; away_admin uuid; away uuid;
  maya uuid; teacher uuid; maya2 uuid;
  scope constant text := 'ra-u/HIST 2100/2026FA';
  bind constant text := $q$select public.roster_admin_bind('ra-u', %L, %L::uuid, %L)::text$q$;
  absence constant text := $q$select public.roster_admin_set_absence('ra-u', %L::boolean, %L::boolean, %L)::text$q$;
  r jsonb; again jsonb; audits bigint; ops bigint; st text;
begin
  insert into public.schools (id, name, email_domains) values
    ('ra-u', 'Roster Admin University', array['ra-u.example']),
    ('ra-other', 'Other University', array['ra-other.example']);
  -- The cap is raised so dropping Maya is not held for a second approver; that
  -- rule is roster-projection.check.sql's.
  insert into private.roster_import_config (tenant_id, source_kind, max_removal_pct) values ('ra-u', 'csv', 50);

  uadmin     := pg_temp.newuser('admin@ra-u.example', 'ra-u');
  iadmin     := pg_temp.newuser('integrations@ra-u.example', 'ra-u');
  registrar  := pg_temp.newuser('registrar@ra-u.example', 'ra-u');
  faculty    := pg_temp.newuser('faculty@ra-u.example', 'ra-u');
  student    := pg_temp.newuser('student@ra-u.example', 'ra-u');
  maya       := pg_temp.newuser('maya@ra-u.example', 'ra-u');
  maya2      := pg_temp.newuser('maya.two@ra-u.example', 'ra-u');
  teacher    := pg_temp.newuser('teacher@ra-u.example', 'ra-u');
  away_admin := pg_temp.newuser('admin@ra-other.example', 'ra-other');
  away       := pg_temp.newuser('away@ra-other.example', 'ra-other');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (uadmin,     'university_admin',  'school', 'ra-u',     'institution'),
    (iadmin,     'integration_admin', 'school', 'ra-u',     'institution'),
    (registrar,  'registrar',         'school', 'ra-u',     'institution'),
    (faculty,    'faculty',           'school', 'ra-u',     'institution'),
    (student,    'student',           'school', 'ra-u',     'institution'),
    (away_admin, 'university_admin',  'school', 'ra-other', 'institution');

  st := pg_temp.promote(jsonb_build_array(
      pg_temp.person('u-maya', 'student', 'Maya'),
      pg_temp.person('u-teach', 'teacher', 'Tess'),
      pg_temp.person('u-nobody', 'student', 'Noor'),
      pg_temp.klass('c-hist', 'HIST 2100', '2026FA'),
      pg_temp.enrol('u-maya', 'c-hist', 'student'),
      pg_temp.enrol('u-teach', 'c-hist', 'teacher'),
      pg_temp.enrol('u-nobody', 'c-hist', 'student')),
    'one', 'complete', now() - interval '2 days');
  perform pg_temp.said('the first complete roster is promoted', st, 'promoted');

  -- ── Reads: the administrator, then everybody else ──────────────────────
  perform pg_temp.said('the university administrator sees three unbound people',
    pg_temp.ask(uadmin, $q$select count(*)::text from public.roster_admin_unbound('ra-u')$q$), '3');
  perform pg_temp.said('the integration administrator sees them too',
    pg_temp.ask(iadmin, $q$select count(*)::text from public.roster_admin_unbound('ra-u')$q$), '3');
  perform pg_temp.said('a row carries the names and the offering a binding would grant',
    pg_temp.ask(uadmin, $q$select given_name || ' ' || family_name || ' · ' || role || ' · ' || (courses -> 0 ->> 'course') || ' ' || (courses -> 0 ->> 'term') || ' ' || (courses -> 0 ->> 'role')
                          from public.roster_admin_unbound('ra-u') where sourced_id = 'u-teach'$q$),
    'Tess Rostered · teacher · HIST 2100 2026FA faculty');
  perform pg_temp.said('no row carries an email',
    pg_temp.ask(uadmin, $q$select count(*)::text from public.roster_admin_unbound('ra-u') u where row_to_json(u)::text like '%@%'$q$), '0');
  perform pg_temp.said('the configuration reads off, complete, nothing would end',
    pg_temp.ask(uadmin, $q$select (c ->> 'absence_revokes_access') || ' ' || (c ->> 'roster_complete') || ' ' || (c ->> 'would_end') || ' ' || (c ->> 'unbound')
                          from public.roster_admin_config('ra-u') c$q$), 'false true 0 3');

  perform pg_temp.refused('a student listing unbound people', student,
    $q$select count(*) from public.roster_admin_unbound('ra-u')$q$, 'roster:administer');
  perform pg_temp.refused('a faculty member listing unbound people', faculty,
    $q$select count(*) from public.roster_admin_unbound('ra-u')$q$, 'roster:administer');
  perform pg_temp.refused('the registrar listing unbound people', registrar,
    $q$select count(*) from public.roster_admin_unbound('ra-u')$q$, 'roster:administer');
  perform pg_temp.refused('another school''s administrator listing unbound people', away_admin,
    $q$select count(*) from public.roster_admin_unbound('ra-u')$q$, 'roster:administer');
  perform pg_temp.refused('another school''s administrator reading the configuration', away_admin,
    $q$select public.roster_admin_config('ra-u')$q$, 'roster:administer');
  perform pg_temp.refused('a student reading the configuration', student,
    $q$select public.roster_admin_config('ra-u')$q$, 'roster:administer');
  perform pg_temp.refused('anon calling the desk', null,
    $q$select public.roster_admin_config('ra-u')$q$, 'not signed in');

  -- ── Binding: refusals that must not write, then the binding ────────────
  perform pg_temp.refused('a student binding', student, format(bind, 'u-maya', maya, 'key-student-1'), 'roster:administer');
  perform pg_temp.refused('a faculty member binding', faculty, format(bind, 'u-maya', maya, 'key-faculty-1'), 'roster:administer');
  perform pg_temp.refused('another school''s administrator binding here', away_admin, format(bind, 'u-maya', maya, 'key-away-1'), 'roster:administer');
  perform pg_temp.refused('binding an account at another school', uadmin, format(bind, 'u-maya', away, 'key-cross-1'), 'not at this school');
  perform pg_temp.refused('binding somebody not on the roster', uadmin, format(bind, 'u-ghost', maya, 'key-ghost-1'), 'not on this school''s roster');
  perform pg_temp.refused('an administrator binding their own account', uadmin, format(bind, 'u-teach', uadmin, 'key-self-1'), 'your own account');
  perform pg_temp.refused('a key that is too short', uadmin, format(bind, 'u-maya', maya, 'short'), 'idempotency key');
  perform pg_temp.said('no refusal bound anybody',
    (select count(*)::text from private.roster_identity where tenant_id = 'ra-u'), '0');
  perform pg_temp.said('no refusal left a grant',
    pg_temp.grant_of(maya, 'student', scope), 'none');

  r := pg_temp.ask(uadmin, format(bind, 'u-maya', maya, 'key-bind-maya'))::jsonb;
  perform pg_temp.said('the administrator binds Maya', r ->> 'outcome', 'bound');
  perform pg_temp.said('the answer names the grant it projected', (r -> 'grants' -> 0 ->> 'role') || ' ' || (r -> 'grants' -> 0 ->> 'scope'), 'student ' || scope);
  perform pg_temp.said('Maya now holds the student grant, from the institution', pg_temp.grant_of(maya, 'student', scope), 'institution');
  perform pg_temp.said('the binding is admin_review, made by the administrator',
    (select method || ' ' || (bound_by = uadmin)::text from private.roster_identity where tenant_id = 'ra-u' and sourced_id = 'u-maya'), 'admin_review true');
  perform pg_temp.said('Maya leaves the unbound list',
    pg_temp.ask(uadmin, $q$select count(*)::text from public.roster_admin_unbound('ra-u') where sourced_id = 'u-maya'$q$), '0');

  -- Replay: the same answer, nothing written twice.
  again := pg_temp.ask(uadmin, format(bind, 'u-maya', maya, 'key-bind-maya'))::jsonb;
  perform pg_temp.said('the same key replays the same outcome', again ->> 'outcome', 'bound');
  perform pg_temp.said('and says it is a replay', again ->> 'replayed', 'true');
  perform pg_temp.said('and the same grants', (again -> 'grants')::text, (r -> 'grants')::text);
  perform pg_temp.said('one operation is stored for it',
    (select count(*)::text from private.roster_admin_operation where tenant_id = 'ra-u' and idempotency_key = 'key-bind-maya'), '1');
  perform pg_temp.refused('the same key for a different request', uadmin, format(bind, 'u-teach', teacher, 'key-bind-maya'), 'different request');
  perform pg_temp.refused('the same key from another administrator', iadmin, format(bind, 'u-maya', maya, 'key-bind-maya'), 'different request');

  -- A fresh key for the same binding: no new binding, says already-bound.
  r := pg_temp.ask(iadmin, format(bind, 'u-maya', maya, 'key-bind-maya-2'))::jsonb;
  perform pg_temp.said('binding the same pair again is already-bound', r ->> 'outcome', 'already-bound');

  -- Conflicts, inherited from roster_bind_identity.
  perform pg_temp.refused('a second account for Maya', uadmin, format(bind, 'u-maya', maya2, 'key-conflict-1'), 'already bound to another account');
  perform pg_temp.refused('Maya''s account for a second person', uadmin, format(bind, 'u-nobody', maya, 'key-conflict-2'), 'already bound to another roster person');

  -- The integration administrator binds the teacher; the teacher gets faculty.
  r := pg_temp.ask(iadmin, format(bind, 'u-teach', teacher, 'key-bind-teacher'))::jsonb;
  perform pg_temp.said('the integration administrator binds the teacher', r ->> 'outcome', 'bound');
  perform pg_temp.said('the teacher holds faculty on the offering', pg_temp.grant_of(teacher, 'faculty', scope), 'institution');

  select count(*) into audits from public.audit_event where tenant_id = 'ra-u' and action = 'roster.identity_bound';
  perform pg_temp.said('two bindings, two audit rows (no row for the replay, already-bound or a refusal)', audits::text, '2');
  perform pg_temp.said('the audit row names neither the person nor the account',
    (select count(*)::text from public.audit_event where tenant_id = 'ra-u' and action = 'roster.identity_bound'
        and (detail::text like '%u-maya%' or detail::text like '%' || maya::text || '%' or object_sha256 = 'u-maya')), '0');

  -- ── The absence switch ─────────────────────────────────────────────────
  -- A complete roster without Maya: with the switch off, nothing ends.
  st := pg_temp.promote(jsonb_build_array(
      pg_temp.person('u-teach', 'teacher', 'Tess'),
      pg_temp.person('u-nobody', 'student', 'Noor'),
      pg_temp.klass('c-hist', 'HIST 2100', '2026FA'),
      pg_temp.enrol('u-teach', 'c-hist', 'teacher'),
      pg_temp.enrol('u-nobody', 'c-hist', 'student')),
    'two', 'complete', now() - interval '1 day');
  perform pg_temp.said('a complete roster without Maya is promoted', st, 'promoted');
  perform pg_temp.said('with the switch off, Maya keeps her grant', pg_temp.grant_of(maya, 'student', scope), 'institution');
  perform pg_temp.said('the configuration says one grant would end',
    pg_temp.ask(uadmin, $q$select (c ->> 'would_end') from public.roster_admin_config('ra-u') c$q$), '1');

  perform pg_temp.refused('a student turning the switch on', student, format(absence, true, false, 'key-abs-student'), 'roster:administer');
  perform pg_temp.refused('another school''s administrator turning it on here', away_admin, format(absence, true, false, 'key-abs-away'), 'roster:administer');
  perform pg_temp.refused('turning it on having seen it on (stale)', uadmin, format(absence, true, true, 'key-abs-stale'), 'stale');
  perform pg_temp.said('no refusal changed the switch',
    (select absence_revokes_access::text from private.roster_import_config where tenant_id = 'ra-u'), 'false');
  perform pg_temp.said('no refusal ended Maya''s grant', pg_temp.grant_of(maya, 'student', scope), 'institution');

  r := pg_temp.ask(uadmin, format(absence, true, false, 'key-abs-on'))::jsonb;
  perform pg_temp.said('the administrator turns it on', r ->> 'outcome', 'turned-on');
  perform pg_temp.said('the answer says one roster grant ended', r -> 'grants' ->> 'revoked', '1');
  perform pg_temp.said('Maya''s roster grant has ended', pg_temp.grant_of(maya, 'student', scope), 'revoked');
  perform pg_temp.said('the teacher, still on the roster, keeps faculty', pg_temp.grant_of(teacher, 'faculty', scope), 'institution');

  again := pg_temp.ask(uadmin, format(absence, true, false, 'key-abs-on'))::jsonb;
  perform pg_temp.said('the same key replays turned-on', (again ->> 'outcome') || ' ' || (again ->> 'replayed'), 'turned-on true');
  perform pg_temp.refused('turning it on again with a new key, having seen it off (stale)', iadmin, format(absence, true, false, 'key-abs-on-2'), 'stale');

  r := pg_temp.ask(iadmin, format(absence, false, true, 'key-abs-off'))::jsonb;
  perform pg_temp.said('the integration administrator turns it off', r ->> 'outcome', 'turned-off');

  select count(*) into audits from public.audit_event where tenant_id = 'ra-u' and action = 'roster.absence_setting_changed';
  perform pg_temp.said('two changes, two audit rows', audits::text, '2');
  perform pg_temp.said('the audit says from and to',
    (select string_agg((detail ->> 'from') || '>' || (detail ->> 'to'), ',' order by (detail ->> 'from')) from public.audit_event
      where tenant_id = 'ra-u' and action = 'roster.absence_setting_changed'), 'false>true,true>false');

  select count(*) into ops from private.roster_admin_operation where tenant_id = 'ra-u';
  perform pg_temp.said('five answers stored: three bindings and two switches', ops::text, '5');

  -- Nothing reaches the tables directly.
  perform pg_temp.refused('the administrator reading the ledger directly', uadmin,
    $q$select count(*) from private.roster_admin_operation$q$, 'permission denied');
  perform pg_temp.refused('the administrator calling the private binder directly', uadmin,
    format($q$select private.roster_bind_identity('ra-u', 'u-nobody', %L::uuid, 'admin_review', null)$q$, maya2), 'permission denied');
end $$;

rollback;
