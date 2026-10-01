-- supabase/transcripts.check.sql — who issues a transcript, what it reads, that
-- what is issued is never rewritten, who may check one, and that every release
-- is logged and the log is never edited.
--
-- For 20260930260000_transcripts.sql. One school, tr-u, which has switched
-- `records` to Core: a registrar (who issues), a second registrar who approves
-- ledger changes, a dean (reads only), an academic advisor, a faculty member,
-- and three students, two of whom the school linked to a record (S100, S200)
-- and one not. A second school, tr-conn, stays in Connect; a third, tr-other,
-- is Core with its own registrar. What it proves:
--
--   * the canonical text and the body: every case in
--     app/src/lib/transcripts/fixtures.json is run through
--     `private.transcript_canonical`, `private.transcript_build` and the hash,
--     and must come out exactly as the TypeScript twin computed it (the same
--     file is read by transcripts.test.ts); a control shows the comparison can
--     fail; a body that holds a number, a boolean or a null is refused;
--   * only `transcript:issue` (registrar) issues; a dean, an advisor, a
--     faculty member and a student do not; another school's registrar issues
--     nothing about this school's student;
--   * a transcript reads the ledger as of its date: a void means absent, an
--     entry effective later is not read, a correction counts from its own date,
--     a `requirement` entry is not read; and issuing writes nothing to the
--     academic ledger;
--   * the serial rises by one for each school, a refused issue spends none, and
--     another school has its own;
--   * a corrected record is a new issue that names the one it replaces; the
--     earlier row is untouched and answers superseded;
--   * a transcript, a supersession and a disclosure are never changed or
--     deleted by any role, the owner included, and the hash is held to the text;
--   * every release is one log row naming who released it, to whom, for what;
--     only `transcript:issue` writes one, and only for its own school;
--   * a student reads their own transcripts and the log of their own record and
--     no other; a dean reads all; an advisor and faculty read none;
--   * checking answers valid, superseded or unknown with the school and the
--     issue date and nothing else; it needs an account, counts against it, and
--     is refused to a signed-out caller;
--   * a school in Connect can do none of it, and neither can one whose module
--     is frozen or whose Core modules are paused, though what was written stays
--     readable and checkable.
--
-- The control: each refusal comes after the same call working for the right
-- person, so a refusal is the rule's doing and not a broken fixture.
--
--   How to run it: supabase/check.sh transcripts

-- The fixtures, read from the file the TypeScript test reads. check.sh exports
-- SEMESTER_SUPABASE_DIR; run by hand from the repository root it falls back to
-- ./supabase.
\set fixtures `tr '\n' ' ' < "${SEMESTER_SUPABASE_DIR:-supabase}/../app/src/lib/transcripts/fixtures.json"`

begin;

create temp table fx on commit drop as select :'fixtures'::jsonb as j;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.become_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
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

-- The same, as the owner: what a trigger or a constraint refuses even there.
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

-- The error a statement raises for a signed-out caller, or null when it ran.
create or replace function pg_temp.anon_err(statement text)
returns text language plpgsql as $$
begin
  perform pg_temp.become_anon();
  execute statement;
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlerrm;
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

-- One value out of a kept transcript's body, by path.
create or replace function pg_temp.jq(serial_ bigint, path text[])
returns text language sql as $$
  select body #>> path from public.transcripts where tenant_id = 'tr-u' and serial = serial_;
$$;

-- Post one entry to the ledger the only way it can be: proposed by one
-- person, approved by another.
create or replace function pg_temp.post(prop uuid, decider uuid, student text, kind text, subject text, val text, eff date,
                                       act text default 'set', school text default 'tr-u')
returns void language plpgsql as $$
declare change uuid; e text;
begin
  perform pg_temp.become(prop);
  execute format(
    'insert into public.academic_record_changes (tenant_id, student_ref, kind, subject_key, action, value, effective_on, reason, source)
     values (%L, %L, %L, %L, %L, %L, %L, %L, %L) returning id',
    school, student, kind, subject, act, val, eff, 'Posted for the transcript check.', 'registrar') into change;
  execute 'reset role';
  e := pg_temp.err(decider, format('update public.academic_record_changes set status = ''approved'' where id = %L', change));
  if e is not null then raise exception 'FAILED: posting % % — %', kind, subject, e; end if;
end $$;

-- ── The canonical text, the body and the hash, held to the TypeScript twin ──
do $$
declare c jsonb; got text; want text; n integer := 0; built jsonb; e text;
begin
  if (select jsonb_array_length(j->'canonical') from fx) < 10 or (select jsonb_array_length(j->'transcripts') from fx) < 4 then
    raise exception 'FAILED: the fixtures file was not read (the probe found % and %)',
      (select jsonb_array_length(j->'canonical') from fx), (select jsonb_array_length(j->'transcripts') from fx);
  end if;

  -- Known digests first, so the hash function itself is not what is in doubt.
  perform pg_temp.said('SHA-256 of the empty text', private.transcript_sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  perform pg_temp.said('SHA-256 of "abc"', private.transcript_sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  -- Taken from `printf 'caf\xc3\xa9' | sha256sum`: the digest is of UTF-8 bytes.
  perform pg_temp.said('SHA-256 of "café" is of its UTF-8 bytes', private.transcript_sha256(E'café'),
    '850f7dc43910ff890f8879c0ed26fe697c93a067ad93a7d50f466a7028a9bf4e');

  for c in select jsonb_array_elements(j->'canonical') from fx loop
    got := private.transcript_canonical(c->'value');
    if got is distinct from c->>'text' then
      raise exception 'FAILED: the SQL canonical text and the TypeScript twin disagree on "%": sql % — ts %', c->>'name', got, c->>'text';
    end if;
    if private.transcript_sha256(got) is distinct from c->>'sha256' then
      raise exception 'FAILED: the SHA-256 differs on "%"', c->>'name';
    end if;
    -- The control: the same comparison fails when the text is wrong.
    if got is not distinct from (c->>'text') || ' ' then
      raise exception 'FAILED: the comparison cannot fail on "%"', c->>'name';
    end if;
    n := n + 1;
    raise notice 'ok  canonical: %', c->>'name';
  end loop;
  perform pg_temp.counted('every canonical case was compared', n, (select jsonb_array_length(j->'canonical') from fx));

  n := 0;
  for c in select jsonb_array_elements(j->'refused_canonical') from fx loop
    e := pg_temp.owner_err(format('select private.transcript_canonical(%L::jsonb)', c->'value'));
    if e is null or e not like '%holds only text, lists and objects%' then
      raise exception 'FAILED: "%" was not refused for what it is: %', c->>'name', coalesce(e, 'it was allowed');
    end if;
    n := n + 1;
  end loop;
  perform pg_temp.counted('every body that holds a number, a boolean or a null is refused', n, (select jsonb_array_length(j->'refused_canonical') from fx));

  n := 0;
  for c in select jsonb_array_elements(j->'transcripts') from fx loop
    built := private.transcript_build(c->'head', c->'lines');
    if built is distinct from c->'expected'->'body' then
      raise exception 'FAILED: the SQL body and the TypeScript twin disagree on "%": sql % — ts %', c->>'name', built, c->'expected'->'body';
    end if;
    got := private.transcript_canonical(built);
    if got is distinct from c->'expected'->>'text' then
      raise exception 'FAILED: the canonical text of the body differs on "%": sql % — ts %', c->>'name', got, c->'expected'->>'text';
    end if;
    if private.transcript_sha256(got) is distinct from c->'expected'->>'sha256' then
      raise exception 'FAILED: the hash of the body differs on "%"', c->>'name';
    end if;
    if built is not distinct from jsonb_set(c->'expected'->'body', '{serial}', '"not a serial"') then
      raise exception 'FAILED: the body comparison cannot fail on "%"', c->>'name';
    end if;
    n := n + 1;
    raise notice 'ok  body: %', c->>'name';
  end loop;
  perform pg_temp.counted('every transcript case was compared', n, (select jsonb_array_length(j->'transcripts') from fx));

  n := 0;
  for c in select jsonb_array_elements(j->'refused_transcripts') from fx loop
    e := pg_temp.owner_err(format('select private.transcript_build(%L::jsonb, %L::jsonb)', c->'head', c->'lines'));
    if e is null or e not like '%one ledger line for each kind and key%' then
      raise exception 'FAILED: "%" was not refused for what it is: %', c->>'name', coalesce(e, 'it was allowed');
    end if;
    n := n + 1;
  end loop;
  perform pg_temp.counted('two lines for one key are refused', n, (select jsonb_array_length(j->'refused_transcripts') from fx));
end $$;

do $$
declare
  reg uuid; reg2 uuid; reg3 uuid; dean2 uuid; adv uuid; prof uuid; ana uuid; ben uuid; cal uuid; zed uuid;
  far_reg uuid; far_prof uuid; conn_reg uuid; conn_stu uuid;
  t1 uuid; t2 uuid; t3 uuid; t4 uuid; t5 uuid; t6 uuid; t7 uuid; t8 uuid; far_t uuid; reg3_t uuid; d1 uuid; d2 uuid; d3 uuid;
  entries_before bigint; changes_before bigint; n bigint; e text; h1 text; h2 text; h3 text; h4 text; far_h text;
  before_row jsonb; r jsonb;
  today constant date := current_date;
  future constant date := current_date + 10;
begin
  insert into public.schools (id, name, email_domains) values
    ('tr-u',     'Transcript University', array['tr-u.example']),
    ('tr-conn',  'Connect College',       array['tr-conn.example']),
    ('tr-other', 'Other University',      array['tr-other.example']);

  reg       := pg_temp.newuser('reg@tr-u.example', 'tr-u');
  reg2      := pg_temp.newuser('reg2@tr-u.example', 'tr-u');
  reg3      := pg_temp.newuser('reg3@tr-u.example', 'tr-u');
  dean2     := pg_temp.newuser('dean@tr-u.example', 'tr-u');
  adv       := pg_temp.newuser('adv@tr-u.example', 'tr-u');
  prof      := pg_temp.newuser('prof@tr-u.example', 'tr-u');
  ana       := pg_temp.newuser('ana@tr-u.example', 'tr-u');
  ben       := pg_temp.newuser('ben@tr-u.example', 'tr-u');
  cal       := pg_temp.newuser('cal@tr-u.example', 'tr-u');
  zed       := pg_temp.newuser('zed@tr-u.example', 'tr-u');
  far_reg   := pg_temp.newuser('reg@tr-other.example', 'tr-other');
  far_prof  := pg_temp.newuser('prof@tr-other.example', 'tr-other');
  conn_reg  := pg_temp.newuser('reg@tr-conn.example', 'tr-conn');
  conn_stu  := pg_temp.newuser('stu@tr-conn.example', 'tr-conn');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (reg,      'registrar',        'school', 'tr-u',     'institution'),
    (reg2,     'registrar',        'school', 'tr-u',     'institution'),
    (reg3,     'registrar',        'school', 'tr-u',     'institution'),
    (dean2,    'dean',             'school', 'tr-u',     'institution'),
    (adv,      'academic_advisor', 'school', 'tr-u',     'institution'),
    (prof,     'faculty',          'school', 'tr-u',     'institution'),
    (ana,      'student',          'school', 'tr-u',     'institution'),
    (ben,      'student',          'school', 'tr-u',     'institution'),
    (cal,      'student',          'school', 'tr-u',     'institution'),
    (zed,      'student',          'school', 'tr-u',     'institution'),
    (far_reg,  'registrar',        'school', 'tr-other', 'institution'),
    (far_prof, 'faculty',          'school', 'tr-other', 'institution'),
    (conn_reg, 'registrar',        'school', 'tr-conn',  'institution'),
    (conn_stu, 'student',          'school', 'tr-conn',  'institution');

  -- The school links an account to a record: Ana is S100, Ben is S200, Cal is nobody.
  insert into public.academic_record_subjects (tenant_id, student_ref, user_id) values
    ('tr-u', 'S100', ana), ('tr-u', 'S200', ben), ('tr-conn', 'C100', conn_stu);

  -- ── Who holds what ─────────────────────────────────────────────────────────
  perform pg_temp.counted('the registrar holds transcript:issue', (select count(*) from public.role_capabilities where role = 'registrar' and capability = 'transcript:issue'), 1);
  perform pg_temp.counted('and nobody else does', (select count(*) from public.role_capabilities where capability = 'transcript:issue'), 1);
  perform pg_temp.counted('the registrar and the dean hold transcript:read, and nobody else',
    (select count(*) from public.role_capabilities where capability = 'transcript:read' and role in ('registrar', 'dean')), 2);
  perform pg_temp.counted('transcript:read has just those two holders', (select count(*) from public.role_capabilities where capability = 'transcript:read'), 2);

  -- ── The ledger the transcripts read ────────────────────────────────────────
  -- Proposed by faculty, decided by a second registrar; a correction to a
  -- grade or a standing is a registrar override, which that registrar holds.
  perform pg_temp.post(prof, reg2, 'S100', 'enrollment',      'ECON 1010 · Fall 2025',     'Enrolled',        date '2025-09-01');
  perform pg_temp.post(prof, reg2, 'S100', 'grade',           'ECON 1010 · Fall 2025',     'B',               date '2025-12-15');
  perform pg_temp.post(prof, reg2, 'S100', 'credit',          'ECON 1010 · Fall 2025',     '3',               date '2025-12-15');
  perform pg_temp.post(prof, reg2, 'S100', 'standing',        'Academic standing',         'Probation',       date '2025-10-01');
  perform pg_temp.post(prof, reg2, 'S100', 'transfer_credit', 'MATH 101 · Other College',  '3',               date '2025-08-01');
  perform pg_temp.post(prof, reg2, 'S100', 'requirement',     'Gen ed',                    'waived',          date '2025-09-01');
  perform pg_temp.post(prof, reg2, 'S100', 'enrollment',      'HIST 1000 · Spring 2026',   'Enrolled',        date '2026-01-15');
  -- A correction to the grade, from its own date, and a void of the standing.
  perform pg_temp.post(prof, reg2, 'S100', 'grade',           'ECON 1010 · Fall 2025',     'A-',              date '2026-01-20');
  perform pg_temp.post(prof, reg2, 'S100', 'standing',        'Academic standing',         '',                date '2026-01-01', 'void');
  -- Effective in the future: not in effect on any date a transcript can be as of.
  perform pg_temp.post(prof, reg2, 'S100', 'conferral',       'B.A. Economics',            'Conferred',       future);
  perform pg_temp.post(prof, reg2, 'S200', 'enrollment',      'MATH 1000 · Fall 2025',     'Enrolled',        date '2025-09-01');
  perform pg_temp.post(prof, reg2, 'S200', 'grade',           'MATH 1000 · Fall 2025',     'A',               date '2025-12-15');

  select count(*) into entries_before from public.academic_record_entries;
  select count(*) into changes_before from public.academic_record_changes;

  -- ── The mode: Core at tr-u and tr-other, Connect at tr-conn ────────────────
  -- A control first: until the module is Core, the registrar is refused for the
  -- mode and for nothing else.
  perform pg_temp.refused_for('a registrar in a school still in Connect', reg,
    $q$select public.transcript_issue('S100', '2025-12-31', null, null, 'early-issue-01')$q$,
    'has not switched records and transcripts to Semester Core');
  insert into public.tenant_module_mode (tenant_id, module, mode, reason) values
    ('tr-u', 'records', 'core', 'the check suite'),
    ('tr-other', 'records', 'core', 'the check suite');

  -- ── Issuing ────────────────────────────────────────────────────────────────
  t1 := pg_temp.ask(reg, $q$select public.transcript_issue('S100', '2025-12-31', null, null, 'issue-s100-key-01')$q$)::uuid;
  perform pg_temp.counted('the registrar issues a transcript, serial 1', (select serial from public.transcripts where id = t1), 1);
  perform pg_temp.said('it names who issued it', (select issued_by::text from public.transcripts where id = t1), reg::text);
  perform pg_temp.said('and the date it is as of', (select as_of::text from public.transcripts where id = t1), '2025-12-31');
  perform pg_temp.said('the same key again answers the same id',
    pg_temp.ask(reg, $q$select public.transcript_issue('S100', '2025-12-31', null, null, 'issue-s100-key-01')$q$), t1::text);
  perform pg_temp.counted('and wrote one transcript', (select count(*) from public.transcripts), 1);
  perform pg_temp.refused_for('the same key for a different request', reg,
    $q$select public.transcript_issue('S200', '2025-12-31', null, null, 'issue-s100-key-01')$q$, 'already used for a different request');
  perform pg_temp.refused_for('the same key from somebody else', reg2,
    $q$select public.transcript_issue('S100', '2025-12-31', null, null, 'issue-s100-key-01')$q$, 'already used for a different request');
  perform pg_temp.refused('a key that is too short', reg, $q$select public.transcript_issue('S100', '2025-12-31', null, null, 'short')$q$);

  -- What it read, as of 31 December 2025.
  perform pg_temp.said('the body names the school', pg_temp.jq(1, '{school,name}'), 'Transcript University');
  perform pg_temp.said('and the student reference', pg_temp.jq(1, '{student_ref}'), 'S100');
  perform pg_temp.said('and the serial, as text', pg_temp.jq(1, '{serial}'), '1');
  perform pg_temp.said('and the date it is as of', pg_temp.jq(1, '{as_of}'), '2025-12-31');
  perform pg_temp.said('it says it is not signed', left(pg_temp.jq(1, '{notice}'), 24), 'This text is not signed.');
  perform pg_temp.said('the course is under its term', pg_temp.jq(1, '{terms,0,term}'), 'Fall 2025');
  perform pg_temp.said('with the course as the ledger names it', pg_temp.jq(1, '{terms,0,courses,0,course}'), 'ECON 1010');
  perform pg_temp.said('the grade in effect on that date, before the correction', pg_temp.jq(1, '{terms,0,courses,0,grade}'), 'B');
  perform pg_temp.said('its credit as the ledger holds it', pg_temp.jq(1, '{terms,0,courses,0,credit}'), '3');
  perform pg_temp.said('and its enrolment', pg_temp.jq(1, '{terms,0,courses,0,enrollment}'), 'Enrolled');
  perform pg_temp.counted('one term only: the spring course is effective later', jsonb_array_length((select body->'terms' from public.transcripts where id = t1)), 1);
  perform pg_temp.said('the standing then in effect', pg_temp.jq(1, '{standing,0,value}'), 'Probation');
  perform pg_temp.said('the transfer credit', pg_temp.jq(1, '{transfer_credit,0,key}'), 'MATH 101 · Other College');
  perform pg_temp.counted('no conferral yet', jsonb_array_length((select body->'conferrals' from public.transcripts where id = t1)), 0);
  perform pg_temp.counted('a requirement entry is not read', (select count(*) from public.transcripts where id = t1 and body_text like '%Gen ed%'), 0);

  t2 := pg_temp.ask(reg, format($q$select public.transcript_issue('S100', %L, null, null, 'issue-s100-key-02')$q$, today))::uuid;
  perform pg_temp.counted('a second, as of today, is serial 2', (select serial from public.transcripts where id = t2), 2);
  perform pg_temp.said('the correction counts from its own date', pg_temp.jq(2, '{terms,0,courses,0,grade}'), 'A-');
  perform pg_temp.counted('a void means the standing is absent', jsonb_array_length((select body->'standing' from public.transcripts where id = t2)), 0);
  perform pg_temp.counted('the spring course is there now', jsonb_array_length((select body->'terms' from public.transcripts where id = t2)), 2);
  perform pg_temp.counted('an entry effective in the future is not read', jsonb_array_length((select body->'conferrals' from public.transcripts where id = t2)), 0);
  perform pg_temp.counted('the earlier transcript is as it was', (select count(*) from public.transcripts where id = t1 and body #>> '{terms,0,courses,0,grade}' = 'B'), 1);

  t3 := pg_temp.ask(reg, format($q$select public.transcript_issue('S200', %L, null, null, 'issue-s200-key-01')$q$, today))::uuid;
  perform pg_temp.counted('a third, for another student, is serial 3', (select serial from public.transcripts where id = t3), 3);

  -- The hash and the text.
  perform pg_temp.counted('every hash is the SHA-256 of its text', (select count(*) from public.transcripts where body_sha256 = encode(sha256(convert_to(body_text, 'UTF8')), 'hex')), 3);
  perform pg_temp.counted('and every text is the canonical text of its body',
    (select count(*) from public.transcripts where body_text = private.transcript_canonical(body)), 3);
  perform pg_temp.counted('and the SQL builder, run on the ledger lines again, gives the same body',
    (select count(*) from public.transcripts where id = t1 and body = private.transcript_build(
       jsonb_build_object('serial', serial::text, 'school_id', tenant_id, 'school_name', 'Transcript University', 'student_ref', student_ref, 'as_of', as_of::text),
       (select jsonb_agg(jsonb_build_object('kind', l.kind, 'key', l.subject_key, 'value', l.value, 'effective_on', l.effective_on::text))
          from (select distinct on (e.kind, e.subject_key) e.* from public.academic_record_entries e
                 where e.tenant_id = 'tr-u' and e.student_ref = 'S100' and e.effective_on <= date '2025-12-31'
                   and e.kind in ('enrollment', 'grade', 'credit', 'transfer_credit', 'standing', 'conferral')
                 order by e.kind, e.subject_key, e.effective_on desc, e.recorded_at desc, e.id desc) l where l.action = 'set'))), 1);

  -- Nothing is written to the academic ledger.
  perform pg_temp.counted('issuing wrote nothing to the ledger', (select count(*) from public.academic_record_entries), entries_before);
  perform pg_temp.counted('and proposed no change to it', (select count(*) from public.academic_record_changes), changes_before);

  -- The serial and refusals.
  perform pg_temp.refused_for('a date later than tomorrow', reg,
    format($q$select public.transcript_issue('S100', %L, null, null, 'issue-future-key1')$q$, today + 5), 'never a later one');
  perform pg_temp.refused_for('a date before there were dates', reg,
    $q$select public.transcript_issue('S100', '1800-01-01', null, null, 'issue-ancient-ke1')$q$, 'not a date');
  perform pg_temp.refused_for('a student reference that is not one', reg,
    format($q$select public.transcript_issue('S 100; --', %L, null, null, 'issue-badref-key1')$q$, today), 'not a student reference');
  perform pg_temp.refused_for('a student with nothing on the record', reg,
    format($q$select public.transcript_issue('S999', %L, null, null, 'issue-nobody-key1')$q$, today), 'nothing on that student');
  perform pg_temp.refused_for('a date before anything was on the record', reg,
    $q$select public.transcript_issue('S100', '2020-01-01', null, null, 'issue-early-date1')$q$, 'nothing on that student');
  t4 := pg_temp.ask(reg, format($q$select public.transcript_issue('S200', %L, null, null, 'issue-s200-key-02')$q$, today))::uuid;
  perform pg_temp.counted('refused issues spent no serial: the next is 4', (select serial from public.transcripts where id = t4), 4);

  -- ── Who issues ─────────────────────────────────────────────────────────────
  perform pg_temp.refused_for('a dean, who reads and does not issue', dean2,
    format($q$select public.transcript_issue('S100', %L, null, null, 'dean-issue-key-01')$q$, today), 'transcript:issue');
  perform pg_temp.refused_for('an academic advisor', adv,
    format($q$select public.transcript_issue('S100', %L, null, null, 'adv-issue-key-001')$q$, today), 'transcript:issue');
  perform pg_temp.refused_for('faculty', prof,
    format($q$select public.transcript_issue('S100', %L, null, null, 'prof-issue-key-01')$q$, today), 'transcript:issue');
  perform pg_temp.refused_for('a student, for their own record', ana,
    format($q$select public.transcript_issue('S100', %L, null, null, 'ana-issue-key-001')$q$, today), 'transcript:issue');
  perform pg_temp.refused_for('a registrar at another school, for this school''s student', far_reg,
    format($q$select public.transcript_issue('S100', %L, null, null, 'far-issue-key-001')$q$, today), 'nothing on that student');
  perform pg_temp.works('the second registrar, who also holds it, a control', reg2,
    format($q$select public.transcript_issue('S100', %L, null, null, 'reg2-issue-key-01')$q$, '2026-01-10'::date));
  -- That one is serial 5. Another school's serials are its own.
  perform pg_temp.counted('the second registrar''s issue is serial 5', (select serial from public.transcripts where issued_by = reg2), 5);
  select id into t5 from public.transcripts where issued_by = reg2;

  -- ── Another school's serials are its own ───────────────────────────────────
  perform pg_temp.post(far_prof, far_reg, 'F1', 'grade', 'ART 1 · Fall 2025', 'A', date '2025-12-15', 'set', 'tr-other');
  far_t := pg_temp.ask(far_reg, format($q$select public.transcript_issue('F1', %L, null, null, 'far-issue-key-002')$q$, today))::uuid;
  perform pg_temp.counted('another school''s first transcript is its serial 1', (select serial from public.transcripts where id = far_t), 1);

  -- ── A corrected record is a new issue ──────────────────────────────────────
  -- The credit for the spring course is posted after serial 2 was issued.
  perform pg_temp.post(prof, reg2, 'S100', 'credit', 'HIST 1000 · Spring 2026', '3', date '2026-01-15');
  select to_jsonb(t) into before_row from public.transcripts t where t.id = t2;
  perform pg_temp.refused_for('a replacement with no reason', reg,
    format($q$select public.transcript_issue('S100', %L, 2, null, 'replace-noreason-1')$q$, today), 'serial and a reason');
  perform pg_temp.refused_for('a reason with nothing to replace', reg,
    format($q$select public.transcript_issue('S100', %L, null, 'The record was corrected.', 'replace-noserial-1')$q$, today), 'serial and a reason');
  perform pg_temp.refused_for('replacing a serial that does not exist', reg,
    format($q$select public.transcript_issue('S100', %L, 99, 'The record was corrected.', 'replace-noexist-01')$q$, today), 'no transcript with that serial');
  perform pg_temp.refused_for('replacing another student''s transcript', reg,
    format($q$select public.transcript_issue('S100', %L, 3, 'The record was corrected.', 'replace-other-stu1')$q$, today), 'same student reference');
  perform pg_temp.refused_for('replacing another school''s transcript, by serial', far_reg,
    format($q$select public.transcript_issue('F1', %L, 2, 'The record was corrected.', 'replace-otherschl1')$q$, today), 'no transcript with that serial');
  perform pg_temp.refused_for('a dean replacing', dean2,
    format($q$select public.transcript_issue('S100', %L, 2, 'The record was corrected.', 'dean-replace-key1')$q$, today), 'transcript:issue');
  perform pg_temp.counted('none of those spent a serial or wrote a supersession', (select count(*) from public.transcript_supersessions), 0);
  perform pg_temp.counted('nor a transcript', (select count(*) from public.transcripts where tenant_id = 'tr-u'), 5);
  t6 := pg_temp.ask(reg, format($q$select public.transcript_issue('S100', %L, 2, '  The record was corrected.  ', 'replace-two-key-01')$q$, today))::uuid;
  perform pg_temp.counted('the registrar replaces serial 2: serial 6', (select serial from public.transcripts where id = t6), 6);
  perform pg_temp.said('the new one carries the credit', (select body #>> '{terms,1,courses,0,credit}' from public.transcripts where id = t6), '3');
  perform pg_temp.counted('one supersession was written', (select count(*) from public.transcript_supersessions), 1);
  perform pg_temp.said('naming the earlier, the trimmed reason and who', (select s.transcript_id::text || '|' || s.reason || '|' || s.recorded_by::text from public.transcript_supersessions s),
    t2::text || '|The record was corrected.|' || reg::text);
  perform pg_temp.said('the earlier transcript is exactly as it was', (select (to_jsonb(t) = before_row)::text from public.transcripts t where t.id = t2), 'true');
  perform pg_temp.refused_for('replacing it twice', reg,
    format($q$select public.transcript_issue('S100', %L, 2, 'Again.', 'replace-twice-key1')$q$, today), 'already been replaced');
  t7 := pg_temp.ask(reg, format($q$select public.transcript_issue('S100', %L, null, null, 'issue-s100-key-07')$q$, today))::uuid;
  perform pg_temp.counted('refused replacements spent no serial: the next is 7', (select serial from public.transcripts where id = t7), 7);

  -- ── What is kept is kept ───────────────────────────────────────────────────
  perform pg_temp.refused('no client inserts a transcript', reg,
    $q$insert into public.transcripts (tenant_id, serial, student_ref, as_of, body, body_text, body_sha256, operation) values ('tr-u', 99, 'S100', '2026-01-01', '{}', '{}', repeat('0', 64), 'x')$q$);
  perform pg_temp.refused('no client changes one', reg, format($q$update public.transcripts set student_ref = 'S200' where id = %L$q$, t1));
  perform pg_temp.refused('no client deletes one', reg, format($q$delete from public.transcripts where id = %L$q$, t1));
  perform pg_temp.refused('no client writes a supersession', reg, $q$delete from public.transcript_supersessions$q$);
  perform pg_temp.refused('no client writes an operation', reg, $q$delete from public.transcript_operations$q$);
  perform pg_temp.owner_refused_for('the owner cannot change a transcript''s text', format($q$update public.transcripts set body_text = '{}', body = '{}' where id = %L$q$, t1), 'kept as it was written');
  perform pg_temp.owner_refused_for('nor its hash', format($q$update public.transcripts set body_sha256 = repeat('a', 64) where id = %L$q$, t1), 'kept as it was written');
  perform pg_temp.owner_refused_for('nor its serial', format($q$update public.transcripts set serial = 77 where id = %L$q$, t1), 'kept as it was written');
  perform pg_temp.owner_refused_for('nor who issued it, to another person', format($q$update public.transcripts set issued_by = %L where id = %L$q$, reg2, t1), 'kept as it was written');
  perform pg_temp.owner_refused_for('nor delete it', format($q$delete from public.transcripts where id = %L$q$, t1), 'kept as it was written');
  perform pg_temp.owner_refused_for('nor change a supersession', $q$update public.transcript_supersessions set reason = 'Edited.'$q$, 'kept as it was written');
  perform pg_temp.owner_refused_for('nor delete one', $q$delete from public.transcript_supersessions$q$, 'kept as it was written');
  -- The constraints hold the hash to the text and the text to the body, even for the owner.
  perform pg_temp.owner_refused_for('a hash that is not of the text', $q$insert into public.transcripts (tenant_id, serial, student_ref, as_of, body, body_text, body_sha256, operation)
      values ('tr-u', 98, 'S100', '2026-01-01', '{"a":"b"}', '{"a":"b"}', repeat('0', 64), 'x')$q$, 'transcripts_hash_is_of_text');
  perform pg_temp.owner_refused_for('a text that is not the body', $q$insert into public.transcripts (tenant_id, serial, student_ref, as_of, body, body_text, body_sha256, operation)
      values ('tr-u', 98, 'S100', '2026-01-01', '{"a":"b"}', '{"a":"c"}', private.transcript_sha256('{"a":"c"}'), 'x')$q$, 'transcripts_text_is_body');
  perform pg_temp.owner_refused_for('a serial used twice at one school', $q$insert into public.transcripts (tenant_id, serial, student_ref, as_of, body, body_text, body_sha256, operation)
      values ('tr-u', 1, 'S100', '2026-01-01', '{"a":"b"}', '{"a":"b"}', private.transcript_sha256('{"a":"b"}'), 'x')$q$, 'duplicate key value violates unique constraint');

  -- ── The log of every release ───────────────────────────────────────────────
  d1 := pg_temp.ask(reg, $q$select public.transcript_disclose(1, ' Ana Student ', 'the student', 'The student''s own copy.', 'disclose-key-0001')$q$)::uuid;
  perform pg_temp.said('a release to the student is one log row',
    (select recipient_name || '|' || recipient_kind || '|' || purpose || '|' || transcript_serial || '|' || student_ref || '|' || released_by::text
       from public.transcript_disclosures where id = d1),
    'Ana Student|the student|The student''s own copy.|1|S100|' || reg::text);
  perform pg_temp.counted('with the time it was recorded', (select count(*) from public.transcript_disclosures where id = d1 and released_at > now() - interval '1 minute'), 1);
  perform pg_temp.said('the same key again answers the same id',
    pg_temp.ask(reg, $q$select public.transcript_disclose(1, ' Ana Student ', 'the student', 'The student''s own copy.', 'disclose-key-0001')$q$), d1::text);
  perform pg_temp.counted('and wrote one row', (select count(*) from public.transcript_disclosures), 1);
  perform pg_temp.refused_for('the same key for another release', reg,
    $q$select public.transcript_disclose(1, 'Somebody Else', 'employer', 'A job.', 'disclose-key-0001')$q$, 'already used for a different request');
  d2 := pg_temp.ask(reg, $q$select public.transcript_disclose(2, 'Northern State University, Admissions', 'another school', 'Application for transfer admission.', 'disclose-key-0002')$q$)::uuid;
  perform pg_temp.works('a release of a transcript that has since been replaced is logged as it happened', reg,
    $q$select public.transcript_disclose(2, 'Registrar of Records', 'another office', 'Kept for a file.', 'disclose-key-0003')$q$);
  d3 := pg_temp.ask(reg, $q$select public.transcript_disclose(3, 'Ben Student', 'the student', 'The student''s own copy.', 'disclose-key-0004')$q$)::uuid;
  perform pg_temp.counted('four releases are logged', (select count(*) from public.transcript_disclosures), 4);
  perform pg_temp.refused('a release with nobody to release it to', reg,
    $q$select public.transcript_disclose(1, '   ', 'employer', 'A job.', 'disclose-key-0005')$q$);
  perform pg_temp.refused('a release with no kind', reg,
    $q$select public.transcript_disclose(1, 'Acme', '', 'A job.', 'disclose-key-0006')$q$);
  perform pg_temp.refused('a release with no purpose', reg,
    $q$select public.transcript_disclose(1, 'Acme', 'employer', '', 'disclose-key-0007')$q$);
  perform pg_temp.refused('a purpose past 500 characters', reg,
    format($q$select public.transcript_disclose(1, 'Acme', 'employer', %L, 'disclose-key-0008')$q$, repeat('x', 501)));
  perform pg_temp.refused_for('a transcript that does not exist', reg,
    $q$select public.transcript_disclose(99, 'Acme', 'employer', 'A job.', 'disclose-key-0009')$q$, 'no transcript with that serial');
  perform pg_temp.refused_for('a registrar at another school logging a release of this school''s transcript', far_reg,
    $q$select public.transcript_disclose(2, 'Acme', 'employer', 'A job.', 'disclose-key-0010')$q$, 'no transcript with that serial');
  perform pg_temp.refused_for('a dean logging a release', dean2,
    $q$select public.transcript_disclose(1, 'Acme', 'employer', 'A job.', 'disclose-key-0011')$q$, 'transcript:issue');
  perform pg_temp.refused_for('an advisor', adv, $q$select public.transcript_disclose(1, 'Acme', 'employer', 'A job.', 'disclose-key-0012')$q$, 'transcript:issue');
  perform pg_temp.refused_for('a student logging their own release', ana, $q$select public.transcript_disclose(1, 'Acme', 'employer', 'A job.', 'disclose-key-0013')$q$, 'transcript:issue');
  perform pg_temp.counted('none of those wrote a row', (select count(*) from public.transcript_disclosures), 4);
  perform pg_temp.refused('no client inserts a log row', reg,
    $q$insert into public.transcript_disclosures (tenant_id, transcript_serial, student_ref, recipient_name, recipient_kind, purpose, operation) values ('tr-u', 1, 'S100', 'a', 'b', 'c', 'x')$q$);
  perform pg_temp.refused('no client changes one', reg, format($q$update public.transcript_disclosures set purpose = 'Edited.' where id = %L$q$, d1));
  perform pg_temp.refused('no client deletes one', reg, format($q$delete from public.transcript_disclosures where id = %L$q$, d1));
  perform pg_temp.owner_refused_for('the owner cannot change what a release was for', format($q$update public.transcript_disclosures set purpose = 'Edited.' where id = %L$q$, d1), 'kept as it was written');
  perform pg_temp.owner_refused_for('nor to whom', format($q$update public.transcript_disclosures set recipient_name = 'Somebody Else' where id = %L$q$, d1), 'kept as it was written');
  perform pg_temp.owner_refused_for('nor which transcript', format($q$update public.transcript_disclosures set transcript_serial = 2 where id = %L$q$, d1), 'kept as it was written');
  perform pg_temp.owner_refused_for('nor when', format($q$update public.transcript_disclosures set released_at = now() - interval '9 years' where id = %L$q$, d1), 'kept as it was written');
  perform pg_temp.owner_refused_for('nor delete one', format($q$delete from public.transcript_disclosures where id = %L$q$, d1), 'kept as it was written');
  perform pg_temp.owner_refused_for('nor delete them all', $q$delete from public.transcript_disclosures$q$, 'kept as it was written');
  perform pg_temp.owner_refused_for('a release that names a student the transcript is not for', $q$insert into public.transcript_disclosures
      (tenant_id, transcript_serial, student_ref, recipient_name, recipient_kind, purpose, operation) values ('tr-u', 1, 'S200', 'a', 'b', 'c', 'x')$q$, 'violates foreign key constraint');

  -- ── Who reads ──────────────────────────────────────────────────────────────
  perform pg_temp.counted('Ana reads her own transcripts: 1, 2, 5, 6 and 7', pg_temp.seen(ana, 'select * from public.transcripts'), 5);
  perform pg_temp.counted('and none of Ben''s', pg_temp.seen(ana, $q$select * from public.transcripts where student_ref = 'S200'$q$), 0);
  perform pg_temp.counted('Ben reads his own: 3 and 4', pg_temp.seen(ben, 'select * from public.transcripts'), 2);
  perform pg_temp.counted('Ben reads none of Ana''s', pg_temp.seen(ben, $q$select * from public.transcripts where student_ref = 'S100'$q$), 0);
  perform pg_temp.counted('Cal, whom the school did not link, reads none', pg_temp.seen(cal, 'select * from public.transcripts'), 0);
  perform pg_temp.counted('Ana reads the log of her own record: three releases', pg_temp.seen(ana, 'select * from public.transcript_disclosures'), 3);
  perform pg_temp.counted('and none of the releases of Ben''s', pg_temp.seen(ana, $q$select * from public.transcript_disclosures where student_ref = 'S200'$q$), 0);
  perform pg_temp.counted('Ben reads his own: one', pg_temp.seen(ben, 'select * from public.transcript_disclosures'), 1);
  perform pg_temp.counted('Cal reads no log', pg_temp.seen(cal, 'select * from public.transcript_disclosures'), 0);
  perform pg_temp.counted('Ana reads the supersession of her own transcript', pg_temp.seen(ana, 'select * from public.transcript_supersessions'), 1);
  perform pg_temp.counted('Ben reads none', pg_temp.seen(ben, 'select * from public.transcript_supersessions'), 0);
  perform pg_temp.counted('the registrar reads every transcript at the school', pg_temp.seen(reg, 'select * from public.transcripts'), 7);
  perform pg_temp.counted('the dean reads them too, and the whole log', pg_temp.seen(dean2, 'select * from public.transcripts'), 7);
  perform pg_temp.counted('the dean reads the log', pg_temp.seen(dean2, 'select * from public.transcript_disclosures'), 4);
  perform pg_temp.counted('an academic advisor reads none', pg_temp.seen(adv, 'select * from public.transcripts'), 0);
  perform pg_temp.counted('nor the log', pg_temp.seen(adv, 'select * from public.transcript_disclosures'), 0);
  perform pg_temp.counted('faculty read none', pg_temp.seen(prof, 'select * from public.transcripts'), 0);
  perform pg_temp.counted('another school''s registrar reads only their own', pg_temp.seen(far_reg, 'select * from public.transcripts'), 1);
  perform pg_temp.counted('and none of this school''s log', pg_temp.seen(far_reg, 'select * from public.transcript_disclosures'), 0);
  perform pg_temp.counted('a student at a Connect school reads none', pg_temp.seen(conn_stu, 'select * from public.transcripts'), 0);
  perform pg_temp.counted('a caller reads their own operations only', pg_temp.seen(reg, 'select * from public.transcript_operations'),
    (select count(*) from public.transcript_operations where actor = reg));
  perform pg_temp.counted('and that is more than none', (select count(*) from public.transcript_operations where actor = reg), 10);
  perform pg_temp.counted('Ana reads no operations', pg_temp.seen(ana, 'select * from public.transcript_operations'), 0);

  -- ── Checking ───────────────────────────────────────────────────────────────
  select body_sha256 into h1 from public.transcripts where tenant_id = 'tr-u' and serial = 1;
  select body_sha256 into h2 from public.transcripts where tenant_id = 'tr-u' and serial = 2;
  select body_sha256 into h4 from public.transcripts where tenant_id = 'tr-u' and serial = 6;
  select body_sha256 into far_h from public.transcripts where id = far_t;
  select count(*) into entries_before from public.academic_record_entries;
  select count(*) into n from public.transcripts;

  perform pg_temp.said('Ana checks a transcript she holds: valid, the school and the day it was issued',
    pg_temp.ask(ana, format($q$select status || '|' || school_id || '|' || school_name || '|' || issued_on from public.transcript_verify(1, %L)$q$, h1)),
    'valid|tr-u|Transcript University|' || (now() at time zone 'UTC')::date);
  perform pg_temp.said('an upper-case hash with spaces round it is the same hash',
    pg_temp.ask(ana, format($q$select status from public.transcript_verify(1, %L)$q$, ' ' || upper(h1) || ' ')), 'valid');
  perform pg_temp.said('a transcript that has been replaced is superseded, not unknown',
    pg_temp.ask(ana, format($q$select status from public.transcript_verify(2, %L)$q$, h2)), 'superseded');
  perform pg_temp.said('and the one that replaced it is valid',
    pg_temp.ask(ana, format($q$select status from public.transcript_verify(6, %L)$q$, h4)), 'valid');
  perform pg_temp.said('the right hash with the wrong serial is unknown, and says nothing else',
    pg_temp.ask(ana, format($q$select status || '|' || coalesce(school_id, '') || '|' || coalesce(school_name, '') || '|' || coalesce(issued_on::text, '') from public.transcript_verify(2, %L)$q$, h1)), 'unknown|||');
  perform pg_temp.said('the right serial with the wrong hash is unknown',
    pg_temp.ask(ana, $q$select status from public.transcript_verify(1, repeat('0', 64))$q$), 'unknown');
  perform pg_temp.said('a hash that is not one is unknown too, not an error',
    pg_temp.ask(ana, $q$select status from public.transcript_verify(1, 'not a hash')$q$), 'unknown');
  perform pg_temp.said('a serial that was never issued is unknown',
    pg_temp.ask(ana, format($q$select status from public.transcript_verify(9999, %L)$q$, h1)), 'unknown');
  perform pg_temp.said('no serial at all is unknown',
    pg_temp.ask(ana, format($q$select status from public.transcript_verify(null, %L)$q$, h1)), 'unknown');
  perform pg_temp.said('no hash at all is unknown',
    pg_temp.ask(ana, $q$select status from public.transcript_verify(1, null)$q$), 'unknown');
  perform pg_temp.said('a student at another school can check it: the hash is what is held',
    pg_temp.ask(conn_stu, format($q$select status from public.transcript_verify(1, %L)$q$, h1)), 'valid');
  perform pg_temp.said('another school''s first transcript is checked by its own serial and hash',
    pg_temp.ask(ana, format($q$select status || '|' || school_id || '|' || school_name from public.transcript_verify(1, %L)$q$, far_h)), 'valid|tr-other|Other University');
  perform pg_temp.said('and the same serial with this school''s hash is this school''s',
    pg_temp.ask(ana, format($q$select school_id from public.transcript_verify(1, %L)$q$, h1)), 'tr-u');
  perform pg_temp.said('the function answers exactly four columns',
    pg_get_function_result('public.transcript_verify(bigint, text)'::regprocedure), 'TABLE(status text, school_id text, school_name text, issued_on date)');
  perform pg_temp.counted('an answer holds neither the student nor the courses',
    (select count(*) from (select row_to_json(v)::text as j from public.transcript_verify(1, h1) v) x
      where x.j like '%S100%' or x.j like '%ECON%' or x.j like '%Fall 2025%' or x.j like '%terms%' or x.j like '%body%'), 0);
  perform pg_temp.counted('checking wrote nothing to the ledger', (select count(*) from public.academic_record_entries), entries_before);
  perform pg_temp.counted('nor any transcript', (select count(*) from public.transcripts), n);
  perform pg_temp.said('a signed-out visitor cannot check one',
    (pg_temp.anon_err(format($q$select status from public.transcript_verify(1, %L)$q$, h1)) like '%permission denied%')::text, 'true');
  perform pg_temp.said('nor read a transcript',
    (pg_temp.anon_err('select * from public.transcripts') like '%permission denied%')::text, 'true');
  perform pg_temp.said('nor the log',
    (pg_temp.anon_err('select * from public.transcript_disclosures') like '%permission denied%')::text, 'true');
  perform pg_temp.said('nor issue one',
    (pg_temp.anon_err($q$select public.transcript_issue('S100', '2025-12-31', null, null, 'anon-issue-key-01')$q$) like '%permission denied%')::text, 'true');
  perform pg_temp.said('nor log a release',
    (pg_temp.anon_err($q$select public.transcript_disclose(1, 'a', 'b', 'c', 'anon-disclose-key1')$q$) like '%permission denied%')::text, 'true');

  -- The limit: an account is allowed 120 checks an hour, unknown answers
  -- included, and the 121st is refused. Another account is not affected.
  perform pg_temp.become(zed);
  for i in 1..120 loop
    perform status from public.transcript_verify(1, repeat('0', 64));
  end loop;
  begin
    perform status from public.transcript_verify(1, h1);
    execute 'reset role';
    raise exception 'FAILED: the 121st check was allowed';
  exception when sqlstate '54000' then
    execute 'reset role';
    raise notice 'ok  the 121st check in an hour is refused';
  end;
  perform pg_temp.counted('120 hits were counted against the account', (select count(*) from private.direct_rate_limit where user_id = zed and bucket = 'transcript_verify'), 120);
  perform pg_temp.said('another account is not affected, a control',
    pg_temp.ask(ben, format($q$select status from public.transcript_verify(1, %L)$q$, h1)), 'valid');

  -- ── The mode, the kill switch and a frozen module ──────────────────────────
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason) values ('tr-u', 'kill.core_modules', true, 'drill');
  perform pg_temp.refused_for('an issue while Core modules are paused', reg,
    format($q$select public.transcript_issue('S100', %L, null, null, 'reg-pause-key-01')$q$, today), 'paused');
  perform pg_temp.refused_for('a release while they are paused', reg,
    $q$select public.transcript_disclose(1, 'Acme', 'employer', 'A job.', 'reg-pause-key-02')$q$, 'paused');
  perform pg_temp.counted('what was issued is still readable', pg_temp.seen(ana, 'select * from public.transcripts'), 5);
  perform pg_temp.counted('and the log', pg_temp.seen(ana, 'select * from public.transcript_disclosures'), 3);
  perform pg_temp.said('and still checkable', pg_temp.ask(ana, format($q$select status from public.transcript_verify(1, %L)$q$, h1)), 'valid');
  update public.feature_kill_switch set engaged = false where switch_key = 'kill.core_modules';
  t8 := pg_temp.ask(reg, format($q$select public.transcript_issue('S200', %L, null, null, 'reg-pause-key-03')$q$, today))::uuid;
  perform pg_temp.counted('an issue once it is lifted, a control: serial 8', (select serial from public.transcripts where id = t8), 8);
  update public.tenant_module_mode set mode = 'connect', frozen = true where tenant_id = 'tr-u' and module = 'records';
  perform pg_temp.refused_for('an issue in a frozen module', reg,
    format($q$select public.transcript_issue('S100', %L, null, null, 'reg-frozen-key-1')$q$, today), 'has not switched');
  perform pg_temp.refused_for('a release in a frozen module', reg,
    $q$select public.transcript_disclose(1, 'Acme', 'employer', 'A job.', 'reg-frozen-key-2')$q$, 'has not switched');
  perform pg_temp.counted('what was kept is still readable', pg_temp.seen(reg, 'select * from public.transcripts'), 8);
  perform pg_temp.said('and still checkable', pg_temp.ask(ana, format($q$select status from public.transcript_verify(1, %L)$q$, h1)), 'valid');
  update public.tenant_module_mode set mode = 'core', frozen = false where tenant_id = 'tr-u' and module = 'records';

  -- A school in Connect can do none of it.
  perform pg_temp.refused_for('a registrar at a Connect school issuing', conn_reg,
    $q$select public.transcript_issue('C100', '2025-12-31', null, null, 'conn-issue-key-01')$q$, 'has not switched records and transcripts');
  perform pg_temp.refused_for('or logging a release', conn_reg,
    $q$select public.transcript_disclose(1, 'Acme', 'employer', 'A job.', 'conn-disclose-key1')$q$, 'has not switched records and transcripts');
  -- The mode of another module is no substitute.
  insert into public.tenant_module_mode (tenant_id, module, mode, reason) values ('tr-conn', 'degree_audit', 'core', 'the check suite');
  perform pg_temp.refused_for('a school with some other module in Core is still not in Core for records', conn_reg,
    $q$select public.transcript_issue('C100', '2025-12-31', null, null, 'conn-issue-key-02')$q$, 'has not switched records and transcripts');

  -- ── Account deletion: the transcript and its log stay with the school ──────
  perform pg_temp.works('a third registrar issues, a control', reg3,
    format($q$select public.transcript_issue('S200', %L, null, null, 'reg3-issue-key-01')$q$, today));
  perform pg_temp.counted('before it, the registrar''s releases name them', (select count(*) from public.transcript_disclosures where released_by = reg), 4);
  delete from auth.users where id = reg3;
  perform pg_temp.counted('deleting a registrar''s account clears who issued, and the transcript stays',
    (select count(*) from public.transcripts where operation = 'reg3-issue-key-01' and issued_by is null), 1);
  delete from auth.users where id = reg;
  perform pg_temp.counted('the registrar''s account goes: the four releases stay, with no releaser named',
    (select count(*) from public.transcript_disclosures where released_by is null), 4);
  perform pg_temp.counted('and the supersession they wrote stays', (select count(*) from public.transcript_supersessions where recorded_by is null), 1);
  perform pg_temp.owner_refused_for('and the owner still cannot change what a release was for',
    format($q$update public.transcript_disclosures set purpose = 'Edited.' where id = %L$q$, d1), 'kept as it was written');
  perform pg_temp.counted('a student''s transcripts, before their account goes', (select count(*) from public.transcripts where student_ref = 'S200'), 4);
  delete from auth.users where id = ben;
  perform pg_temp.counted('Ben''s account is gone and his transcripts stay', (select count(*) from public.transcripts where student_ref = 'S200'), 4);
  perform pg_temp.counted('so does the log of their release', (select count(*) from public.transcript_disclosures where student_ref = 'S200'), 1);
end $$;

rollback;
