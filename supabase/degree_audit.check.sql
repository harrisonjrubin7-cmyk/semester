-- supabase/degree_audit.check.sql — who writes a program's requirements, what
-- the engine says about a record, and that exceptions are two-person.
--
-- For 20261001040000_degree_audit.sql. One school, da-u, with a registrar, a
-- second registrar, an advisor, a dean, two students (one linked to a record,
-- one not) and a member with no grant. What it proves:
--
--   * nothing is written unless the school runs `degree_audit` in Core;
--   * only `degree:author` writes and publishes requirements; a published
--     catalog year is never edited, by anyone, and a student is held only to a
--     published one;
--   * the engine counts a course once, in the first group it fits; reads the
--     latest graded attempt; counts transfer credit with no grade points;
--     says a missing credit entry rather than guessing; weights GPA by credits;
--   * a waiver or substitution is proposed by one holder and decided by
--     another, never the same person, and only an approved one changes the
--     audit; a rejected one does not;
--   * a saved run is a record that is never rewritten; a what-if against a
--     different year is computed and never saved; the same key is one run;
--   * a student reads their own audit and nobody else's; nobody writes through
--     the API.
--
--   How to run it: supabase/check.sh degree_audit

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

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then
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

create or replace function pg_temp.works(what text, who uuid, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is not null then raise exception 'FAILED: % — refused: %', what, e; end if;
  raise notice 'ok  % works', what;
end $$;

create or replace function pg_temp.refused_for(what text, who uuid, statement text, why text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  if e not ilike '%' || why || '%' then
    raise exception 'FAILED: % — refused, but not for "%": %', what, why, e;
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

create or replace function pg_temp.seen(who uuid, q text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute 'select count(*) from (' || q || ') t' into n;
  execute 'reset role';
  return n;
end $$;

-- A ledger entry, written directly (the ledger's own path has its own suite).
create or replace function pg_temp.entry(school text, who text, kind text, subject text, val text, ago integer default 30)
returns void language plpgsql as $$
declare ch uuid := gen_random_uuid();
begin
  set local session_replication_role = replica;
  insert into public.academic_record_entries
    (tenant_id, student_ref, kind, subject_key, action, value, effective_on, reason, source, change_id, override)
  values (school, who, kind, subject, 'set', val, current_date - ago, 'seed for the check', 'registrar', ch, false);
  set local session_replication_role = origin;
end $$;

do $$
declare
  reg uuid; reg2 uuid; adv uuid; dean uuid; ana uuid; ben uuid; nobody uuid;
  v1 jsonb; v2 jsonb; vid uuid; vid2 uuid; r jsonb; ex jsonb; ex2 jsonb; run1 jsonb; run2 jsonb;
  groups constant text := $g$[
    {"name":"Core","kind":"all","rules":[{"course":"ECON 1010"},{"course":"ECON 1020"}]},
    {"name":"Electives","kind":"n_of","need":2,"rules":[{"prefix":"ECON","min":2000,"max":4999}]},
    {"name":"Breadth","kind":"credits","need":6,"rules":[{"prefix":"HIST"},{"prefix":"ECON","min":2000,"max":4999}]}]$g$;
begin
  insert into public.schools (id, name, email_domains) values ('da-u', 'Degree Audit University', array['da-u.example']);
  reg    := pg_temp.newuser('reg@da-u.example', 'da-u');
  reg2   := pg_temp.newuser('reg2@da-u.example', 'da-u');
  adv    := pg_temp.newuser('adv@da-u.example', 'da-u');
  dean   := pg_temp.newuser('dean@da-u.example', 'da-u');
  ana    := pg_temp.newuser('ana@da-u.example', 'da-u');
  ben    := pg_temp.newuser('ben@da-u.example', 'da-u');
  nobody := pg_temp.newuser('nobody@da-u.example', 'da-u');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (reg,  'registrar',        'school', 'da-u', 'institution'),
    (reg2, 'registrar',        'school', 'da-u', 'institution'),
    (adv,  'academic_advisor', 'school', 'da-u', 'institution'),
    (dean, 'dean',             'school', 'da-u', 'institution');
  insert into public.academic_record_subjects (tenant_id, student_ref, user_id) values ('da-u', 'S-ANA', ana);

  -- ── Connect: nothing is written ────────────────────────────────
  perform pg_temp.refused_for('writing requirements while the school is in Connect', reg,
    format($q$select public.degree_version_save('ECON', 'Economics', 'major', 2026, 12, 2.0, %L::jsonb, 'save-connect-key')$q$, groups),
    'does not run the degree audit in Core');
  insert into public.tenant_module_mode (tenant_id, module, mode, frozen, reason) values ('da-u', 'degree_audit', 'core', false, 'check');

  -- ── Authoring ──────────────────────────────────────────────────
  perform pg_temp.refused_for('an advisor writing requirements', adv,
    format($q$select public.degree_version_save('ECON', 'Economics', 'major', 2026, 12, 2.0, %L::jsonb, 'save-adv-key')$q$, groups),
    'that needs degree:author');
  perform pg_temp.refused_for('a member with no grant writing requirements', nobody,
    format($q$select public.degree_version_save('ECON', 'Economics', 'major', 2026, 12, 2.0, %L::jsonb, 'save-nob-key')$q$, groups),
    'that needs degree:author');
  perform pg_temp.refused_for('a group with no rules', reg,
    $q$select public.degree_version_save('MATH', 'Math', 'major', 2026, 12, 2.0, '[{"name":"Empty","kind":"all","rules":[]}]'::jsonb, 'save-empty-key')$q$,
    'has no rules');
  perform pg_temp.refused_for('a rule that is both a course and a prefix', reg,
    $q$select public.degree_version_save('MATH', 'Math', 'major', 2026, 12, 2.0, '[{"name":"Odd","kind":"all","rules":[{"course":"MATH 1010","prefix":"MATH"}]}]'::jsonb, 'save-odd-key')$q$,
    'degree_rule_shape');

  v1 := pg_temp.ask(reg, format($q$select public.degree_version_save('econ', 'Economics', 'major', 2026, 12, 2.0, %L::jsonb, 'save-econ-key')$q$, groups))::jsonb;
  vid := (v1->>'id')::uuid;
  v2 := pg_temp.ask(reg, format($q$select public.degree_version_save('econ', 'Economics', 'major', 2026, 12, 2.0, %L::jsonb, 'save-econ-key')$q$, groups))::jsonb;
  perform pg_temp.said('the same key answers the same catalog year', v2->>'id', v1->>'id');
  perform pg_temp.counted('and wrote one version', (select count(*) from public.degree_versions), 1);
  perform pg_temp.counted('three groups and five rules were written', (select count(*) from public.degree_groups) * 10 + (select count(*) from public.degree_rules), 35);
  perform pg_temp.refused_for('the same key for a different request', reg,
    format($q$select public.degree_version_save('econ', 'Economics', 'major', 2027, 12, 2.0, %L::jsonb, 'save-econ-key')$q$, groups),
    'already used for a different request');
  perform pg_temp.refused_for('a second draft of the same year', reg,
    format($q$select public.degree_version_save('econ', 'Economics', 'major', 2026, 12, 2.0, %L::jsonb, 'save-econ-key2')$q$, groups),
    'already has a draft');

  perform pg_temp.counted('a student cannot read a draft', pg_temp.seen(ben, 'select 1 from public.degree_versions'), 0);
  perform pg_temp.counted('the dean reads the draft', pg_temp.seen(dean, 'select 1 from public.degree_versions'), 1);
  perform pg_temp.refused_for('holding a student to a draft', reg,
    format($q$select public.degree_declare('S-ANA', %L, 'declare-draft-key')$q$, vid), 'published catalog year');
  perform pg_temp.refused_for('an advisor publishing', adv, format($q$select public.degree_version_publish(%L, 'pub-adv-key01')$q$, vid), 'that needs degree:author');
  perform pg_temp.works('the registrar publishing', reg, format($q$select public.degree_version_publish(%L, 'pub-econ-key01')$q$, vid));
  perform pg_temp.counted('a student now reads the published year', pg_temp.seen(ben, 'select 1 from public.degree_versions'), 1);
  perform pg_temp.counted('and its groups', pg_temp.seen(ben, 'select 1 from public.degree_groups'), 3);

  -- ── A published year is never edited ───────────────────────────
  perform pg_temp.refused_for('editing a published year, even as the owner of the data', reg,
    format($q$update public.degree_versions set total_credits = 1 where id = %L$q$, vid), 'permission denied');
  begin
    update public.degree_versions set total_credits = 1 where id = vid;
    raise exception 'FAILED: a published version was edited';
  exception when insufficient_privilege then
    raise notice 'ok  a published version is never edited (%)', sqlerrm;
  end;
  begin
    insert into public.degree_rules (tenant_id, group_id, prefix) values ('da-u', (select id from public.degree_groups where version_id = vid limit 1), 'MATH');
    raise exception 'FAILED: a rule was added to a published version';
  exception when insufficient_privilege then
    raise notice 'ok  a rule cannot be added to a published version (%)', sqlerrm;
  end;
  begin
    delete from public.degree_groups where version_id = vid;
    raise exception 'FAILED: a group was removed from a published version';
  exception when insufficient_privilege then
    raise notice 'ok  a group cannot be removed from a published version (%)', sqlerrm;
  end;
  perform pg_temp.refused_for('publishing twice', reg, format($q$select public.degree_version_publish(%L, 'pub-econ-key02')$q$, vid), 'already published');

  -- ── Declaring ──────────────────────────────────────────────────
  perform pg_temp.refused_for('the dean declaring a student', dean, format($q$select public.degree_declare('S-ANA', %L, 'declare-dean-key')$q$, vid), 'that needs degree:declare');
  perform pg_temp.works('an advisor holding Ana to 2026', adv, format($q$select public.degree_declare('S-ANA', %L, 'declare-ana-key')$q$, vid));
  perform pg_temp.counted('one declaration', (select count(*) from public.student_degrees), 1);

  -- ── The record: Ana has finished the core and one elective ─────
  perform pg_temp.entry('da-u', 'S-ANA', 'grade',  'ECON 1010 · Fall 2025', 'B');
  perform pg_temp.entry('da-u', 'S-ANA', 'credit', 'ECON 1010 · Fall 2025', '3');
  perform pg_temp.entry('da-u', 'S-ANA', 'grade',  'ECON 1020 · Spring 2026', 'A');
  perform pg_temp.entry('da-u', 'S-ANA', 'credit', 'ECON 1020 · Spring 2026', '3');
  perform pg_temp.entry('da-u', 'S-ANA', 'grade',  'ECON 2010 · Fall 2026', 'C');
  perform pg_temp.entry('da-u', 'S-ANA', 'credit', 'ECON 2010 · Fall 2026', '3');
  perform pg_temp.entry('da-u', 'S-ANA', 'transfer_credit', 'HIST 1100', '3');
  perform pg_temp.entry('da-u', 'S-ANA', 'grade',  'ECON 2020 · Fall 2026', 'F');
  perform pg_temp.entry('da-u', 'S-ANA', 'credit', 'ECON 2020 · Fall 2026', '3');

  r := pg_temp.ask(adv, $q$select public.degree_audit_run('S-ANA', null, false, 'run-a-key-0001')$q$)::jsonb;
  perform pg_temp.said('the core group is met by its two courses', r->'groups'->0->>'met', 'true');
  perform pg_temp.said('an elective group needing two is not met by one pass and one fail', r->'groups'->1->>'met', 'false');
  perform pg_temp.said('a failed course counts for nothing', (r->'groups'->1->'courses')::text, '["ECON 2010"]');
  perform pg_temp.said('credits are the counted ones: 3 + 3 + 3 + 3 transfer', r->'credits'->>'have', '12');
  perform pg_temp.said('GPA is weighted over graded courses (B, A, C, F → 2.25)', r->'gpa'->>'have', '2.250');
  perform pg_temp.said('a course used once is not used again', (r->'groups'->2->'courses')::text, '["HIST 1100"]');
  perform pg_temp.said('the audit as a whole is in progress', r->>'status', 'in_progress');
  perform pg_temp.said('the unmet groups are named', (r->'unmet')::text, '["Electives", "Breadth"]');
  perform pg_temp.said('a what-if is not marked when it is the declared year', r->>'what_if', 'false');
  perform pg_temp.said('nothing was saved', coalesce(r->>'saved', 'null'), 'null');

  -- A retake: the latest attempt is the one that counts.
  perform pg_temp.entry('da-u', 'S-ANA', 'grade', 'ECON 2020 · Spring 2027', 'B+', 5);
  r := pg_temp.ask(adv, $q$select public.degree_audit_run('S-ANA', null, false, 'run-a-key-0002')$q$)::jsonb;
  perform pg_temp.said('with the retake, the elective group is met by two courses', r->'groups'->1->>'met', 'true');
  perform pg_temp.said('and credits rise (the credit entry is the course''s)', r->'credits'->>'have', '15');
  perform pg_temp.said('breadth takes the first fitting unused courses', (r->'groups'->2->'courses')::text, '["HIST 1100"]');

  -- A course with no credit entry is said, never guessed.
  perform pg_temp.entry('da-u', 'S-ANA', 'grade', 'MATH 1010 · Fall 2025', 'A');
  r := pg_temp.ask(adv, $q$select public.degree_audit_run('S-ANA', null, false, 'run-a-key-0003')$q$)::jsonb;
  perform pg_temp.said('a missing credit entry is named', ((r->'warnings'->>0) like 'No credit entry for MATH 1010%')::text, 'true');
  perform pg_temp.said('and counts for no credits', r->'credits'->>'have', '15');
  perform pg_temp.said('a course that fits no group is listed as unused', (r->'unused')::text, '["MATH 1010"]');

  -- ── Exceptions are two-person ──────────────────────────────────
  perform pg_temp.refused_for('a dean proposing', dean,
    format($q$select public.degree_exception_propose('S-ANA', %L, 3, 'waive', null, null, 'Documented transfer coursework', 'prop-dean-key1')$q$, vid),
    'that needs degree:propose');
  perform pg_temp.refused_for('a reason too short', adv,
    format($q$select public.degree_exception_propose('S-ANA', %L, 3, 'waive', null, null, 'short', 'prop-short-key')$q$, vid), 'check');
  perform pg_temp.refused_for('a substitution with no course', adv,
    format($q$select public.degree_exception_propose('S-ANA', %L, 3, 'substitute', null, null, 'Equivalent coursework elsewhere', 'prop-nocourse')$q$, vid), 'degree_exception_shape');
  ex := pg_temp.ask(adv, format($q$select public.degree_exception_propose('S-ANA', %L, 3, 'substitute', 'MATH 2010', 3, 'Equivalent statistics course taken elsewhere', 'prop-sub-key01')$q$, vid))::jsonb;
  perform pg_temp.said('a proposal starts proposed', ex->>'status', 'proposed');
  r := pg_temp.ask(adv, $q$select public.degree_audit_run('S-ANA', null, false, 'run-a-key-0004')$q$)::jsonb;
  perform pg_temp.said('a proposal changes nothing', r->'groups'->2->>'have', '3');
  perform pg_temp.refused_for('the proposer deciding their own', adv,
    format($q$select public.degree_exception_decide(%L, true, 'self', 'dec-self-key01')$q$, ex->>'id'), 'that needs degree:approve');
  perform pg_temp.refused_for('a registrar who is also the proposer deciding', reg,
    format($q$select public.degree_exception_decide(%L, true, 'ok', 'dec-reg-key001')$q$, (pg_temp.ask(reg, format($q$select public.degree_exception_propose('S-ANA', %L, 3, 'waive', null, null, 'Registrar-proposed waiver for the check', 'prop-reg-key01')$q$, vid))::jsonb)->>'id'),
    'someone other than who proposed');
  perform pg_temp.works('a different registrar deciding', reg2, format($q$select public.degree_exception_decide(%L, true, 'verified transcript', 'dec-reg2-key01')$q$, ex->>'id'));
  perform pg_temp.refused_for('deciding it twice', dean, format($q$select public.degree_exception_decide(%L, false, 'again', 'dec-dean-key01')$q$, ex->>'id'), 'already decided');
  begin
    update public.degree_exceptions set reason = 'rewritten for the check ' where id = (ex->>'id')::uuid;
    raise exception 'FAILED: a decided exception was rewritten';
  exception when insufficient_privilege then
    raise notice 'ok  a decided exception is never rewritten (%)', sqlerrm;
  end;
  r := pg_temp.ask(adv, $q$select public.degree_audit_run('S-ANA', null, false, 'run-a-key-0005')$q$)::jsonb;
  perform pg_temp.said('an approved substitution counts, with its credits, in its group', (r->'groups'->2->'substituted')::text, '["MATH 2010"]');
  perform pg_temp.said('and the group is met', r->'groups'->2->>'met', 'true');
  perform pg_temp.said('and the credits include it', r->'credits'->>'have', '18');

  ex2 := pg_temp.ask(adv, format($q$select public.degree_exception_propose('S-ANA', %L, 1, 'waive', null, null, 'Rejected waiver for the check', 'prop-rej-key01')$q$, vid))::jsonb;
  perform pg_temp.works('the dean rejecting', dean, format($q$select public.degree_exception_decide(%L, false, 'not supported', 'dec-rej-key001')$q$, ex2->>'id'));
  r := pg_temp.ask(adv, $q$select public.degree_audit_run('S-ANA', null, false, 'run-a-key-0006')$q$)::jsonb;
  perform pg_temp.said('a rejected waiver changes nothing', r->'groups'->0->>'waived', 'false');

  -- ── Saved runs ─────────────────────────────────────────────────
  perform pg_temp.refused_for('the dean saving a run', dean, format($q$select public.degree_audit_run('S-ANA', null, true, 'run-dean-key01')$q$), 'that needs degree:declare');
  run1 := pg_temp.ask(adv, $q$select public.degree_audit_run('S-ANA', null, true, 'run-save-key01')$q$)::jsonb;
  run2 := pg_temp.ask(adv, $q$select public.degree_audit_run('S-ANA', null, true, 'run-save-key01')$q$)::jsonb;
  perform pg_temp.said('the same key is the same saved run', run2->>'saved', run1->>'saved');
  perform pg_temp.counted('one run was kept', (select count(*) from public.degree_audit_runs), 1);
  perform pg_temp.said('a saved run holds a ledger fingerprint', (select (fingerprint ~ '^[0-9a-f]{64}$')::text from public.degree_audit_runs), 'true');
  begin
    update public.degree_audit_runs set result = '{}'::jsonb;
    raise exception 'FAILED: a saved run was rewritten';
  exception when insufficient_privilege then
    raise notice 'ok  a saved run is never rewritten (%)', sqlerrm;
  end;
  begin
    update public.student_degrees set student_ref = 'S-OTHER';
    raise exception 'FAILED: a declaration was rewritten';
  exception when insufficient_privilege then
    raise notice 'ok  a declaration is never rewritten (%)', sqlerrm;
  end;

  -- A what-if: another year, never saved.
  vid2 := ((pg_temp.ask(reg, $q$select public.degree_version_save('econ', 'Economics', 'major', 2027, 6, 2.0, '[{"name":"Only","kind":"credits","need":6,"rules":[{"prefix":"ECON"}]}]'::jsonb, 'save-econ27-key')$q$))::jsonb->>'id')::uuid;
  perform pg_temp.works('publishing the next year', reg, format($q$select public.degree_version_publish(%L, 'pub-econ27-key')$q$, vid2));
  r := pg_temp.ask(adv, format($q$select public.degree_audit_run('S-ANA', %L, false, 'run-wi-key-001')$q$, vid2))::jsonb;
  perform pg_temp.said('a what-if says so', r->>'what_if', 'true');
  perform pg_temp.said('and reads the other year', r->>'catalog_year', '2027');
  perform pg_temp.refused_for('saving a what-if', adv, format($q$select public.degree_audit_run('S-ANA', %L, true, 'run-wi-key-002')$q$, vid2), 'never saved');
  perform pg_temp.counted('still one saved run', (select count(*) from public.degree_audit_runs), 1);

  -- ── Reading ────────────────────────────────────────────────────
  perform pg_temp.said('Ana reads her own audit', pg_temp.ask(ana, $q$select (public.degree_audit_run('S-ANA', null, false, 'run-ana-key-01'))->>'program'$q$), 'ECON');
  perform pg_temp.refused_for('Ben reading Ana''s', ben, $q$select public.degree_audit_run('S-ANA', null, false, 'run-ben-key-01')$q$, 'that needs degree:read');
  perform pg_temp.refused_for('Ana saving a run', ana, $q$select public.degree_audit_run('S-ANA', null, true, 'run-ana-key-02')$q$, 'that needs degree:declare');
  perform pg_temp.counted('Ana reads her declaration', pg_temp.seen(ana, 'select 1 from public.student_degrees'), 1);
  perform pg_temp.counted('Ben reads no declaration', pg_temp.seen(ben, 'select 1 from public.student_degrees'), 0);
  perform pg_temp.counted('Ana reads her saved run', pg_temp.seen(ana, 'select 1 from public.degree_audit_runs'), 1);
  perform pg_temp.counted('Ben reads no saved run', pg_temp.seen(ben, 'select 1 from public.degree_audit_runs'), 0);
  perform pg_temp.counted('Ana reads her exceptions', pg_temp.seen(ana, 'select 1 from public.degree_exceptions'), 3);
  perform pg_temp.counted('Ben reads none', pg_temp.seen(ben, 'select 1 from public.degree_exceptions'), 0);

  -- ── Nobody writes through the API ──────────────────────────────
  perform pg_temp.refused_for('inserting a program directly', reg, $q$insert into public.degree_programs (tenant_id, code, name) values ('da-u', 'XX', 'x')$q$, 'permission denied');
  perform pg_temp.refused_for('inserting a declaration directly', adv,
    format($q$insert into public.student_degrees (tenant_id, student_ref, version_id, operation) values ('da-u', 'S-ANA', %L, 'x')$q$, vid), 'permission denied');
  perform pg_temp.refused_for('approving an exception directly', reg2, $q$update public.degree_exceptions set status = 'approved'$q$, 'permission denied');

  -- ── The switches ───────────────────────────────────────────────
  update public.tenant_module_mode set mode = 'connect', frozen = true where tenant_id = 'da-u' and module = 'degree_audit';
  perform pg_temp.refused_for('an audit while the module is frozen', adv, $q$select public.degree_audit_run('S-ANA', null, false, 'run-frz-key-01')$q$, 'does not run the degree audit in Core');
  update public.tenant_module_mode set mode = 'core', frozen = false where tenant_id = 'da-u' and module = 'degree_audit';
  perform pg_temp.works('an audit once it is thawed', adv, $q$select public.degree_audit_run('S-ANA', null, false, 'run-thaw-key-1')$q$);
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason) values ('da-u', 'kill.core_modules', true, 'drill');
  perform pg_temp.refused_for('an audit under the kill switch', adv, $q$select public.degree_audit_run('S-ANA', null, false, 'run-kill-key-01')$q$, 'does not run the degree audit in Core');
  perform pg_temp.refused_for('publishing under the kill switch', reg, format($q$select public.degree_version_publish(%L, 'pub-kill-key-01')$q$, vid2), 'does not run the degree audit in Core');
  update public.feature_kill_switch set engaged = false where tenant_id = 'da-u';

  -- ── Deleting a staff account keeps the record ──────────────────
  delete from auth.users where id = adv;
  perform pg_temp.counted('the saved run survives its runner', (select count(*) from public.degree_audit_runs), 1);
  perform pg_temp.counted('and the declaration survives its declarer', (select count(*) from public.student_degrees), 1);
  delete from auth.users where id = reg;
  perform pg_temp.counted('a published catalog year survives the registrar who wrote it', (select count(*) from public.degree_versions where status = 'published' and created_by is null), 2);
  perform pg_temp.counted('and so does the program', (select count(*) from public.degree_programs where created_by is null), 1);
  raise notice 'degree audit checks passed';
end $$;

rollback;
