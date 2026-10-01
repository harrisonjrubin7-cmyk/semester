-- supabase/degree-audit.check.sql — who authors a degree program, who runs an
-- audit of whom, what an audit reads, and that nothing it keeps is rewritten.
--
-- For 20260930250000_degree_audit.sql. One school, da-u, which has switched
-- `degree_audit` to Core: a registrar, a dean, an academic advisor, a faculty
-- member, a second registrar who approves ledger changes, and three students,
-- two of whom the school linked to a record (S100, S200) and one not. A
-- second school, da-conn, stays in Connect, and a third, da-other, is Core
-- with its own registrar. What it proves:
--
--   * the arithmetic: every case in app/src/lib/degreeaudit/fixtures.json is
--     run through `private.degree_audit_compute` and must come out exactly as
--     the TypeScript twin computed it (the same file is read by
--     degreeaudit.test.ts), and so must the digest text of its inputs; a
--     control shows the comparison can fail;
--   * only `degree:author` (registrar, dean) writes a program; an advisor, a
--     faculty member and a student do not; a program is a draft until
--     published, takes requirements while it is a draft, and publishing needs
--     at least one;
--   * a published program is immutable even to the owner: its title, its
--     requirements, adding to it, deleting it; a change is a new version,
--     copied from the last, and publishing it retires the one it replaces;
--     nothing at all is written through the API;
--   * `degree:audit` (registrar, dean, advisor) audits any student at the
--     school; a student audits only the record the school linked to their own
--     account; faculty, an unlinked student and another school's registrar
--     audit nothing here;
--   * the audit reads the ledger as of the date: a void entry does not count,
--     an entry effective later does not count, a correction counts from its
--     own date, in-progress is not done, and double counting is stated;
--   * the as-of date cannot be later than tomorrow, and a record that does not
--     exist is not audited;
--   * the audit writes nothing to the academic ledger, keeps who asked, the
--     program version used and a digest of what it read, and what it keeps is
--     never edited or deleted;
--   * every mutation is idempotent on its key, and a key reused for another
--     request or by another caller is refused;
--   * a student reads the audits of their own record and no other; an advisor
--     reads all; a draft is read by authors and by nobody else;
--   * a school in Connect can do none of it, and neither can one whose module
--     is frozen or whose Core modules are paused, though what was written stays
--     readable.
--
-- The control: each refusal comes after the same call working for the right
-- person, so a refusal is the rule's doing and not a broken fixture.
--
--   How to run it: supabase/check.sh degree-audit

-- The fixtures, read from the file the TypeScript test reads. check.sh exports
-- SEMESTER_SUPABASE_DIR; run by hand from the repository root it falls back to
-- ./supabase.
\set fixtures `tr '\n' ' ' < "${SEMESTER_SUPABASE_DIR:-supabase}/../app/src/lib/degreeaudit/fixtures.json"`

begin;

create temp table fx on commit drop as select :'fixtures'::jsonb as j;

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

-- The error a statement raises as `who`, or null when it ran.
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

-- The same, as the owner: what a trigger refuses even there.
create or replace function pg_temp.owner_err(statement text)
returns text language plpgsql as $$
begin
  execute statement;
  return null;
exception when others then
  return sqlerrm;
end $$;

create or replace function pg_temp.works(what text, who uuid, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is not null then raise exception 'FAILED: % — refused: %', what, e; end if;
  raise notice 'ok  % works', what;
end $$;

create or replace function pg_temp.refused(what text, who uuid, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;

-- Refused with a message that names `why`, so a refusal is the rule's and not
-- some other error a broken fixture could give.
create or replace function pg_temp.refused_for(what text, who uuid, statement text, why text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  if e not like '%' || why || '%' then
    raise exception 'FAILED: % — refused, but not for "%": %', what, why, e;
  end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;

create or replace function pg_temp.owner_refused_for(what text, statement text, why text)
returns void language plpgsql as $$
declare e text := pg_temp.owner_err(statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  if e not like '%' || why || '%' then
    raise exception 'FAILED: % — refused, but not for "%": %', what, why, e;
  end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;

-- A value a statement returns as `who`, as text.
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

-- One value out of a kept audit's result, by path.
create or replace function pg_temp.jq(audit uuid, path text[])
returns text language sql as $$
  select result #>> path from public.degree_audits where id = audit;
$$;

-- Post one entry to the ledger the only way it can be: proposed by one
-- person, approved by another.
create or replace function pg_temp.post(prop uuid, decider uuid, student text, kind text, subject text, val text, eff date,
                                       act text default 'set')
returns void language plpgsql as $$
declare change uuid; e text;
begin
  perform pg_temp.become(prop);
  execute format(
    'insert into public.academic_record_changes (tenant_id, student_ref, kind, subject_key, action, value, effective_on, reason, source)
     values (%L, %L, %L, %L, %L, %L, %L, %L, %L) returning id',
    'da-u', student, kind, subject, act, val, eff, 'Posted for the degree audit check.', 'registrar') into change;
  execute 'reset role';
  e := pg_temp.err(decider, format('update public.academic_record_changes set status = ''approved'' where id = %L', change));
  if e is not null then raise exception 'FAILED: posting % % — %', kind, subject, e; end if;
end $$;

-- ── The arithmetic, held to the TypeScript twin ───────────────────────────
do $$
declare c jsonb; got jsonb; want jsonb; n integer := 0;
begin
  if (select jsonb_array_length(j) from fx) < 8 then
    raise exception 'FAILED: the fixtures file was not read (the probe found %)', (select jsonb_array_length(j) from fx);
  end if;
  for c in select jsonb_array_elements(j) from fx loop
    got := private.degree_audit_compute(c->'program', c->'lines');
    want := c->'expected'->'result';
    if got is distinct from want then
      raise exception 'FAILED: the SQL audit and the TypeScript twin disagree on "%": sql % — ts %', c->>'name', got, want;
    end if;
    if private.degree_audit_inputs_text(c->'lines') is distinct from c->'expected'->>'inputs_text' then
      raise exception 'FAILED: the digest text of the inputs differs on "%"', c->>'name';
    end if;
    -- The control: the same comparison fails when the answer is wrong.
    if got is not distinct from jsonb_set(want, '{verdict}', '"not a verdict"') then
      raise exception 'FAILED: the comparison cannot fail on "%"', c->>'name';
    end if;
    n := n + 1;
    raise notice 'ok  parity: %', c->>'name';
  end loop;
  perform pg_temp.counted('every fixture case was compared', n, (select jsonb_array_length(j) from fx));
  -- Two lines for one kind and key is a caller's bug, and says so.
  perform pg_temp.owner_refused_for('two lines for one key',
    $q$select private.degree_audit_compute('{"passing_grades":["A"],"requirements":[]}',
        '[{"kind":"grade","key":"X 1 · T","value":"A","effective_on":"2026-01-01","id":"a"},{"kind":"grade","key":"X 1 · T","value":"A","effective_on":"2026-01-01","id":"b"}]')$q$,
    'one ledger line for each kind and key');
  perform pg_temp.owner_refused_for('a minimum grade the program does not pass',
    $q$select private.degree_audit_compute('{"passing_grades":["A"],"requirements":[{"sort":1,"name":"r","need":"courses","count":1,"accepts":[],"min_grade":"B"}]}', '[]')$q$,
    'passing grades');
end $$;

do $$
declare
  reg uuid; dean2 uuid; adv uuid; prof uuid; reg2 uuid; ana uuid; ben uuid; cal uuid; far_reg uuid; conn_reg uuid; conn_stu uuid;
  v1 uuid; v2 uuid; v3 uuid; empty uuid; rq1 uuid; draft_other uuid; conn_prog uuid;
  a1 uuid; a2 uuid; a3 uuid; a4 uuid; a5 uuid; a6 uuid; a7 uuid;
  ledger_before bigint; ledger_after bigint; n bigint; e text; digest text; want_digest text;
  future constant date := current_date + 30;
begin
  insert into public.schools (id, name, email_domains) values
    ('da-u',     'Degree Audit University', array['da-u.example']),
    ('da-conn',  'Connect College',         array['da-conn.example']),
    ('da-other', 'Other University',        array['da-other.example']);

  reg       := pg_temp.newuser('reg@da-u.example', 'da-u');
  reg2      := pg_temp.newuser('reg2@da-u.example', 'da-u');
  dean2     := pg_temp.newuser('dean@da-u.example', 'da-u');
  adv       := pg_temp.newuser('adv@da-u.example', 'da-u');
  prof      := pg_temp.newuser('prof@da-u.example', 'da-u');
  ana       := pg_temp.newuser('ana@da-u.example', 'da-u');
  ben       := pg_temp.newuser('ben@da-u.example', 'da-u');
  cal       := pg_temp.newuser('cal@da-u.example', 'da-u');
  far_reg   := pg_temp.newuser('reg@da-other.example', 'da-other');
  conn_reg  := pg_temp.newuser('reg@da-conn.example', 'da-conn');
  conn_stu  := pg_temp.newuser('stu@da-conn.example', 'da-conn');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (reg,      'registrar',        'school', 'da-u',     'institution'),
    (reg2,     'registrar',        'school', 'da-u',     'institution'),
    (dean2,    'dean',             'school', 'da-u',     'institution'),
    (adv,      'academic_advisor', 'school', 'da-u',     'institution'),
    (prof,     'faculty',          'school', 'da-u',     'institution'),
    (ana,      'student',          'school', 'da-u',     'institution'),
    (ben,      'student',          'school', 'da-u',     'institution'),
    (cal,      'student',          'school', 'da-u',     'institution'),
    (far_reg,  'registrar',        'school', 'da-other', 'institution'),
    (conn_reg, 'registrar',        'school', 'da-conn',  'institution'),
    (conn_stu, 'student',          'school', 'da-conn',  'institution');

  -- The school links an account to a record: Ana is S100, Ben is S200, Cal is nobody.
  insert into public.academic_record_subjects (tenant_id, student_ref, user_id) values
    ('da-u', 'S100', ana), ('da-u', 'S200', ben), ('da-conn', 'C100', conn_stu);

  -- ── The mode: Core at da-u and da-other, Connect at da-conn ────────────────
  -- A control first: until the module is Core, the registrar is refused for
  -- the mode and for nothing else.
  perform pg_temp.refused_for('a registrar in a school still in Connect', reg,
    $q$select public.degree_program_create('ECON-BA', 'Economics, B.A.', 2026, array['A','B','C'], null, 'early-create-01')$q$,
    'has not switched degree audit to Semester Core');
  insert into public.tenant_module_mode (tenant_id, module, mode, reason) values
    ('da-u', 'degree_audit', 'core', 'the check suite'),
    ('da-other', 'degree_audit', 'core', 'the check suite');

  -- ── Authoring ──────────────────────────────────────────────────────────────
  v1 := pg_temp.ask(reg, $q$select public.degree_program_create(' econ-ba ', 'Economics, B.A.', 2026,
          array['A','A-','B+','B','B-','C+','C','C-','D+','D','D-'], null, 'create-v1-key-01')$q$)::uuid;
  perform pg_temp.said('the registrar makes a draft, version 1, the code tidied',
    (select code || ' ' || catalog_year || ' v' || version || ' ' || state from public.degree_programs where id = v1), 'ECON-BA 2026 v1 draft');
  perform pg_temp.said('the same key again answers the same id',
    pg_temp.ask(reg, $q$select public.degree_program_create(' econ-ba ', 'Economics, B.A.', 2026,
          array['A','A-','B+','B','B-','C+','C','C-','D+','D','D-'], null, 'create-v1-key-01')$q$), v1::text);
  perform pg_temp.counted('and wrote one program', (select count(*) from public.degree_programs), 1);
  perform pg_temp.refused_for('the same key for a different program', reg,
    $q$select public.degree_program_create('ECON-BA', 'Something else', 2026, array['A'], null, 'create-v1-key-01')$q$, 'already used for a different request');
  perform pg_temp.refused_for('the same key from somebody else', dean2,
    $q$select public.degree_program_create(' econ-ba ', 'Economics, B.A.', 2026,
          array['A','A-','B+','B','B-','C+','C','C-','D+','D','D-'], null, 'create-v1-key-01')$q$, 'already used for a different request');
  perform pg_temp.refused('a key that is too short', reg,
    $q$select public.degree_program_create('ECON-BA', 'x', 2027, array['A'], null, 'short')$q$);
  perform pg_temp.refused_for('a second draft of the same program and year', reg,
    $q$select public.degree_program_create('ECON-BA', 'Economics, B.A.', 2026, array['A'], null, 'create-dup-key-01')$q$, 'draft of this program already exists');

  perform pg_temp.refused_for('an advisor authoring', adv,
    $q$select public.degree_program_create('HIST-BA', 'History', 2026, array['A'], null, 'adv-create-key-1')$q$, 'degree:author');
  perform pg_temp.refused_for('faculty authoring', prof,
    $q$select public.degree_program_create('HIST-BA', 'History', 2026, array['A'], null, 'prof-create-key1')$q$, 'degree:author');
  perform pg_temp.refused_for('a student authoring', ana,
    $q$select public.degree_program_create('HIST-BA', 'History', 2026, array['A'], null, 'ana-create-key-1')$q$, 'degree:author');
  -- A registrar at another school is a registrar there: their own school's
  -- program is theirs to make, and this school's is not theirs to touch.
  draft_other := pg_temp.ask(far_reg, $q$select public.degree_program_create('ECON-BA', 'Economics, B.A.', 2026, array['A','B'], null, 'far-create-key-1')$q$)::uuid;
  perform pg_temp.said('a registrar at another school makes their own school''s program',
    (select tenant_id from public.degree_programs where id = draft_other), 'da-other');
  perform pg_temp.refused_for('and cannot reach this school''s draft', far_reg,
    format($q$select public.degree_requirement_add(%L, 'Sneaked in', 'courses', 1, array[]::text[], null, 'far-add-key-0001')$q$, v1), 'no such program here');
  perform pg_temp.counted('a registrar does not read another school''s draft', pg_temp.seen(far_reg, 'select * from public.degree_programs'), 1);
  perform pg_temp.refused('a blank title', reg,
    $q$select public.degree_program_create('ART-BA', '   ', 2026, array['A'], null, 'blank-title-key1')$q$);
  perform pg_temp.refused('a catalog year that is not one', reg,
    $q$select public.degree_program_create('ART-BA', 'Art', 1800, array['A'], null, 'bad-year-key-001')$q$);
  perform pg_temp.refused_for('a program with no passing grades', reg,
    $q$select public.degree_program_create('ART-BA', 'Art', 2026, array[]::text[], null, 'no-grades-key-01')$q$, 'passing grades');
  perform pg_temp.refused_for('passing grades that repeat', reg,
    $q$select public.degree_program_create('ART-BA', 'Art', 2026, array['A','B','A'], null, 'dup-grades-key-1')$q$, 'listed once');
  perform pg_temp.works('the dean, who also holds degree:author, a control', dean2,
    $q$select public.degree_program_create('HIST-BA', 'History, B.A.', 2026, array['A','B','C'], null, 'dean-create-key-1')$q$);

  -- ── Requirements, added to a draft ─────────────────────────────────────────
  rq1 := pg_temp.ask(reg, format($q$select public.degree_requirement_add(%L, 'Core theory', 'courses', 2, array['econ 2010', 'ECON 1010'], null, 'req-core-key-001')$q$, v1))::uuid;
  perform pg_temp.said('a requirement is added, its codes tidied and sorted',
    (select accepts::text || ' ' || sort from public.degree_requirements where id = rq1), '{"ECON 1010","ECON 2010"} 1');
  perform pg_temp.said('the same key again answers the same id',
    pg_temp.ask(reg, format($q$select public.degree_requirement_add(%L, 'Core theory', 'courses', 2, array['ECON 1010', 'econ  2010'], null, 'req-core-key-001')$q$, v1)), rq1::text);
  perform pg_temp.works('a second, in hours', reg,
    format($q$select public.degree_requirement_add(%L, 'Distribution', 'hours', 6, array['HIST', 'PSCI'], null, 'req-dist-key-001')$q$, v1));
  perform pg_temp.works('a third, with a minimum grade', reg,
    format($q$select public.degree_requirement_add(%L, 'Major core', 'courses', 1, array['ECON'], 'C', 'req-major-key-01')$q$, v1));
  perform pg_temp.counted('three requirements in order', (select count(*) from public.degree_requirements where program_id = v1), 3);
  perform pg_temp.refused_for('a minimum grade the program does not pass', reg,
    format($q$select public.degree_requirement_add(%L, 'Honours', 'courses', 1, array['ECON'], 'A+', 'req-honours-key1')$q$, v1), 'passing grades');
  perform pg_temp.refused_for('half a course', reg,
    format($q$select public.degree_requirement_add(%L, 'Half', 'courses', 1.5, array[]::text[], null, 'req-half-key-001')$q$, v1), 'positive whole number');
  perform pg_temp.refused('hours to three decimals', reg,
    format($q$select public.degree_requirement_add(%L, 'Fine', 'hours', 1.234, array[]::text[], null, 'req-fine-key-001')$q$, v1));
  perform pg_temp.refused('a requirement of nothing', reg,
    format($q$select public.degree_requirement_add(%L, 'Nothing', 'hours', 0, array[]::text[], null, 'req-zero-key-001')$q$, v1));
  perform pg_temp.refused('a need that is neither', reg,
    format($q$select public.degree_requirement_add(%L, 'Odd', 'credits', 1, array[]::text[], null, 'req-odd-key-0001')$q$, v1));
  perform pg_temp.refused_for('a name used twice', reg,
    format($q$select public.degree_requirement_add(%L, 'Core theory', 'courses', 3, array[]::text[], null, 'req-twice-key-01')$q$, v1), 'already has a requirement of that name');
  perform pg_temp.refused('a code that is not one', reg,
    format($q$select public.degree_requirement_add(%L, 'Odd codes', 'courses', 1, array['ECON; drop'], null, 'req-codes-key-01')$q$, v1));
  perform pg_temp.refused_for('an advisor adding a requirement', adv,
    format($q$select public.degree_requirement_add(%L, 'Advisor''s', 'courses', 1, array[]::text[], null, 'adv-add-key-0001')$q$, v1), 'degree:author');
  perform pg_temp.refused_for('a student adding one', ana,
    format($q$select public.degree_requirement_add(%L, 'Student''s', 'courses', 1, array[]::text[], null, 'ana-add-key-0001')$q$, v1), 'degree:author');

  -- ── A draft is the authors' ────────────────────────────────────────────────
  perform pg_temp.counted('the registrar reads the draft', pg_temp.seen(reg, format('select * from public.degree_programs where id = %L', v1)), 1);
  perform pg_temp.counted('the dean does, who also authors', pg_temp.seen(dean2, format('select * from public.degree_programs where id = %L', v1)), 1);
  perform pg_temp.counted('an advisor does not', pg_temp.seen(adv, format('select * from public.degree_programs where id = %L', v1)), 0);
  perform pg_temp.counted('a student does not', pg_temp.seen(ana, format('select * from public.degree_programs where id = %L', v1)), 0);
  perform pg_temp.counted('nor its requirements', pg_temp.seen(ana, 'select * from public.degree_requirements'), 0);
  perform pg_temp.refused_for('a student cannot audit a draft', ana,
    format($q$select public.degree_audit_run(%L, 'S100', '2026-09-01', 'ana-draft-run-01')$q$, v1), 'no such published program');
  perform pg_temp.refused_for('nor can the registrar', reg,
    format($q$select public.degree_audit_run(%L, 'S100', '2026-09-01', 'reg-draft-run-01')$q$, v1), 'no such published program');

  -- ── Publishing ─────────────────────────────────────────────────────────────
  empty := pg_temp.ask(dean2, $q$select public.degree_program_create('HIST-BA', 'History, B.A.', 2027, array['A','B','C'], null, 'dean-create-key-2')$q$)::uuid;
  perform pg_temp.refused_for('publishing a program with no requirements', dean2,
    format($q$select public.degree_program_publish(%L, 'publish-empty-k01')$q$, empty), 'no requirements');
  perform pg_temp.refused_for('an advisor publishing', adv, format($q$select public.degree_program_publish(%L, 'adv-publish-key-1')$q$, v1), 'degree:author');
  perform pg_temp.works('the registrar publishing', reg, format($q$select public.degree_program_publish(%L, 'publish-v1-key-01')$q$, v1));
  perform pg_temp.works('the same key again', reg, format($q$select public.degree_program_publish(%L, 'publish-v1-key-01')$q$, v1));
  perform pg_temp.said('it is published', (select state from public.degree_programs where id = v1), 'published');
  perform pg_temp.refused_for('publishing it twice under a new key', reg,
    format($q$select public.degree_program_publish(%L, 'publish-v1-key-02')$q$, v1), 'only a draft can be published');
  perform pg_temp.refused_for('adding to a published program', reg,
    format($q$select public.degree_requirement_add(%L, 'Late addition', 'courses', 1, array[]::text[], null, 'req-late-key-001')$q$, v1), 'draft only');
  perform pg_temp.counted('a student now reads the program', pg_temp.seen(ana, format('select * from public.degree_programs where id = %L', v1)), 1);
  perform pg_temp.counted('and its three requirements', pg_temp.seen(ana, 'select * from public.degree_requirements'), 3);
  perform pg_temp.counted('a student at another school does not read it', pg_temp.seen(conn_stu, 'select * from public.degree_programs'), 0);

  -- ── A published program is immutable, to the owner too ─────────────────────
  perform pg_temp.refused('no client writes a program', reg, format($q$update public.degree_programs set title = 'Mine' where id = %L$q$, v1));
  perform pg_temp.refused('no client inserts one', reg,
    $q$insert into public.degree_programs (tenant_id, code, title, catalog_year, version, passing_grades, operation) values ('da-u', 'X', 'X', 2026, 9, array['A'], 'x')$q$);
  perform pg_temp.refused('no client deletes one', reg, format($q$delete from public.degree_programs where id = %L$q$, v1));
  perform pg_temp.refused('no client writes a requirement', reg, format($q$update public.degree_requirements set need_count = 1 where id = %L$q$, rq1));
  perform pg_temp.refused('no client writes an operation', reg, $q$delete from public.degree_audit_operations$q$);
  perform pg_temp.owner_refused_for('the owner cannot retitle it', format($q$update public.degree_programs set title = 'Edited' where id = %L$q$, v1), 'a change is a new version');
  perform pg_temp.owner_refused_for('nor change its passing grades', format($q$update public.degree_programs set passing_grades = array['A'] where id = %L$q$, v1), 'a change is a new version');
  perform pg_temp.owner_refused_for('nor delete it', format($q$delete from public.degree_programs where id = %L$q$, v1), 'never deleted');
  perform pg_temp.owner_refused_for('nor edit a requirement', format($q$update public.degree_requirements set need_count = 1 where id = %L$q$, rq1), 'never edited or removed');
  perform pg_temp.owner_refused_for('nor remove one', format($q$delete from public.degree_requirements where id = %L$q$, rq1), 'never edited or removed');
  perform pg_temp.owner_refused_for('nor add one', format($q$insert into public.degree_requirements (tenant_id, program_id, sort, name, need, need_count, operation) values ('da-u', %L, 9, 'Sneaked', 'courses', 1, 'x')$q$, v1), 'draft only');
  perform pg_temp.owner_refused_for('nor move it back to a draft', format($q$update public.degree_programs set state = 'draft', published_at = null where id = %L$q$, v1), 'goes draft, published, retired');
  perform pg_temp.said('the program is as it was made', (select title from public.degree_programs where id = v1), 'Economics, B.A.');

  -- ── A change is a new version ──────────────────────────────────────────────
  perform pg_temp.refused_for('a new version of a program nobody made', reg,
    $q$select public.degree_program_create('ECON-BA', 'Economics, B.A.', 2026, null, gen_random_uuid(), 'copy-none-key-01')$q$, 'copies an earlier version');
  perform pg_temp.refused_for('a copy of another program', reg,
    format($q$select public.degree_program_create('MATH-BA', 'Mathematics', 2026, null, %L, 'copy-other-key-01')$q$, v1), 'copies an earlier version');
  perform pg_temp.refused_for('a copy whose grades drop a requirement''s minimum', reg,
    format($q$select public.degree_program_create('ECON-BA', 'Economics, B.A.', 2026, array['A','B'], %L, 'copy-grades-key-1')$q$, v1), 'minimum grade');
  v2 := pg_temp.ask(reg, format($q$select public.degree_program_create('ECON-BA', 'Economics, B.A.', 2026, null, %L, 'create-v2-key-01')$q$, v1))::uuid;
  perform pg_temp.said('version 2 is a draft', (select version || ' ' || state from public.degree_programs where id = v2), '2 draft');
  perform pg_temp.counted('it starts with the three requirements of version 1', (select count(*) from public.degree_requirements where program_id = v2), 3);
  perform pg_temp.said('and the same passing grades',
    (select (a.passing_grades = b.passing_grades)::text from public.degree_programs a, public.degree_programs b where a.id = v1 and b.id = v2), 'true');
  perform pg_temp.works('a fourth is added to version 2', reg,
    format($q$select public.degree_requirement_add(%L, 'Free electives', 'hours', 3, array[]::text[], null, 'req-free-key-001')$q$, v2));
  perform pg_temp.counted('version 1 still has three', (select count(*) from public.degree_requirements where program_id = v1), 3);
  perform pg_temp.works('publishing version 2', reg, format($q$select public.degree_program_publish(%L, 'publish-v2-key-01')$q$, v2));
  perform pg_temp.said('version 1 was retired by it', (select state from public.degree_programs where id = v1), 'retired');
  perform pg_temp.said('and version 2 is the one published', (select state from public.degree_programs where id = v2), 'published');
  perform pg_temp.counted('one published version of a program and year', (select count(*) from public.degree_programs where code = 'ECON-BA' and state = 'published'), 1);
  perform pg_temp.owner_refused_for('a retired program does not change', format($q$update public.degree_programs set state = 'published', retired_at = null where id = %L$q$, v1), 'retired program does not change');
  perform pg_temp.refused_for('retiring it again', reg, format($q$select public.degree_program_retire(%L, 'retire-v1-key-01')$q$, v1), 'already retired');
  perform pg_temp.refused_for('an audit against a retired version', reg,
    format($q$select public.degree_audit_run(%L, 'S100', '2026-09-01', 'reg-retired-run1')$q$, v1), 'retired');

  -- ── The ledger, posted the only way it can be ──────────────────────────────
  -- S100: ECON 1010 done; ECON 2010 graded B then corrected to A- from June;
  -- PSCI 2100 graded A then removed in January; HIST 1100 in progress this
  -- fall; ECON 3000 graded, but only from a date that has not come.
  perform pg_temp.post(prof, reg2, 'S100', 'grade',  'ECON 1010 · Fall 2025',   'B+', date '2025-12-18');
  perform pg_temp.post(prof, reg2, 'S100', 'credit', 'ECON 1010 · Fall 2025',   '3',  date '2025-12-18');
  perform pg_temp.post(prof, reg2, 'S100', 'grade',  'ECON 2010 · Spring 2026', 'B',  date '2026-05-15');
  perform pg_temp.post(prof, reg2, 'S100', 'credit', 'ECON 2010 · Spring 2026', '3',  date '2026-05-15');
  perform pg_temp.post(prof, reg2, 'S100', 'grade',  'ECON 2010 · Spring 2026', 'A-', date '2026-06-01');
  perform pg_temp.post(prof, reg2, 'S100', 'grade',  'PSCI 2100 · Fall 2025',   'A',  date '2025-12-18');
  perform pg_temp.post(prof, reg2, 'S100', 'credit', 'PSCI 2100 · Fall 2025',   '3',  date '2025-12-18');
  perform pg_temp.post(prof, reg2, 'S100', 'grade',  'PSCI 2100 · Fall 2025',   '',   date '2026-01-10', 'void');
  perform pg_temp.post(prof, reg2, 'S100', 'enrollment', 'HIST 1100 · Fall 2026', 'Enrolled', date '2026-08-20');
  perform pg_temp.post(prof, reg2, 'S100', 'credit', 'HIST 1100 · Fall 2026',   '3',  date '2026-08-20');
  perform pg_temp.post(prof, reg2, 'S100', 'grade',  'ECON 3000 · Fall 2027',   'A',  future);
  perform pg_temp.post(prof, reg2, 'S200', 'grade',  'ECON 1010 · Fall 2025',   'C-', date '2025-12-18');
  perform pg_temp.counted('the ledger holds 11 entries for S100 and 1 for S200',
    (select count(*) from public.academic_record_entries where student_ref = 'S100') * 100 + (select count(*) from public.academic_record_entries where student_ref = 'S200'), 1101);
  select count(*) into ledger_before from public.academic_record_entries;

  -- ── Who audits ─────────────────────────────────────────────────────────────
  a1 := pg_temp.ask(ana, format($q$select public.degree_audit_run(%L, 'S100', '2026-09-01', 'ana-run-key-001')$q$, v2))::uuid;
  perform pg_temp.said('a student audits the record linked to their own account', (select student_ref from public.degree_audits where id = a1), 'S100');
  perform pg_temp.refused_for('a student auditing another student', ana,
    format($q$select public.degree_audit_run(%L, 'S200', '2026-09-01', 'ana-run-key-002')$q$, v2), 'your own record');
  perform pg_temp.refused_for('a student auditing a record nobody linked to them', ana,
    format($q$select public.degree_audit_run(%L, 'S300', '2026-09-01', 'ana-run-key-003')$q$, v2), 'your own record');
  perform pg_temp.refused_for('Ben auditing Ana''s record', ben,
    format($q$select public.degree_audit_run(%L, 'S100', '2026-09-01', 'ben-run-key-001')$q$, v2), 'your own record');
  perform pg_temp.works('Ben auditing his own, a control', ben,
    format($q$select public.degree_audit_run(%L, 'S200', '2026-09-01', 'ben-run-key-002')$q$, v2));
  perform pg_temp.refused_for('a student with no linked record', cal,
    format($q$select public.degree_audit_run(%L, 'S100', '2026-09-01', 'cal-run-key-001')$q$, v2), 'your own record');
  perform pg_temp.refused_for('faculty with no degree:audit', prof,
    format($q$select public.degree_audit_run(%L, 'S100', '2026-09-01', 'prof-run-key-01')$q$, v2), 'your own record');
  perform pg_temp.works('an advisor, for any student at the school', adv,
    format($q$select public.degree_audit_run(%L, 'S200', '2026-09-01', 'adv-run-key-001')$q$, v2));
  perform pg_temp.works('the dean', dean2, format($q$select public.degree_audit_run(%L, 'S100', '2026-09-01', 'dean-run-key-01')$q$, v2));
  perform pg_temp.works('the registrar', reg, format($q$select public.degree_audit_run(%L, 'S100', '2026-09-01', 'reg-run-key-0001')$q$, v2));
  perform pg_temp.refused_for('a registrar at another school, for this school''s program', far_reg,
    format($q$select public.degree_audit_run(%L, 'S100', '2026-09-01', 'far-run-key-001')$q$, v2), 'no such published program');
  perform pg_temp.refused_for('an audit of a record that does not exist', reg,
    format($q$select public.degree_audit_run(%L, 'S999', '2026-09-01', 'reg-run-key-0002')$q$, v2), 'no academic record');
  perform pg_temp.refused('a student reference that is not one', reg,
    format($q$select public.degree_audit_run(%L, 'S1 00; --', '2026-09-01', 'reg-run-key-0003')$q$, v2));

  -- ── The date cannot be forged ──────────────────────────────────────────────
  perform pg_temp.works('an audit as of tomorrow, a day''s slack for a caller east of UTC', reg,
    format($q$select public.degree_audit_run(%L, 'S100', %L, 'reg-run-key-0004')$q$, v2, current_date + 1));
  perform pg_temp.refused_for('as of the day after tomorrow', reg,
    format($q$select public.degree_audit_run(%L, 'S100', %L, 'reg-run-key-0005')$q$, v2, current_date + 2), 'never a later one');
  perform pg_temp.refused_for('as of the day the ECON 3000 grade takes effect', ana,
    format($q$select public.degree_audit_run(%L, 'S100', %L, 'ana-run-key-004')$q$, v2, future), 'never a later one');
  perform pg_temp.refused('as of nothing', reg, format($q$select public.degree_audit_run(%L, 'S100', null, 'reg-run-key-0006')$q$, v2));
  perform pg_temp.refused('as of a date before records existed', reg, format($q$select public.degree_audit_run(%L, 'S100', '1850-01-01', 'reg-run-key-0007')$q$, v2));

  -- ── What the audit read, as of 1 September 2026 ────────────────────────────
  perform pg_temp.said('the verdict is incomplete: Distribution has only a course in progress', pg_temp.jq(a1, '{verdict}'), 'incomplete');
  perform pg_temp.said('Core theory is met by the two ECON courses', pg_temp.jq(a1, '{requirements,0,have}') || '/' || pg_temp.jq(a1, '{requirements,0,met}'), '2/true');
  perform pg_temp.said('the removed grade does not count: Distribution has nothing finished', pg_temp.jq(a1, '{requirements,1,have}'), '0');
  perform pg_temp.said('the course in progress is not done, and is reported apart', pg_temp.jq(a1, '{requirements,1,doing,0,key}') || ' ' || pg_temp.jq(a1, '{requirements,1,will_have}'), 'HIST 1100 · Fall 2026 3');
  perform pg_temp.said('and it does not finish the requirement, so 3 hours are left', pg_temp.jq(a1, '{requirements,1,left}') || ' ' || pg_temp.jq(a1, '{requirements,1,meets_after}'), '3 false');
  perform pg_temp.said('the correction counts from its own date: ECON 2010 reads A-',
    (select c->>'grade' from public.degree_audits d, jsonb_array_elements(d.result->'courses') c where d.id = a1 and c->>'key' = 'ECON 2010 · Spring 2026'), 'A-');
  perform pg_temp.said('double counting is stated: ECON 2010 counted in Core theory, Major core and Free electives',
    (select c->>'counted_in' from public.degree_audits d, jsonb_array_elements(d.result->'courses') c where d.id = a1 and c->>'key' = 'ECON 2010 · Spring 2026'),
    '["Core theory", "Major core", "Free electives"]');
  perform pg_temp.counted('the entry that is not yet effective is not on the audit',
    (select count(*) from public.degree_audits d, jsonb_array_elements(d.result->'courses') c where d.id = a1 and c->>'key' like 'ECON 3000%'), 0);
  perform pg_temp.said('the PSCI course whose grade was removed is not done: only its credit is left, and it is listed as not counted',
    (select c->>'state' || ' ' || (c->>'reason') from public.degree_audits d, jsonb_array_elements(d.result->'courses') c where d.id = a1 and c->>'key' = 'PSCI 2100 · Fall 2025'),
    'not_counted no_grade_or_enrollment');
  perform pg_temp.said('it names the program version it ran against',
    (select program_code || ' ' || catalog_year || ' v' || program_version || ' ' || program_title from public.degree_audits where id = a1), 'ECON-BA 2026 v2 Economics, B.A.');
  perform pg_temp.said('who asked, and for which date',
    (select (requested_by = ana)::text || ' ' || as_of from public.degree_audits where id = a1), 'true 2026-09-01');

  -- The same record on other dates: the record as it then stood.
  a2 := pg_temp.ask(reg, format($q$select public.degree_audit_run(%L, 'S100', '2025-12-31', 'reg-asof-key-001')$q$, v2))::uuid;
  perform pg_temp.said('as of 31 December 2025 the PSCI grade was in effect: Distribution has 3 hours',
    pg_temp.jq(a2, '{requirements,1,have}'), '3');
  perform pg_temp.said('and ECON 2010 did not exist yet: Core theory has 1', pg_temp.jq(a2, '{requirements,0,have}'), '1');
  a3 := pg_temp.ask(reg, format($q$select public.degree_audit_run(%L, 'S100', '2026-05-20', 'reg-asof-key-002')$q$, v2))::uuid;
  perform pg_temp.said('as of 20 May 2026, before the correction, ECON 2010 read B',
    (select c->>'grade' from public.degree_audits d, jsonb_array_elements(d.result->'courses') c where d.id = a3 and c->>'key' = 'ECON 2010 · Spring 2026'), 'B');
  perform pg_temp.said('and a record with nothing in progress has no course doing',
    pg_temp.jq(a3, '{requirements,1,doing}'), '[]');

  -- ── The digest of the inputs ───────────────────────────────────────────────
  -- Rebuilt a different way: for each key the ledger holds, ask the ledger's
  -- own `academic_record_in_effect` for the entry on the date.
  select encode(sha256(convert_to(private.degree_audit_inputs_text(coalesce(jsonb_agg(
           jsonb_build_object('kind', e.kind, 'key', e.subject_key, 'value', e.value, 'effective_on', e.effective_on, 'id', e.id)), '[]'::jsonb)), 'UTF8')), 'hex')
    into want_digest
    from (select distinct kind, subject_key from public.academic_record_entries
           where tenant_id = 'da-u' and student_ref = 'S100' and kind in ('enrollment', 'grade', 'credit', 'transfer_credit')) k,
         lateral private.academic_record_in_effect('da-u', 'S100', k.kind, k.subject_key, date '2026-09-01') e
   where e.action = 'set';
  perform pg_temp.said('the digest is the SHA-256 of the lines in effect that day, found by the ledger''s own function',
    (select inputs_sha256 from public.degree_audits where id = a1), want_digest);
  perform pg_temp.said('and it counts the lines', (select inputs_count::text from public.degree_audits where id = a1), '7');
  perform pg_temp.said('a different date reads different lines and so keeps a different digest',
    (select (a.inputs_sha256 <> b.inputs_sha256)::text from public.degree_audits a, public.degree_audits b where a.id = a1 and b.id = a2), 'true');

  -- ── An audit writes nothing to the ledger ──────────────────────────────────
  select count(*) into ledger_after from public.academic_record_entries;
  perform pg_temp.counted('the ledger has the same entries after six audits', ledger_after, ledger_before);
  perform pg_temp.counted('and no change was proposed by one', (select count(*) from public.academic_record_changes where status = 'proposed'), 0);

  -- ── Idempotent ─────────────────────────────────────────────────────────────
  perform pg_temp.said('the same key again answers the same audit',
    pg_temp.ask(ana, format($q$select public.degree_audit_run(%L, 'S100', '2026-09-01', 'ana-run-key-001')$q$, v2)), a1::text);
  perform pg_temp.counted('and wrote no second audit', (select count(*) from public.degree_audits where operation = 'ana-run-key-001'), 1);
  perform pg_temp.refused_for('the key for another student', ana,
    format($q$select public.degree_audit_run(%L, 'S100', '2026-09-02', 'ana-run-key-001')$q$, v2), 'already used for a different request');
  perform pg_temp.refused_for('the key from somebody else', dean2,
    format($q$select public.degree_audit_run(%L, 'S100', '2026-09-01', 'ana-run-key-001')$q$, v2), 'already used for a different request');
  a4 := pg_temp.ask(ana, format($q$select public.degree_audit_run(%L, 'S100', '2026-09-01', 'ana-run-key-005')$q$, v2))::uuid;
  perform pg_temp.said('a new key is a new audit, of the same record', (a4 <> a1)::text, 'true');
  perform pg_temp.said('with the same answer and the same digest',
    (select (a.result = b.result and a.inputs_sha256 = b.inputs_sha256)::text from public.degree_audits a, public.degree_audits b where a.id = a1 and b.id = a4), 'true');

  -- ── Who reads ──────────────────────────────────────────────────────────────
  perform pg_temp.counted('Ana reads the audits of her own record, whoever ran them: seven', pg_temp.seen(ana, 'select * from public.degree_audits'), 7);
  perform pg_temp.counted('Ben reads the two of his', pg_temp.seen(ben, 'select * from public.degree_audits'), 2);
  perform pg_temp.counted('and neither reads the other''s', pg_temp.seen(ana, 'select * from public.degree_audits where student_ref = ''S200'''), 0);
  perform pg_temp.counted('Cal reads none', pg_temp.seen(cal, 'select * from public.degree_audits'), 0);
  perform pg_temp.counted('faculty read none', pg_temp.seen(prof, 'select * from public.degree_audits'), 0);
  perform pg_temp.counted('the advisor reads every audit at the school', pg_temp.seen(adv, 'select * from public.degree_audits'), 9);
  perform pg_temp.counted('the other school''s registrar reads none', pg_temp.seen(far_reg, 'select * from public.degree_audits'), 0);
  perform pg_temp.counted('a caller reads their own operations only', pg_temp.seen(ana, 'select * from public.degree_audit_operations'), 2);

  -- ── What is kept is kept ───────────────────────────────────────────────────
  perform pg_temp.refused('no client inserts an audit', reg,
    format($q$insert into public.degree_audits (tenant_id, student_ref, program_id, program_code, program_title, catalog_year, program_version, as_of, inputs_sha256, inputs_count, verdict, result, operation)
              values ('da-u', 'S100', %L, 'X', 'X', 2026, 1, '2026-09-01', repeat('0', 64), 0, 'complete', '{}', 'x')$q$, v2));
  perform pg_temp.refused('no client changes one', reg, format($q$update public.degree_audits set verdict = 'complete' where id = %L$q$, a1));
  perform pg_temp.refused('no client deletes one', reg, format($q$delete from public.degree_audits where id = %L$q$, a1));
  perform pg_temp.owner_refused_for('the owner cannot change a verdict', format($q$update public.degree_audits set verdict = 'complete' where id = %L$q$, a1), 'kept as it was run');
  perform pg_temp.owner_refused_for('nor the result', format($q$update public.degree_audits set result = '{}' where id = %L$q$, a1), 'kept as it was run');
  perform pg_temp.owner_refused_for('nor delete one', format($q$delete from public.degree_audits where id = %L$q$, a1), 'kept as it was run');
  perform pg_temp.said('the audit is as it was run', pg_temp.jq(a1, '{verdict}'), 'incomplete');

  -- ── The mode, the kill switch and a frozen module ──────────────────────────
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason) values ('da-u', 'kill.core_modules', true, 'drill');
  perform pg_temp.refused_for('an audit while Core modules are paused', reg,
    format($q$select public.degree_audit_run(%L, 'S100', '2026-09-01', 'reg-pause-key-01')$q$, v2), 'paused');
  perform pg_temp.refused_for('a student''s audit while they are paused', ana,
    format($q$select public.degree_audit_run(%L, 'S100', '2026-09-01', 'ana-pause-key-01')$q$, v2), 'paused');
  perform pg_temp.refused_for('authoring while they are paused', reg,
    $q$select public.degree_program_create('ART-BA', 'Art', 2026, array['A'], null, 'reg-pause-key-02')$q$, 'paused');
  perform pg_temp.counted('what was kept is still readable', pg_temp.seen(ana, 'select * from public.degree_audits'), 7);
  update public.feature_kill_switch set engaged = false where switch_key = 'kill.core_modules';
  perform pg_temp.works('an audit once it is lifted, a control', ana,
    format($q$select public.degree_audit_run(%L, 'S100', '2026-09-01', 'ana-pause-key-02')$q$, v2));
  update public.tenant_module_mode set mode = 'connect', frozen = true where tenant_id = 'da-u' and module = 'degree_audit';
  perform pg_temp.refused_for('an audit in a frozen module', ana,
    format($q$select public.degree_audit_run(%L, 'S100', '2026-09-01', 'ana-frozen-key-1')$q$, v2), 'has not switched');
  perform pg_temp.refused_for('retiring in a frozen module', reg, format($q$select public.degree_program_retire(%L, 'reg-frozen-key-01')$q$, v2), 'has not switched');
  perform pg_temp.counted('and what was kept is still readable', pg_temp.seen(ana, 'select * from public.degree_audits'), 8);
  perform pg_temp.counted('with the program it was run against', pg_temp.seen(ana, format('select * from public.degree_programs where id = %L', v2)), 1);
  update public.tenant_module_mode set mode = 'core', frozen = false where tenant_id = 'da-u' and module = 'degree_audit';

  -- A school in Connect can do none of it.
  insert into public.degree_programs (tenant_id, code, title, catalog_year, version, passing_grades, operation)
  values ('da-conn', 'ECON-BA', 'Connect''s', 2026, 1, array['A','B'], 'fixture') returning id into conn_prog;
  insert into public.degree_requirements (tenant_id, program_id, sort, name, need, need_count, operation)
  values ('da-conn', conn_prog, 1, 'Anything', 'courses', 1, 'fixture');
  update public.degree_programs set state = 'published', published_at = now() where id = conn_prog;
  perform pg_temp.refused_for('a registrar at a Connect school authoring', conn_reg,
    $q$select public.degree_program_create('ART-BA', 'Art', 2026, array['A'], null, 'conn-create-key-1')$q$, 'has not switched');
  perform pg_temp.refused_for('a linked student at a Connect school auditing', conn_stu,
    format($q$select public.degree_audit_run(%L, 'C100', '2026-09-01', 'conn-run-key-0001')$q$, conn_prog), 'has not switched');
  perform pg_temp.counted('though they read the school''s published program', pg_temp.seen(conn_stu, 'select * from public.degree_programs'), 1);

  -- ── Account deletion: the audit stays with the school ──────────────────────
  perform pg_temp.counted('before it, the advisor''s audit names them', (select count(*) from public.degree_audits where requested_by = adv), 1);
  delete from auth.users where id = adv;
  perform pg_temp.counted('deleting the advisor''s account clears who asked', (select count(*) from public.degree_audits where requested_by is null), 1);
  perform pg_temp.counted('and the audit stays', (select count(*) from public.degree_audits where operation = 'adv-run-key-001'), 1);
  delete from auth.users where id = reg;
  perform pg_temp.counted('a registrar''s account goes: the two versions they wrote stay, with no author named',
    (select count(*) from public.degree_programs where created_by is null and code = 'ECON-BA' and tenant_id = 'da-u'), 2);
  perform pg_temp.counted('and the version they retired by publishing the next still says retired',
    (select count(*) from public.degree_programs where state = 'retired' and retired_by is null and code = 'ECON-BA' and tenant_id = 'da-u'), 1);
end $$;

rollback;
