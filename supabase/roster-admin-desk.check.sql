-- supabase/roster-admin-desk.check.sql — a school administrator finds, binds
-- and unbinds roster people's accounts and decides whether absence ends
-- access; nobody else does.
--
-- For 20261021090000_roster_admin_desk.sql and
-- 20261021100000_roster_admin_unbind_search.sql. One school, ra-u, one class,
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
--   * every write leaves one pseudonymous audit row, and refusals leave none;
--   * the account search answers this school's unbound accounts only — never
--     another school's (whose administrator finds theirs: the control), never
--     one already bound, never the caller's own (a colleague finds it) — at
--     least 3 characters, at most 20 rows, % and _ literal, address masked;
--   * the bound list is this school's bindings, including somebody who has
--     left the roster;
--   * an unbind is refused to a student, faculty, the registrar, another
--     school's administrator, an administrator naming another school, anon,
--     a stale expected account and the administrator's own binding (which a
--     colleague then removes: the control), and no refusal writes;
--   * naming another school's sourcedId here reaches nothing there;
--   * an unbind ends the roster's grant and keeps one given outside the
--     roster, puts the person back on the unbound list, replays by key,
--     refuses the key for anything else, and is audited once; a later
--     promotion does not bring the access back, and binding again
--     re-activates the same grant row.
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
  unbind constant text := $q$select public.roster_admin_unbind(%L, %L, %L::uuid, %L)::text$q$;
  find constant text := $q$select * from public.roster_admin_find_accounts(%L, %L)$q$;
  other_maya uuid;
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

  -- ══ 20261021100000_roster_admin_unbind_search.sql ══════════════════════
  -- Where things stand: Maya and the teacher are bound (Maya's grant ended
  -- with absence), u-nobody is not, the switch is off.

  -- ── Searching for the account to bind ──────────────────────────────────
  other_maya := pg_temp.newuser('maya.other@ra-other.example', 'ra-other');
  for i in 1..25 loop
    perform pg_temp.newuser(format('bulk%s@ra-u.example', i), 'ra-u');
  end loop;

  perform pg_temp.refused('a student searching accounts', student, format(find, 'ra-u', 'maya'), 'roster:administer');
  perform pg_temp.refused('the registrar searching accounts', registrar, format(find, 'ra-u', 'maya'), 'roster:administer');
  perform pg_temp.refused('another school''s administrator searching here', away_admin, format(find, 'ra-u', 'maya'), 'roster:administer');
  perform pg_temp.refused('anon searching accounts', null, format(find, 'ra-u', 'maya'), 'not signed in');
  perform pg_temp.refused('a two-character search', uadmin, format(find, 'ra-u', 'ma'), 'at least 3 characters');
  perform pg_temp.refused('a blank-padded two-character search', uadmin, format(find, 'ra-u', '  ma  '), 'at least 3 characters');

  perform pg_temp.said('searching "maya" finds the one unbound Maya at this school, not the bound one or the other school''s',
    pg_temp.ask(uadmin, format($q$select string_agg(handle, ',' order by handle) from (%s) f$q$, format(find, 'ra-u', 'maya'))), 'maya_two');
  perform pg_temp.said('control: the other school''s administrator finds their own Maya',
    pg_temp.ask(away_admin, format($q$select string_agg(handle, ',' order by handle) from (%s) f$q$, format(find, 'ra-other', 'maya'))), 'maya_other');
  perform pg_temp.said('the address comes back masked to its first letter and domain',
    pg_temp.ask(uadmin, format($q$select email_hint from (%s) f$q$, format(find, 'ra-u', 'MAYA'))), 'm•••@ra-u.example');
  perform pg_temp.said('the full address is in no row',
    pg_temp.ask(uadmin, format($q$select count(*)::text from (%s) f where row_to_json(f)::text like '%%maya.two@%%'$q$, format(find, 'ra-u', 'maya'))), '0');
  perform pg_temp.said('the account id comes back, for the binding',
    pg_temp.ask(uadmin, format($q$select (account = %L::uuid)::text from (%s) f$q$, maya2, format(find, 'ra-u', 'maya'))), 'true');
  perform pg_temp.said('a search by address fragment finds the account too',
    pg_temp.ask(uadmin, format($q$select string_agg(handle, ',') from (%s) f$q$, format(find, 'ra-u', 'two@ra-u'))), 'maya_two');
  perform pg_temp.said('at most 20 accounts come back',
    pg_temp.ask(uadmin, format($q$select count(*)::text from (%s) f$q$, format(find, 'ra-u', 'bulk'))), '20');
  perform pg_temp.said('a search on the school''s domain is still only this school, 20 at most',
    pg_temp.ask(uadmin, format($q$select count(*)::text from (%s) f where email_hint not like '%%@ra-u.example'$q$, format(find, 'ra-u', 'example'))), '0');
  perform pg_temp.said('the caller''s own account is never offered',
    pg_temp.ask(uadmin, format($q$select count(*)::text from (%s) f where account = %L::uuid$q$, format(find, 'ra-u', 'admin'), uadmin)), '0');
  perform pg_temp.said('control: a colleague searching the same word finds that account',
    pg_temp.ask(iadmin, format($q$select count(*)::text from (%s) f where account = %L::uuid$q$, format(find, 'ra-u', 'admin'), uadmin)), '1');
  perform pg_temp.said('an account already bound here is not offered',
    pg_temp.ask(uadmin, format($q$select count(*)::text from (%s) f$q$, format(find, 'ra-u', 'teacher'))), '0');
  perform pg_temp.said('% and _ are literal, not wildcards',
    pg_temp.ask(uadmin, format($q$select count(*)::text from (%s) f$q$, format(find, 'ra-u', '%%%'))) || ' ' ||
    pg_temp.ask(uadmin, format($q$select count(*)::text from (%s) f$q$, format(find, 'ra-u', '___'))), '0 0');

  -- ── The bound list ─────────────────────────────────────────────────────
  -- A binding at the other school, made by the service, and one at this
  -- school that is the integration administrator's own account (by SCIM:
  -- the desk would refuse it, the service does not).
  perform private.roster_bind_identity('ra-other', 'o-maya', other_maya, 'scim', null);
  perform private.roster_bind_identity('ra-u', 'u-nobody', iadmin, 'scim', null);

  perform pg_temp.refused('a student listing bindings', student, $q$select count(*) from public.roster_admin_bound('ra-u')$q$, 'roster:administer');
  perform pg_temp.refused('another school''s administrator listing bindings here', away_admin, $q$select count(*) from public.roster_admin_bound('ra-u')$q$, 'roster:administer');
  perform pg_temp.said('the bound list is this school''s three bindings, by name',
    pg_temp.ask(uadmin, $q$select string_agg(sourced_id || ':' || method, ',' order by sourced_id) from public.roster_admin_bound('ra-u')$q$),
    'u-maya:admin_review,u-nobody:scim,u-teach:admin_review');
  perform pg_temp.said('a bound row names the account and its handle',
    pg_temp.ask(uadmin, format($q$select (account = %L::uuid)::text || ' ' || handle || ' ' || given_name from public.roster_admin_bound('ra-u') where sourced_id = 'u-teach'$q$, teacher)),
    'true teacher Tess');
  perform pg_temp.said('a person who has left the roster is still listed, so they can be unbound',
    pg_temp.ask(uadmin, $q$select coalesce(given_name, '(gone)') from public.roster_admin_bound('ra-u') where sourced_id = 'u-maya'$q$), '(gone)');

  -- ── Unbinding ──────────────────────────────────────────────────────────
  -- A grant an administrator gave the teacher outside the roster.
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (teacher, 'faculty', 'course', 'ra-u/HIST 3100/2026FA', 'institution');

  perform pg_temp.refused('a student unbinding', student, format(unbind, 'ra-u', 'u-teach', teacher, 'key-unbind-student'), 'roster:administer');
  perform pg_temp.refused('a faculty member unbinding', faculty, format(unbind, 'ra-u', 'u-teach', teacher, 'key-unbind-faculty'), 'roster:administer');
  perform pg_temp.refused('the registrar unbinding', registrar, format(unbind, 'ra-u', 'u-teach', teacher, 'key-unbind-registrar'), 'roster:administer');
  perform pg_temp.refused('another school''s administrator unbinding here', away_admin, format(unbind, 'ra-u', 'u-teach', teacher, 'key-unbind-away'), 'roster:administer');
  perform pg_temp.refused('this school''s administrator unbinding at another school', uadmin, format(unbind, 'ra-other', 'o-maya', other_maya, 'key-unbind-there'), 'roster:administer');
  perform pg_temp.refused('anon unbinding', null, format(unbind, 'ra-u', 'u-teach', teacher, 'key-unbind-anon'), 'not signed in');
  perform pg_temp.refused('an unbind with no expected account', uadmin, format(unbind, 'ra-u', 'u-teach', null, 'key-unbind-null'), 'the account you saw bound');
  perform pg_temp.refused('an unbind that saw a different account (stale)', uadmin, format(unbind, 'ra-u', 'u-teach', maya2, 'key-unbind-stale'), 'stale');
  perform pg_temp.refused('the integration administrator unbinding their own account', iadmin, format(unbind, 'ra-u', 'u-nobody', iadmin, 'key-unbind-self'), 'your own account');
  perform pg_temp.said('no refusal removed a binding',
    (select count(*)::text from private.roster_identity where tenant_id = 'ra-u'), '3');
  perform pg_temp.said('no refusal ended the teacher''s grant', pg_temp.grant_of(teacher, 'faculty', scope), 'institution');
  perform pg_temp.said('no refusal touched the other school',
    (select count(*)::text from private.roster_identity where tenant_id = 'ra-other' and subject = other_maya), '1');
  perform pg_temp.said('no refusal was stored or audited',
    (select count(*)::text from private.roster_admin_operation where kind = 'unbind')
    || ' ' || (select count(*)::text from public.audit_event where action = 'roster.identity_unbound'), '0 0');

  -- Naming the other school's person at this school reaches nothing.
  r := pg_temp.ask(uadmin, format(unbind, 'ra-u', 'o-maya', other_maya, 'key-unbind-cross'))::jsonb;
  perform pg_temp.said('naming another school''s binding here is already-unbound', r ->> 'outcome', 'already-unbound');
  perform pg_temp.said('and the other school''s binding is still there',
    (select count(*)::text from private.roster_identity where tenant_id = 'ra-other' and sourced_id = 'o-maya'), '1');

  -- The control for the self refusal: a colleague may.
  r := pg_temp.ask(uadmin, format(unbind, 'ra-u', 'u-nobody', iadmin, 'key-unbind-scim'))::jsonb;
  perform pg_temp.said('a colleague unbinds the SCIM binding of the integration administrator',
    (r ->> 'outcome') || ' ' || (r ->> 'method'), 'unbound scim');

  r := pg_temp.ask(uadmin, format(unbind, 'ra-u', 'u-teach', teacher, 'key-unbind-teacher'))::jsonb;
  perform pg_temp.said('the administrator unbinds the teacher', r ->> 'outcome', 'unbound');
  perform pg_temp.said('the answer names the roster grant that ended',
    (r -> 'revoked')::text, jsonb_build_array(jsonb_build_object('role', 'faculty', 'scope', scope))::text);
  perform pg_temp.said('the teacher''s roster grant has ended', pg_temp.grant_of(teacher, 'faculty', scope), 'revoked');
  perform pg_temp.said('the grant an administrator gave outside the roster is kept',
    pg_temp.grant_of(teacher, 'faculty', 'ra-u/HIST 3100/2026FA'), 'institution');
  perform pg_temp.said('the teacher is unbound and back on the unbound list',
    pg_temp.ask(uadmin, $q$select count(*)::text from public.roster_admin_unbound('ra-u') where sourced_id = 'u-teach'$q$)
    || ' ' || pg_temp.ask(uadmin, $q$select count(*)::text from public.roster_admin_bound('ra-u') where sourced_id = 'u-teach'$q$), '1 0');
  perform pg_temp.said('and the account can be found to bind again',
    pg_temp.ask(uadmin, format($q$select count(*)::text from (%s) f$q$, format(find, 'ra-u', 'teacher'))), '1');

  again := pg_temp.ask(uadmin, format(unbind, 'ra-u', 'u-teach', teacher, 'key-unbind-teacher'))::jsonb;
  perform pg_temp.said('the same key replays the same answer', (again ->> 'outcome') || ' ' || (again ->> 'replayed'), 'unbound true');
  perform pg_temp.said('with the same grants', (again -> 'revoked')::text, (r -> 'revoked')::text);
  perform pg_temp.refused('the same key for a different unbind', uadmin, format(unbind, 'ra-u', 'u-maya', maya, 'key-unbind-teacher'), 'different request');
  perform pg_temp.refused('the same key used for a binding', uadmin, format(bind, 'u-teach', teacher, 'key-unbind-teacher'), 'different request');
  r := pg_temp.ask(iadmin, format(unbind, 'ra-u', 'u-teach', teacher, 'key-unbind-teacher-2'))::jsonb;
  perform pg_temp.said('a fresh key for a binding already gone is already-unbound', r ->> 'outcome', 'already-unbound');

  select count(*) into audits from public.audit_event where tenant_id = 'ra-u' and action = 'roster.identity_unbound';
  perform pg_temp.said('two unbinds, two audit rows (none for replays, already-unbound or refusals)', audits::text, '2');
  perform pg_temp.said('the audit says the method and how many grants ended, and names nobody',
    (select string_agg((detail ->> 'method') || ':' || (detail ->> 'revoked'), ',' order by detail ->> 'method')
       from public.audit_event where tenant_id = 'ra-u' and action = 'roster.identity_unbound'
        and detail::text not like '%' || teacher::text || '%' and detail::text not like '%u-teach%'), 'admin_review:1,scim:1');

  -- A promotion after the unbind does not bring the access back.
  st := pg_temp.promote(jsonb_build_array(
      pg_temp.person('u-teach', 'teacher', 'Tess'),
      pg_temp.person('u-nobody', 'student', 'Noor'),
      pg_temp.klass('c-hist', 'HIST 2100', '2026FA'),
      pg_temp.enrol('u-teach', 'c-hist', 'teacher'),
      pg_temp.enrol('u-nobody', 'c-hist', 'student')),
    'three', 'complete', now() - interval '1 hour');
  perform pg_temp.said('a later roster is promoted', st, 'promoted');
  perform pg_temp.said('and the unbound teacher''s access stays ended', pg_temp.grant_of(teacher, 'faculty', scope), 'revoked');

  -- Binding again re-activates the same grant.
  r := pg_temp.ask(iadmin, format(bind, 'u-teach', teacher, 'key-rebind-teacher'))::jsonb;
  perform pg_temp.said('binding the teacher again works', r ->> 'outcome', 'bound');
  perform pg_temp.said('and the same faculty grant is live again', pg_temp.grant_of(teacher, 'faculty', scope), 'institution');
  perform pg_temp.said('one grant row, not two',
    (select count(*)::text from public.role_grants where subject = teacher and role = 'faculty' and scope_id = scope), '1');
end $$;

rollback;
