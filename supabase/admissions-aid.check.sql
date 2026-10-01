-- supabase/admissions-aid.check.sql — admissions records and financial-aid
-- records: who records, who decides, who reads, what is refused at the field,
-- and that nothing recorded is rewritten.
--
-- For 20260930270000_admissions_aid.sql. One school, aa-u, a post-secondary
-- school that has switched `admissions` and `financial_aid` to Core: a
-- registrar, a dean, an aid officer, a business administrator (a second one
-- for reversing a ledger entry), a student-accounts officer, a faculty member,
-- one person who holds both the aid officer's and the business administrator's
-- roles, and three students, two of whom the school linked to a record (S100,
-- S200). A second school stays in Connect, a third is a K-12 school with both
-- modules on, and a fourth is Core with its own staff. What it proves:
--
--   * the rules held to their TypeScript twins: every case in
--     app/src/lib/admissions/fixtures.json and app/src/lib/aid/fixtures.json is
--     run through the SQL function and must come out as the fixtures say, and
--     the comparison is shown able to fail;
--   * an applicant is added by `admissions:record` alone; a decision (admit,
--     deny, waitlist) needs `admissions:decide`; a dean decides and cannot
--     record a non-decision step; a status never moves backwards, never skips,
--     and moves back only by a correction that names the entry it corrects;
--   * the history and the links are append-only even to the owner, and an
--     applicant's status is only ever the last history row;
--   * an applicant becomes a student only by the registrar's link: `enrolled`
--     is refused before it, the link is refused for an applicant who is not
--     admitted and a second time, and the link creates no student, no
--     academic-record subject and no ledger entry;
--   * an applicant file is read by admissions staff alone: not by aid staff,
--     faculty, another school's registrar, nor by a student, including the
--     student the applicant was linked to;
--   * a student reference or a text that looks like a social security number
--     or a card number is refused in every field a person types, and no column
--     of any new table can hold federal or tax data;
--   * an award is recorded by `aid:record`, a high one (at or above D-146's
--     threshold, or its default when a school has set none) waits for a second
--     person holding `aid:approve_high` who is never its recorder, cannot be
--     accepted or disbursed before, and is not shown to its student before;
--   * a disbursement never exceeds the award, and a linked ledger aid credit
--     must exist and be this student's at this school, for the same amount,
--     not reversed and not already used; a fully disbursed award becomes
--     disbursed; and NOTHING IS WRITTEN to the student-accounts ledger;
--   * a student reads their own awards and disbursements and nobody else's, and
--     neither the history nor the approvals;
--   * a school in Connect, a frozen module, paused Core modules and a K-12
--     school can do none of it, though what was recorded stays readable;
--   * every mutation is idempotent on its key;
--   * deleting an account clears who recorded and leaves the record. (A school is
--     never deleted, so the removal of a school's records with it is not tested.)
--
-- The control: each refusal comes after the same call working for the right
-- person, so a refusal is the rule's doing and not a broken fixture.
--
--   How to run it: supabase/check.sh admissions-aid

\set adm_fixtures `tr '\n' ' ' < "${SEMESTER_SUPABASE_DIR:-supabase}/../app/src/lib/admissions/fixtures.json"`
\set aid_fixtures `tr '\n' ' ' < "${SEMESTER_SUPABASE_DIR:-supabase}/../app/src/lib/aid/fixtures.json"`

begin;

create temp table fx on commit drop as select :'adm_fixtures'::jsonb as adm, :'aid_fixtures'::jsonb as aid;

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

create or replace function pg_temp.owner_err(statement text)
returns text language plpgsql as $$
begin
  -- The owner is nobody in particular: clear whoever was last signed in.
  perform set_config('request.jwt.claims', '', true);
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

-- One entry on the student-accounts ledger, the only way it can be written:
-- requested by one person, approved by another. Returns the entry's id.
create or replace function pg_temp.ledger(school text, prop uuid, decider uuid, student text, kind text, category text,
                                         cents bigint, ref uuid default null)
returns uuid language plpgsql as $$
declare req uuid; e text; entry uuid;
begin
  perform pg_temp.become(prop);
  execute format(
    'insert into public.student_account_requests (tenant_id, student_ref, kind, category, amount_cents, description, reference_entry_id, effective_on)
     values (%L, %L, %L, %L, %s, %L, %L, current_date) returning id',
    school, student, kind, category, cents, 'Posted for the admissions and aid check.', ref) into req;
  execute 'reset role';
  e := pg_temp.err(decider, format('update public.student_account_requests set status = ''approved'' where id = %L', req));
  if e is not null then raise exception 'FAILED: posting a % to the ledger — %', kind, e; end if;
  select q.entry_id into entry from public.student_account_requests q where q.id = req;
  return entry;
end $$;

-- ── The rules, held to the TypeScript twins ───────────────────────────────
do $$
declare
  c jsonb; s1 text; s2 text; want boolean; got boolean; n integer := 0; allowed jsonb; why text; gotwhy text; h boolean; p text; r text;
begin
  if (select jsonb_array_length(adm->'text') from fx) < 10 or (select jsonb_array_length(aid->'high') from fx) < 5 then
    raise exception 'FAILED: the fixtures files were not read';
  end if;

  -- Every pair of admissions statuses: legal exactly when the fixture says so.
  for s1 in select jsonb_array_elements_text(adm->'statuses') from fx loop
    for s2 in select jsonb_array_elements_text(adm->'statuses') from fx loop
      want := (select (adm->'forward'->s1) ? s2 from fx);
      got := private.adm_status_legal(s1, s2);
      if got is distinct from want then
        raise exception 'FAILED: admissions % -> %: sql says %, the fixture says %', s1, s2, got, want;
      end if;
      -- The control: the comparison fails when the answer is wrong.
      if got is not distinct from not want then raise exception 'FAILED: the comparison cannot fail'; end if;
      n := n + 1;
    end loop;
  end loop;
  perform pg_temp.counted('every admissions status pair was compared', n, 49);

  n := 0;
  for s1 in select jsonb_array_elements_text(aid->'statuses') from fx loop
    for s2 in select jsonb_array_elements_text(aid->'statuses') from fx loop
      want := (select (aid->'forward'->s1) ? s2 from fx);
      if private.aid_status_legal(s1, s2) is distinct from want then
        raise exception 'FAILED: aid % -> %: sql says %, the fixture says %', s1, s2, private.aid_status_legal(s1, s2), want;
      end if;
      n := n + 1;
    end loop;
  end loop;
  perform pg_temp.counted('every aid status pair was compared', n, 25);

  n := 0;
  for c in select jsonb_array_elements(adm->'text') from fx loop
    got := coalesce(private.adm_aid_text_refused(c->>'text'), 'none') = coalesce(c->>'refused', 'none');
    if not got then
      raise exception 'FAILED: text "%" (%): sql says %, the fixture says %', c->>'text', c->>'name', private.adm_aid_text_refused(c->>'text'), c->>'refused';
    end if;
    n := n + 1;
  end loop;
  perform pg_temp.counted('every text case was compared', n, (select jsonb_array_length(adm->'text') from fx));

  n := 0;
  for c in select jsonb_array_elements(aid->'high') from fx loop
    if private.aid_is_high((c->>'amount')::bigint, (c->>'threshold')::bigint) is distinct from (c->>'high')::boolean then
      raise exception 'FAILED: high-value "%": sql says %', c->>'name', private.aid_is_high((c->>'amount')::bigint, (c->>'threshold')::bigint);
    end if;
    n := n + 1;
  end loop;
  perform pg_temp.counted('every high-value case was compared', n, (select jsonb_array_length(aid->'high') from fx));

  n := 0;
  for c in select jsonb_array_elements(aid->'approval') from fx loop
    if private.aid_approval_problem((c->>'high')::boolean, c->>'recorder', c->>'approver', (c->>'holds')::boolean) is distinct from (c->>'problem') then
      raise exception 'FAILED: approval "%": sql says %', c->>'name',
        coalesce(private.aid_approval_problem((c->>'high')::boolean, c->>'recorder', c->>'approver', (c->>'holds')::boolean), 'none');
    end if;
    n := n + 1;
  end loop;
  perform pg_temp.counted('every approval case was compared', n, (select jsonb_array_length(aid->'approval') from fx));

  n := 0;
  for c in select jsonb_array_elements(aid->'disbursement') from fx loop
    if private.aid_disbursement_after((c->>'award')::bigint, (c->>'soFar')::bigint, (c->>'add')::bigint) is distinct from c->>'after' then
      raise exception 'FAILED: disbursement "%": sql says %', c->>'name',
        private.aid_disbursement_after((c->>'award')::bigint, (c->>'soFar')::bigint, (c->>'add')::bigint);
    end if;
    n := n + 1;
  end loop;
  perform pg_temp.counted('every disbursement case was compared', n, (select jsonb_array_length(aid->'disbursement') from fx));
end $$;

do $$
declare
  reg uuid; reg2 uuid; dean2 uuid; aid uuid; biz uuid; biz2 uuid; sao uuid; prof uuid; both_ uuid; ana uuid; ben uuid; cal uuid;
  far_reg uuid; far_aid uuid; far_sao uuid; far_biz uuid; conn_reg uuid; conn_aid uuid; k12_reg uuid; k12_aid uuid;
  a1 uuid; a2 uuid; a3 uuid; a4 uuid; a5 uuid; h1 uuid; lk uuid;
  w1 uuid; w2 uuid; w3 uuid; w4 uuid; w5 uuid; w6 uuid; w7 uuid; d1 uuid; d2 uuid;
  e1 uuid; e2 uuid; e3 uuid; e4 uuid; e6 uuid; e_far uuid; far_cr uuid;
  subjects_before bigint; users_before bigint; entries_before bigint; requests_before bigint; n bigint; e text;
begin
  insert into public.schools (id, name, email_domains, edition) values
    ('aa-u',     'Admissions and Aid University', array['aa-u.example'], 'higher_ed'),
    ('aa-conn',  'Connect College',               array['aa-conn.example'], 'higher_ed'),
    ('aa-k12',   'A K-12 School',                 array['aa-k12.example'], 'k12'),
    ('aa-other', 'Other University',              array['aa-other.example'], 'higher_ed');

  reg      := pg_temp.newuser('reg@aa-u.example', 'aa-u');
  reg2     := pg_temp.newuser('reg2@aa-u.example', 'aa-u');
  dean2    := pg_temp.newuser('dean@aa-u.example', 'aa-u');
  aid      := pg_temp.newuser('aid@aa-u.example', 'aa-u');
  biz      := pg_temp.newuser('biz@aa-u.example', 'aa-u');
  biz2     := pg_temp.newuser('biz2@aa-u.example', 'aa-u');
  sao      := pg_temp.newuser('sao@aa-u.example', 'aa-u');
  prof     := pg_temp.newuser('prof@aa-u.example', 'aa-u');
  both_    := pg_temp.newuser('both@aa-u.example', 'aa-u');
  ana      := pg_temp.newuser('ana@aa-u.example', 'aa-u');
  ben      := pg_temp.newuser('ben@aa-u.example', 'aa-u');
  cal      := pg_temp.newuser('cal@aa-u.example', 'aa-u');
  far_reg  := pg_temp.newuser('reg@aa-other.example', 'aa-other');
  far_aid  := pg_temp.newuser('aid@aa-other.example', 'aa-other');
  far_sao  := pg_temp.newuser('sao@aa-other.example', 'aa-other');
  far_biz  := pg_temp.newuser('biz@aa-other.example', 'aa-other');
  conn_reg := pg_temp.newuser('reg@aa-conn.example', 'aa-conn');
  conn_aid := pg_temp.newuser('aid@aa-conn.example', 'aa-conn');
  k12_reg  := pg_temp.newuser('reg@aa-k12.example', 'aa-k12');
  k12_aid  := pg_temp.newuser('aid@aa-k12.example', 'aa-k12');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (reg,      'registrar',                'school', 'aa-u',     'institution'),
    (reg2,     'registrar',                'school', 'aa-u',     'institution'),
    (dean2,    'dean',                     'school', 'aa-u',     'institution'),
    (aid,      'financial_aid_officer',    'school', 'aa-u',     'institution'),
    (biz,      'business_admin',           'school', 'aa-u',     'institution'),
    (biz2,     'business_admin',           'school', 'aa-u',     'institution'),
    (sao,      'student_accounts_officer', 'school', 'aa-u',     'institution'),
    (prof,     'faculty',                  'school', 'aa-u',     'institution'),
    (both_,    'financial_aid_officer',    'school', 'aa-u',     'institution'),
    (both_,    'business_admin',           'school', 'aa-u',     'institution'),
    (ana,      'student',                  'school', 'aa-u',     'institution'),
    (ben,      'student',                  'school', 'aa-u',     'institution'),
    (cal,      'student',                  'school', 'aa-u',     'institution'),
    (far_reg,  'registrar',                'school', 'aa-other', 'institution'),
    (far_aid,  'financial_aid_officer',    'school', 'aa-other', 'institution'),
    (far_sao,  'student_accounts_officer', 'school', 'aa-other', 'institution'),
    (far_biz,  'business_admin',           'school', 'aa-other', 'institution'),
    (conn_reg, 'registrar',                'school', 'aa-conn',  'institution'),
    (conn_aid, 'financial_aid_officer',    'school', 'aa-conn',  'institution'),
    (k12_reg,  'registrar',                'school', 'aa-k12',   'institution'),
    (k12_aid,  'financial_aid_officer',    'school', 'aa-k12',   'institution');

  -- The school links an account to a record: Ana is S100, Ben is S200, Cal is nobody.
  insert into public.academic_record_subjects (tenant_id, student_ref, user_id) values
    ('aa-u', 'S100', ana), ('aa-u', 'S200', ben);

  -- ── The mode: Core for both modules at aa-u, aa-other and aa-k12 ───
  -- A control first: until the module is Core, the registrar is refused for the
  -- mode and for nothing else.
  perform pg_temp.refused_for('a registrar in a school still in Connect', reg,
    $q$select public.admissions_applicant_add('Fall 2027', 'A-1001', 'Economics, B.A.', 'Received through the portal.', 'early-add-key-01')$q$,
    'has not switched admissions to Semester Core');
  perform pg_temp.refused_for('an aid officer in a school still in Connect', aid,
    $q$select public.aid_award_record('S100', '2026-2027', 'Merit Grant', 'grant', 40000, 'Offered.', 'early-award-key-1')$q$,
    'has not switched financial aid to Semester Core');
  insert into public.tenant_module_mode (tenant_id, module, mode, reason) values
    ('aa-u', 'admissions', 'core', 'the check suite'), ('aa-u', 'financial_aid', 'core', 'the check suite'),
    ('aa-other', 'admissions', 'core', 'the check suite'), ('aa-other', 'financial_aid', 'core', 'the check suite'),
    ('aa-k12', 'admissions', 'core', 'the check suite'), ('aa-k12', 'financial_aid', 'core', 'the check suite');

  -- ── Admissions: adding an applicant ───────────────────────────────────────
  a1 := pg_temp.ask(reg, $q$select public.admissions_applicant_add(' Fall 2027 ', ' A-1001 ', 'Economics, B.A.', 'Received through the school''s own portal.', 'add-a1-key-0001')$q$)::uuid;
  perform pg_temp.said('the registrar adds an applicant, tidied, as submitted',
    (select cycle || '|' || applicant_ref || '|' || status from public.admissions_applicants where id = a1), 'Fall 2027|A-1001|submitted');
  perform pg_temp.counted('with one history entry, from nothing', (select count(*) from public.admissions_status_history where applicant_id = a1 and seq = 1 and from_status is null), 1);
  perform pg_temp.said('the same key again answers the same id',
    pg_temp.ask(reg, $q$select public.admissions_applicant_add(' Fall 2027 ', ' A-1001 ', 'Economics, B.A.', 'Received through the school''s own portal.', 'add-a1-key-0001')$q$), a1::text);
  perform pg_temp.counted('and wrote one applicant', (select count(*) from public.admissions_applicants), 1);
  perform pg_temp.refused_for('the same key for a different applicant', reg,
    $q$select public.admissions_applicant_add('Fall 2027', 'A-9999', 'History, B.A.', 'Received.', 'add-a1-key-0001')$q$, 'already used for a different request');
  perform pg_temp.refused_for('the same key from somebody else', reg2,
    $q$select public.admissions_applicant_add(' Fall 2027 ', ' A-1001 ', 'Economics, B.A.', 'Received through the school''s own portal.', 'add-a1-key-0001')$q$, 'already used for a different request');
  perform pg_temp.refused('a key that is too short', reg,
    $q$select public.admissions_applicant_add('Fall 2027', 'A-1002', 'History, B.A.', 'Received.', 'short')$q$);
  perform pg_temp.refused_for('the same applicant again in the same cycle', reg,
    $q$select public.admissions_applicant_add('Fall 2027', 'A-1001', 'Economics, B.A.', 'Received.', 'add-dup-key-0001')$q$, 'already recorded');
  perform pg_temp.works('the same reference in another cycle, a control', reg,
    $q$select public.admissions_applicant_add('Spring 2028', 'A-1001', 'Economics, B.A.', 'Received.', 'add-spring-key-1')$q$);

  perform pg_temp.refused_for('a dean adding an applicant', dean2,
    $q$select public.admissions_applicant_add('Fall 2027', 'A-2001', 'History, B.A.', 'Received.', 'dean-add-key-001')$q$, 'admissions:record');
  perform pg_temp.refused_for('an aid officer adding an applicant', aid,
    $q$select public.admissions_applicant_add('Fall 2027', 'A-2001', 'History, B.A.', 'Received.', 'aid-add-key-0001')$q$, 'admissions:record');
  perform pg_temp.refused_for('faculty adding an applicant', prof,
    $q$select public.admissions_applicant_add('Fall 2027', 'A-2001', 'History, B.A.', 'Received.', 'prof-add-key-001')$q$, 'admissions:record');
  perform pg_temp.refused_for('a student adding an applicant', ana,
    $q$select public.admissions_applicant_add('Fall 2027', 'A-2001', 'History, B.A.', 'Received.', 'ana-add-key-0001')$q$, 'admissions:record');

  -- A registrar at another school adds to THEIR school; this school's staff do not see it.
  perform pg_temp.works('another school''s registrar adds an applicant to their own school, a control', far_reg,
    $q$select public.admissions_applicant_add('Fall 2027', 'A-1001', 'Economics, B.A.', 'Received.', 'far-add-key-0001')$q$);
  perform pg_temp.counted('and this school''s registrar does not read it', pg_temp.seen(reg, 'select * from public.admissions_applicants'), 2);
  perform pg_temp.refused_for('and the other registrar cannot reach this school''s applicant', far_reg,
    format($q$select public.admissions_status_record(%L, 'in_review', 'Looking at it.', 'far-status-key-01')$q$, a1), 'no such applicant here');

  -- ── Admissions: nothing a person types may be a card or an SSN ────────────
  perform pg_temp.refused_for('an applicant reference shaped like an SSN', reg,
    $q$select public.admissions_applicant_add('Fall 2027', '123-45-6789', 'History, B.A.', 'Received.', 'ssn-ref-key-0001')$q$, 'social security number');
  perform pg_temp.refused_for('an applicant reference of nine digits', reg,
    $q$select public.admissions_applicant_add('Fall 2027', '123456789', 'History, B.A.', 'Received.', 'ssn-ref-key-0002')$q$, 'social security number');
  perform pg_temp.refused_for('a program that is an SSN', reg,
    $q$select public.admissions_applicant_add('Fall 2027', 'A-5001', 'SSN 123-45-6789', 'Received.', 'ssn-prog-key-0001')$q$, 'social security number');
  perform pg_temp.refused_for('a reason that carries an SSN', reg,
    $q$select public.admissions_applicant_add('Fall 2027', 'A-5001', 'History, B.A.', 'Applicant gave 123 45 6789 by phone.', 'ssn-why-key-0001')$q$, 'social security number');
  perform pg_temp.refused_for('a reason that carries a card number', reg,
    $q$select public.admissions_applicant_add('Fall 2027', 'A-5001', 'History, B.A.', 'Paid the fee with 4111 1111 1111 1111.', 'card-why-key-0001')$q$, 'card number');
  perform pg_temp.works('the same applicant with ordinary words, a control', reg,
    $q$select public.admissions_applicant_add('Fall 2027', 'A-5001', 'History, B.A.', 'Received through the school''s own portal.', 'plain-add-key-001')$q$);
  perform pg_temp.owner_refused_for('an SSN written straight into a reason, even by the owner',
    format($q$insert into public.admissions_status_history (tenant_id, applicant_id, kind, to_status, corrects_seq, reason, operation)
              values ('aa-u', %L, 'correction', 'denied', 1, 'Number 123-45-6789 on file', 'direct')$q$, a1), 'violates check constraint');
  perform pg_temp.owner_refused_for('an SSN-shaped applicant reference written straight into the table',
    $q$insert into public.admissions_applicants (tenant_id, cycle, applicant_ref, program, operation) values ('aa-u', 'Fall 2027', '987654321', 'x', 'direct')$q$,
    'violates check constraint');

  -- ── Admissions: statuses, decisions and corrections ───────────────────────
  perform pg_temp.refused_for('a dean recording a step that is not a decision', dean2,
    format($q$select public.admissions_status_record(%L, 'in_review', 'Opened for review.', 'dean-review-key-1')$q$, a1), 'admissions:record');
  perform pg_temp.works('the registrar moving it to in review, a control', reg,
    format($q$select public.admissions_status_record(%L, 'in_review', 'Opened for review.', 'reg-review-key-01')$q$, a1));
  perform pg_temp.refused_for('an aid officer admitting', aid,
    format($q$select public.admissions_status_record(%L, 'admitted', 'Admitted.', 'aid-admit-key-001')$q$, a1), 'admissions:decide');
  perform pg_temp.refused_for('faculty denying', prof,
    format($q$select public.admissions_status_record(%L, 'denied', 'Denied.', 'prof-deny-key-001')$q$, a1), 'admissions:decide');
  perform pg_temp.refused_for('a student waitlisting', ana,
    format($q$select public.admissions_status_record(%L, 'waitlisted', 'Waitlisted.', 'ana-wait-key-001')$q$, a1), 'admissions:decide');
  perform pg_temp.refused_for('a status that is not on the list', reg,
    format($q$select public.admissions_status_record(%L, 'accepted', 'Accepted.', 'reg-bad-key-00001')$q$, a1), 'not an admissions status');
  perform pg_temp.refused_for('a reason that is too short', dean2,
    format($q$select public.admissions_status_record(%L, 'admitted', 'ok', 'dean-short-key-01')$q$, a1), 'a reason is 3 to 1000');
  a2 := pg_temp.ask(reg, $q$select public.admissions_applicant_add('Fall 2027', 'A-2001', 'History, B.A.', 'Received.', 'add-a2-key-0001')$q$)::uuid;
  perform pg_temp.refused_for('admitting an application that was never reviewed', dean2,
    format($q$select public.admissions_status_record(%L, 'admitted', 'Admitted.', 'dean-skip-key-001')$q$, a2), 'does not move from submitted to admitted');
  perform pg_temp.works('the dean admitting a reviewed application, a control', dean2,
    format($q$select public.admissions_status_record(%L, 'admitted', 'Admitted by the committee.', 'dean-admit-key-01')$q$, a1));
  perform pg_temp.said('the status is the last entry', (select status from public.admissions_applicants where id = a1), 'admitted');
  perform pg_temp.said('with each entry from where the last one left it',
    (select string_agg(seq || ':' || coalesce(from_status, '-') || '>' || to_status, ' ' order by seq) from public.admissions_status_history where applicant_id = a1),
    '1:->submitted 2:submitted>in_review 3:in_review>admitted');
  perform pg_temp.said('and who recorded the last one', (select recorded_by::text from public.admissions_status_history where applicant_id = a1 and seq = 3), dean2::text);
  perform pg_temp.refused_for('moving an admitted applicant back to in review', reg,
    format($q$select public.admissions_status_record(%L, 'in_review', 'Looking again.', 'reg-back-key-0001')$q$, a1), 'does not move from admitted to in_review');
  perform pg_temp.refused_for('moving an admitted applicant back to submitted', reg,
    format($q$select public.admissions_status_record(%L, 'submitted', 'Starting over.', 'reg-back-key-0002')$q$, a1), 'does not move from admitted to submitted');
  perform pg_temp.refused_for('admitting an admitted applicant again', dean2,
    format($q$select public.admissions_status_record(%L, 'admitted', 'Admitted again.', 'dean-same-key-001')$q$, a1), 'does not move from admitted to admitted');

  perform pg_temp.refused_for('an aid officer correcting an entry', aid,
    format($q$select public.admissions_status_correct(%L, 'in_review', 3, 'Entered by mistake.', 'aid-fix-key-00001')$q$, a1), 'admissions:decide');
  perform pg_temp.refused_for('a correction that changes nothing', reg,
    format($q$select public.admissions_status_correct(%L, 'admitted', 3, 'Entered by mistake.', 'reg-fix-key-000001')$q$, a1), 'a correction changes the status');
  perform pg_temp.refused_for('a correction of an entry that does not exist', reg,
    format($q$select public.admissions_status_correct(%L, 'in_review', 99, 'Entered by mistake.', 'reg-fix-key-000002')$q$, a1), 'names an entry that exists');
  perform pg_temp.refused_for('a correction that names no entry', reg,
    format($q$select public.admissions_status_correct(%L, 'in_review', 0, 'Entered by mistake.', 'reg-fix-key-000003')$q$, a1), 'names the entry it corrects');
  perform pg_temp.works('the registrar correcting the entry, a control', reg,
    format($q$select public.admissions_status_correct(%L, 'in_review', 3, 'The committee had not yet met; entered by mistake.', 'reg-fix-key-000004')$q$, a1));
  perform pg_temp.said('the correction is its own entry, and names the one it corrects',
    (select kind || ' ' || seq || ' ' || corrects_seq || ' ' || from_status || '>' || to_status from public.admissions_status_history where applicant_id = a1 and seq = 4),
    'correction 4 3 admitted>in_review');
  perform pg_temp.works('the dean admitting again, once it is true', dean2,
    format($q$select public.admissions_status_record(%L, 'admitted', 'Admitted after the committee met.', 'dean-admit-key-02')$q$, a1));

  -- ── Admissions: append-only, even to the owner ────────────────────────────
  perform pg_temp.owner_refused_for('editing a history entry', format($q$update public.admissions_status_history set reason = 'Rewritten' where applicant_id = %L and seq = 2$q$, a1), 'append-only');
  perform pg_temp.owner_refused_for('deleting a history entry', format($q$delete from public.admissions_status_history where applicant_id = %L and seq = 2$q$, a1), 'append-only');
  perform pg_temp.owner_refused_for('writing a status without a history entry', format($q$update public.admissions_applicants set status = 'denied' where id = %L$q$, a1), 'last entry of its history');
  perform pg_temp.owner_refused_for('editing an applicant''s program', format($q$update public.admissions_applicants set program = 'Law, J.D.' where id = %L$q$, a1), 'is not edited');
  perform pg_temp.owner_refused_for('deleting an applicant', format($q$delete from public.admissions_applicants where id = %L$q$, a1), 'never deleted');
  perform pg_temp.owner_refused_for('writing a history entry that goes backwards',
    format($q$insert into public.admissions_status_history (tenant_id, applicant_id, kind, to_status, reason, operation) values ('aa-u', %L, 'status', 'submitted', 'Starting over', 'direct')$q$, a1),
    'does not move from admitted to submitted');
  perform pg_temp.refused('a client writing an applicant', reg,
    $q$insert into public.admissions_applicants (tenant_id, cycle, applicant_ref, program, operation) values ('aa-u', 'Fall 2027', 'A-7777', 'x', 'direct')$q$);
  perform pg_temp.refused('a client writing a status', dean2, format($q$update public.admissions_applicants set status = 'denied' where id = %L$q$, a1));
  perform pg_temp.refused('a client writing a history entry', reg,
    format($q$insert into public.admissions_status_history (tenant_id, applicant_id, kind, to_status, reason, operation) values ('aa-u', %L, 'status', 'denied', 'Direct', 'direct')$q$, a1));

  -- ── Admissions: a student only by the registrar's link ────────────────────
  a3 := pg_temp.ask(reg, $q$select public.admissions_applicant_add('Fall 2027', 'A-3001', 'Economics, B.A.', 'Received.', 'add-a3-key-0001')$q$)::uuid;
  perform pg_temp.works('review', reg, format($q$select public.admissions_status_record(%L, 'in_review', 'Opened for review.', 'a3-review-key-001')$q$, a3));
  perform pg_temp.works('and an admission', dean2, format($q$select public.admissions_status_record(%L, 'admitted', 'Admitted.', 'a3-admit-key-0001')$q$, a3));
  perform pg_temp.refused_for('enrolling an applicant who has not been linked', reg,
    format($q$select public.admissions_status_record(%L, 'enrolled', 'Enrolled.', 'a3-enrol-key-0001')$q$, a3), 'linked them to a student reference');
  perform pg_temp.refused_for('linking an applicant who is only submitted', reg,
    format($q$select public.admissions_applicant_link(%L, 'S100', 'a2-link-key-00001')$q$, a2), 'only an admitted applicant');
  select count(*) into subjects_before from public.academic_record_subjects where tenant_id = 'aa-u';
  select count(*) into users_before from auth.users;
  perform pg_temp.refused_for('a dean linking', dean2,
    format($q$select public.admissions_applicant_link(%L, 'S100', 'a3-link-key-00001')$q$, a3), 'admissions:record');
  perform pg_temp.refused_for('a link that is not a student reference', reg,
    format($q$select public.admissions_applicant_link(%L, 'S 100', 'a3-link-key-00002')$q$, a3), 'not a student reference');
  perform pg_temp.works('the registrar linking an admitted applicant, a control', reg,
    format($q$select public.admissions_applicant_link(%L, 'S100', 'a3-link-key-00003')$q$, a3));
  perform pg_temp.refused_for('linking the same applicant twice', reg,
    format($q$select public.admissions_applicant_link(%L, 'S300', 'a3-link-key-00004')$q$, a3), 'already linked');
  perform pg_temp.works('and now enrolling, a control', reg,
    format($q$select public.admissions_status_record(%L, 'enrolled', 'Enrolled.', 'a3-enrol-key-0002')$q$, a3));
  perform pg_temp.counted('the link makes no student', (select count(*) from public.academic_record_subjects where tenant_id = 'aa-u'), subjects_before);
  perform pg_temp.counted('makes no account', (select count(*) from auth.users), users_before);
  perform pg_temp.owner_refused_for('editing a link', format($q$update public.admissions_applicant_links set student_ref = 'S999' where applicant_id = %L$q$, a3), 'append-only');
  perform pg_temp.owner_refused_for('deleting a link', format($q$delete from public.admissions_applicant_links where applicant_id = %L$q$, a3), 'append-only');

  a4 := pg_temp.ask(reg, $q$select public.admissions_applicant_add('Fall 2027', 'A-4001', 'Economics, B.A.', 'Received.', 'add-a4-key-0001')$q$)::uuid;
  perform pg_temp.works('review of a fourth', reg, format($q$select public.admissions_status_record(%L, 'in_review', 'Opened for review.', 'a4-review-key-001')$q$, a4));
  perform pg_temp.works('and a denial by the dean', dean2, format($q$select public.admissions_status_record(%L, 'denied', 'Denied by the committee.', 'a4-deny-key-00001')$q$, a4));
  perform pg_temp.refused_for('admitting a denied applicant without a correction', dean2,
    format($q$select public.admissions_status_record(%L, 'admitted', 'Changed our minds.', 'a4-admit-key-0001')$q$, a4), 'does not move from denied to admitted');
  perform pg_temp.refused_for('linking a denied applicant', reg,
    format($q$select public.admissions_applicant_link(%L, 'S400', 'a4-link-key-00001')$q$, a4), 'only an admitted applicant');
  a5 := pg_temp.ask(reg, $q$select public.admissions_applicant_add('Fall 2027', 'A-6001', 'Economics, B.A.', 'Received.', 'add-a5-key-0001')$q$)::uuid;
  perform pg_temp.works('review of a fifth', reg, format($q$select public.admissions_status_record(%L, 'in_review', 'Opened for review.', 'a5-review-key-001')$q$, a5));
  perform pg_temp.works('and a waitlisting by the registrar, who also decides', reg, format($q$select public.admissions_status_record(%L, 'waitlisted', 'Waitlisted.', 'a5-wait-key-00001')$q$, a5));

  -- ── Admissions: who reads an applicant file ───────────────────────────────
  perform pg_temp.counted('the registrar reads every applicant at the school', pg_temp.seen(reg, 'select * from public.admissions_applicants'), 7);
  perform pg_temp.counted('the dean does too', pg_temp.seen(dean2, 'select * from public.admissions_applicants'), 7);
  perform pg_temp.counted('and the history', pg_temp.seen(dean2, 'select * from public.admissions_status_history'), 18);
  perform pg_temp.counted('and the links', pg_temp.seen(reg, 'select * from public.admissions_applicant_links'), 1);
  perform pg_temp.counted('an aid officer reads none', pg_temp.seen(aid, 'select * from public.admissions_applicants'), 0);
  perform pg_temp.counted('faculty read none', pg_temp.seen(prof, 'select * from public.admissions_applicants'), 0);
  perform pg_temp.counted('a student reads no applicant file', pg_temp.seen(cal, 'select * from public.admissions_applicants'), 0);
  perform pg_temp.counted('not even the student the applicant was linked to', pg_temp.seen(ana, 'select * from public.admissions_applicants'), 0);
  perform pg_temp.counted('nor its history', pg_temp.seen(ana, 'select * from public.admissions_status_history'), 0);
  perform pg_temp.counted('nor its link', pg_temp.seen(ana, 'select * from public.admissions_applicant_links'), 0);
  perform pg_temp.counted('another school''s registrar reads only their own', pg_temp.seen(far_reg, 'select * from public.admissions_applicants'), 1);

  -- ── Not for children: a K-12 school is refused ────────────────────────────
  perform pg_temp.refused_for('a K-12 registrar adding an applicant, though the module is on', k12_reg,
    $q$select public.admissions_applicant_add('Fall 2027', 'K-1001', 'Grade 9', 'Received.', 'k12-add-key-0001')$q$, 'post-secondary');
  perform pg_temp.refused_for('a K-12 aid officer recording an award, though the module is on', k12_aid,
    $q$select public.aid_award_record('K100', '2026-2027', 'Merit Grant', 'grant', 40000, 'Offered.', 'k12-award-key-001')$q$, 'post-secondary');
  perform pg_temp.said('and that school is a K-12 one', (select edition from public.schools where id = 'aa-k12'), 'k12');
  perform pg_temp.counted('nothing was written for it', (select count(*) from public.admissions_applicants where tenant_id = 'aa-k12') + (select count(*) from public.aid_awards where tenant_id = 'aa-k12'), 0);

  -- ── Financial aid: recording an award ─────────────────────────────────────
  perform pg_temp.refused_for('a student-accounts officer recording an award', sao,
    $q$select public.aid_award_record('S100', '2026-2027', 'Merit Grant', 'grant', 40000, 'Offered.', 'sao-award-key-001')$q$, 'aid:record');
  perform pg_temp.refused_for('a business administrator recording an award', biz,
    $q$select public.aid_award_record('S100', '2026-2027', 'Merit Grant', 'grant', 40000, 'Offered.', 'biz-award-key-001')$q$, 'aid:record');
  perform pg_temp.refused_for('a registrar recording an award', reg,
    $q$select public.aid_award_record('S100', '2026-2027', 'Merit Grant', 'grant', 40000, 'Offered.', 'reg-award-key-001')$q$, 'aid:record');
  perform pg_temp.refused_for('a student recording an award', ana,
    $q$select public.aid_award_record('S100', '2026-2027', 'Merit Grant', 'grant', 40000, 'Offered.', 'ana-award-key-001')$q$, 'aid:record');
  w1 := pg_temp.ask(aid, $q$select public.aid_award_record(' S100 ', '2026-2027', ' Merit Grant ', 'grant', 40000, 'Offered by the aid office.', 'award-w1-key-0001')$q$)::uuid;
  perform pg_temp.said('the aid officer records an award, as offered, not high',
    (select student_ref || '|' || fund_name || '|' || award_type || '|' || amount_cents || '|' || status || '|' || high_value from public.aid_awards where id = w1),
    'S100|Merit Grant|grant|40000|offered|false');
  perform pg_temp.said('the same key again answers the same id',
    pg_temp.ask(aid, $q$select public.aid_award_record(' S100 ', '2026-2027', ' Merit Grant ', 'grant', 40000, 'Offered by the aid office.', 'award-w1-key-0001')$q$), w1::text);
  perform pg_temp.counted('and wrote one award', (select count(*) from public.aid_awards), 1);
  perform pg_temp.refused_for('the same key for a different award', aid,
    $q$select public.aid_award_record('S100', '2026-2027', 'Other Grant', 'grant', 1, 'Offered.', 'award-w1-key-0001')$q$, 'already used for a different request');
  perform pg_temp.refused_for('the same key from somebody else', both_,
    $q$select public.aid_award_record(' S100 ', '2026-2027', ' Merit Grant ', 'grant', 40000, 'Offered by the aid office.', 'award-w1-key-0001')$q$, 'already used for a different request');
  perform pg_temp.refused_for('a second live award from the same fund in the same year', aid,
    $q$select public.aid_award_record('S100', '2026-2027', 'merit grant', 'grant', 5000, 'Offered again.', 'award-dup-key-0001')$q$, 'already has a live award');
  perform pg_temp.refused_for('an aid year that is not two consecutive years', aid,
    $q$select public.aid_award_record('S100', '2026-2028', 'Other Grant', 'grant', 5000, 'Offered.', 'award-year-key-001')$q$, 'consecutive years');
  perform pg_temp.refused_for('an award type that is not on the list', aid,
    $q$select public.aid_award_record('S100', '2026-2027', 'Other Grant', 'stipend', 5000, 'Offered.', 'award-type-key-001')$q$, 'grant, scholarship, loan');
  perform pg_temp.refused_for('an amount of nothing', aid,
    $q$select public.aid_award_record('S100', '2026-2027', 'Other Grant', 'grant', 0, 'Offered.', 'award-zero-key-001')$q$, 'whole number of cents');
  perform pg_temp.refused_for('a student reference that is not one', aid,
    $q$select public.aid_award_record('S 100', '2026-2027', 'Other Grant', 'grant', 5000, 'Offered.', 'award-ref-key-0001')$q$, 'not a student reference');
  perform pg_temp.refused_for('a fund name that is an SSN', aid,
    $q$select public.aid_award_record('S100', '2026-2027', 'Fund 123-45-6789', 'grant', 5000, 'Offered.', 'award-ssn-key-0001')$q$, 'social security number');
  perform pg_temp.refused_for('a reason that is a card number', aid,
    $q$select public.aid_award_record('S100', '2026-2027', 'Other Grant', 'grant', 5000, 'Card 4111111111111111 on file.', 'award-card-key-001')$q$, 'card number');
  perform pg_temp.owner_refused_for('an SSN written straight into a fund name',
    $q$insert into public.aid_awards (tenant_id, student_ref, aid_year, fund_name, award_type, amount_cents, high_value, operation)
       values ('aa-u', 'S100', '2026-2027', 'Fund 123456789', 'grant', 5, false, 'direct')$q$, 'violates check constraint');

  -- The school has set no threshold, so D-146's default (100000) applies.
  w2 := pg_temp.ask(aid, $q$select public.aid_award_record('S200', '2026-2027', 'Presidential Scholarship', 'scholarship', 100000, 'Offered.', 'award-hi-key-00001')$q$)::uuid;
  perform pg_temp.said('an award at the default threshold is high', (select high_value::text from public.aid_awards where id = w2), 'true');
  w7 := pg_temp.ask(aid, $q$select public.aid_award_record('S200', '2026-2027', 'Almost Scholarship', 'scholarship', 99999, 'Offered.', 'award-lo-key-00001')$q$)::uuid;
  perform pg_temp.said('and one cent under it is not', (select high_value::text from public.aid_awards where id = w7), 'false');
  -- Now the school sets its own threshold: one number for the ledger and for aid.
  insert into public.student_account_settings (tenant_id, high_value_cents) values ('aa-u', 50000);
  w3 := pg_temp.ask(both_, $q$select public.aid_award_record('S300', '2026-2027', 'Foundation Loan', 'loan', 50000, 'Offered.', 'award-w3-key-0001')$q$)::uuid;
  perform pg_temp.said('an award exactly at the school''s threshold is high', (select high_value::text from public.aid_awards where id = w3), 'true');
  w5 := pg_temp.ask(aid, $q$select public.aid_award_record('S100', '2026-2027', 'Second Grant', 'grant', 30000, 'Offered.', 'award-w5-key-0001')$q$)::uuid;

  -- ── Financial aid: who reads ──────────────────────────────────────────────
  perform pg_temp.counted('the aid officer reads every award at the school', pg_temp.seen(aid, 'select * from public.aid_awards'), 5);
  perform pg_temp.counted('a student-accounts officer reads them too', pg_temp.seen(sao, 'select * from public.aid_awards'), 5);
  perform pg_temp.counted('a registrar reads none', pg_temp.seen(reg, 'select * from public.aid_awards'), 0);
  perform pg_temp.counted('faculty read none', pg_temp.seen(prof, 'select * from public.aid_awards'), 0);
  perform pg_temp.counted('another school''s aid officer reads none', pg_temp.seen(far_aid, 'select * from public.aid_awards'), 0);
  perform pg_temp.counted('a student reads their own awards', pg_temp.seen(ana, 'select * from public.aid_awards'), 2);
  perform pg_temp.counted('Ben reads his that are not waiting for a second person, and not the high one', pg_temp.seen(ben, 'select * from public.aid_awards'), 1);
  perform pg_temp.said('and it is his own', pg_temp.ask(ben, 'select fund_name from public.aid_awards'), 'Almost Scholarship');
  perform pg_temp.counted('a student not linked to a record reads none', pg_temp.seen(cal, 'select * from public.aid_awards'), 0);
  perform pg_temp.counted('a student reads no history', pg_temp.seen(ana, 'select * from public.aid_award_history'), 0);
  perform pg_temp.counted('and no approvals', pg_temp.seen(ana, 'select * from public.aid_award_approvals'), 0);
  perform pg_temp.counted('the aid officer reads the history', pg_temp.seen(aid, 'select * from public.aid_award_history'), 5);

  -- ── Financial aid: a second person for a high award ───────────────────────
  perform pg_temp.refused_for('accepting a high award nobody has approved', aid,
    format($q$select public.aid_status_record(%L, 'accepted', 'The student accepted.', 'w2-accept-key-0001')$q$, w2), 'not been approved by a second person');
  perform pg_temp.refused_for('an aid officer approving', aid,
    format($q$select public.aid_award_approve(%L, 'Approved.', 'w2-approve-key-0001')$q$, w2), 'aid:approve_high');
  perform pg_temp.refused_for('a registrar approving', reg,
    format($q$select public.aid_award_approve(%L, 'Approved.', 'w2-approve-key-0002')$q$, w2), 'aid:approve_high');
  perform pg_temp.refused_for('approving an award that is not high', biz,
    format($q$select public.aid_award_approve(%L, 'Approved.', 'w7-approve-key-0001')$q$, w7), 'at or above the high-value threshold');
  perform pg_temp.refused_for('the person who recorded a high award approving it', both_,
    format($q$select public.aid_award_approve(%L, 'Approved by me.', 'w3-approve-key-0001')$q$, w3), 'does not approve it');
  perform pg_temp.owner_refused_for('the recorder''s approval written straight into the table',
    format($q$insert into public.aid_award_approvals (tenant_id, award_id, approved_by, operation) values ('aa-u', %L, %L, 'direct')$q$, w3, both_), 'does not approve it');
  perform pg_temp.counted('a high award is still not approved', (select count(*) from public.aid_award_approvals where award_id = w3), 0);
  perform pg_temp.works('a second person approving it, a control', biz,
    format($q$select public.aid_award_approve(%L, 'Approved by a second person.', 'w3-approve-key-0002')$q$, w3));
  perform pg_temp.said('the approval names who and is stamped on the award',
    (select (p.approved_by = biz)::text || ' ' || (a.approved_at = p.approved_at)::text from public.aid_award_approvals p join public.aid_awards a on a.id = p.award_id where p.award_id = w3), 'true true');
  perform pg_temp.refused_for('approving twice', biz2,
    format($q$select public.aid_award_approve(%L, 'Approved again.', 'w3-approve-key-0003')$q$, w3), 'already been approved');
  perform pg_temp.owner_refused_for('editing an approval', format($q$update public.aid_award_approvals set note = 'x' where award_id = %L$q$, w3), 'append-only');
  perform pg_temp.works('approving the other high award', biz,
    format($q$select public.aid_award_approve(%L, 'Approved.', 'w2-approve-key-0003')$q$, w2));
  perform pg_temp.counted('Ben now reads the high award too', pg_temp.seen(ben, 'select * from public.aid_awards'), 2);
  perform pg_temp.works('and the aid officer can now accept it', aid,
    format($q$select public.aid_status_record(%L, 'accepted', 'The student accepted.', 'w2-accept-key-0002')$q$, w2));

  -- ── Financial aid: statuses ───────────────────────────────────────────────
  perform pg_temp.refused_for('disbursing by saying so', aid,
    format($q$select public.aid_status_record(%L, 'disbursed', 'Paid.', 'w1-disb-key-000001')$q$, w1), 'recording its disbursements');
  perform pg_temp.refused_for('a student-accounts officer moving an award', sao,
    format($q$select public.aid_status_record(%L, 'accepted', 'The student accepted.', 'sao-accept-key-001')$q$, w1), 'aid:record');
  perform pg_temp.works('the aid officer recording that the student accepted, a control', aid,
    format($q$select public.aid_status_record(%L, 'accepted', 'The student accepted.', 'w1-accept-key-0001')$q$, w1));
  perform pg_temp.refused_for('an accepted award going back to offered', aid,
    format($q$select public.aid_status_record(%L, 'offered', 'Taking it back.', 'w1-back-key-000001')$q$, w1), 'does not move from accepted to offered');
  perform pg_temp.refused_for('a status that is not on the list', aid,
    format($q$select public.aid_status_record(%L, 'paid', 'Paid.', 'w1-bad-key-0000001')$q$, w1), 'not an aid status');
  perform pg_temp.owner_refused_for('editing an award''s amount', format($q$update public.aid_awards set amount_cents = 1 where id = %L$q$, w1), 'is not edited');
  perform pg_temp.owner_refused_for('writing an award''s status without a history entry', format($q$update public.aid_awards set status = 'cancelled' where id = %L$q$, w1), 'last entry of its history');
  perform pg_temp.owner_refused_for('editing an award''s history', format($q$update public.aid_award_history set reason = 'Rewritten' where award_id = %L and seq = 1$q$, w1), 'append-only');
  perform pg_temp.owner_refused_for('deleting an award', format($q$delete from public.aid_awards where id = %L$q$, w1), 'never deleted');
  perform pg_temp.refused('a client writing an award', aid,
    $q$insert into public.aid_awards (tenant_id, student_ref, aid_year, fund_name, award_type, amount_cents, high_value, operation) values ('aa-u', 'S100', '2026-2027', 'Direct', 'grant', 5, false, 'direct')$q$);
  perform pg_temp.refused('a client writing a disbursement', aid,
    format($q$insert into public.aid_disbursements (tenant_id, award_id, student_ref, amount_cents, disbursed_on, operation) values ('aa-u', %L, 'S100', 5, current_date, 'direct')$q$, w1));

  -- ── Financial aid: disbursements, and the student-accounts ledger ─────────
  e1 := pg_temp.ledger('aa-u', sao, biz, 'S100', 'aid_credit', 'scholarship', 30000);
  e2 := pg_temp.ledger('aa-u', sao, biz, 'S200', 'aid_credit', 'scholarship', 30000);
  e3 := pg_temp.ledger('aa-u', sao, biz, 'S100', 'charge', 'tuition', 30000);
  e4 := pg_temp.ledger('aa-u', sao, biz, 'S100', 'aid_credit', 'scholarship', 20000);
  e6 := pg_temp.ledger('aa-u', sao, biz, 'S100', 'aid_credit', 'scholarship', 30000);
  perform pg_temp.ledger('aa-u', aid, biz2, 'S100', 'reversal', 'scholarship', 30000, e6);
  e_far := pg_temp.ledger('aa-other', far_sao, far_biz, 'S100', 'aid_credit', 'scholarship', 30000);
  select count(*) into entries_before from public.student_account_entries;
  select count(*) into requests_before from public.student_account_requests;
  perform pg_temp.counted('the ledger the check built', entries_before, 7);

  perform pg_temp.refused_for('a disbursement for more than the award', aid,
    format($q$select public.aid_disbursement_record(%L, 50000, current_date, null, 'w1-d-over-key-001')$q$, w1), 'at most 40000 cents');
  perform pg_temp.refused_for('a disbursement dated in the future', aid,
    format($q$select public.aid_disbursement_record(%L, 10000, current_date + 30, null, 'w1-d-late-key-001')$q$, w1), 'today or earlier');
  perform pg_temp.refused_for('a student-accounts officer recording a disbursement', sao,
    format($q$select public.aid_disbursement_record(%L, 10000, current_date, null, 'sao-d-key-0000001')$q$, w1), 'aid:record');
  perform pg_temp.refused_for('a disbursement against an award not yet accepted', aid,
    format($q$select public.aid_disbursement_record(%L, 100, current_date, null, 'w5-d-offered-key-1')$q$, w5), 'accepted award');
  perform pg_temp.refused_for('linking another student''s aid credit', aid,
    format($q$select public.aid_disbursement_record(%L, 30000, current_date, %L, 'w1-d-other-key-01')$q$, w1, e2), 'not an aid credit on this student');
  perform pg_temp.refused_for('linking a charge', aid,
    format($q$select public.aid_disbursement_record(%L, 30000, current_date, %L, 'w1-d-charge-key-1')$q$, w1, e3), 'not an aid credit on this student');
  perform pg_temp.refused_for('linking an aid credit at another school', aid,
    format($q$select public.aid_disbursement_record(%L, 30000, current_date, %L, 'w1-d-far-key-0001')$q$, w1, e_far), 'not an aid credit on this student');
  perform pg_temp.refused_for('linking an entry that does not exist', aid,
    format($q$select public.aid_disbursement_record(%L, 30000, current_date, %L, 'w1-d-none-key-001')$q$, w1, gen_random_uuid()), 'not an aid credit on this student');
  perform pg_temp.refused_for('linking an aid credit for a different amount', aid,
    format($q$select public.aid_disbursement_record(%L, 30000, current_date, %L, 'w1-d-amount-key-1')$q$, w1, e4), 'is for 20000 cents');
  perform pg_temp.refused_for('linking an aid credit that has been reversed', aid,
    format($q$select public.aid_disbursement_record(%L, 30000, current_date, %L, 'w1-d-rev-key-0001')$q$, w1, e6), 'has been reversed');
  d1 := pg_temp.ask(aid, format($q$select public.aid_disbursement_record(%L, 10000, current_date, null, 'w1-d-part-key-001')$q$, w1))::uuid;
  perform pg_temp.said('a part disbursement, unlinked, leaves the award accepted', (select status from public.aid_awards where id = w1), 'accepted');
  d2 := pg_temp.ask(aid, format($q$select public.aid_disbursement_record(%L, 30000, current_date, %L, 'w1-d-rest-key-001')$q$, w1, e1))::uuid;
  perform pg_temp.said('the rest, linked to this student''s aid credit, is recorded with its id',
    (select ledger_entry_id::text from public.aid_disbursements where id = d2), e1::text);
  perform pg_temp.said('and the award is disbursed', (select status from public.aid_awards where id = w1), 'disbursed');
  perform pg_temp.said('by an entry of its history, by the same person',
    (select to_status || ' ' || (recorded_by = aid)::text from public.aid_award_history where award_id = w1 order by seq desc limit 1), 'disbursed true');
  perform pg_temp.said('the same key again answers the same disbursement',
    pg_temp.ask(aid, format($q$select public.aid_disbursement_record(%L, 30000, current_date, %L, 'w1-d-rest-key-001')$q$, w1, e1)), d2::text);
  perform pg_temp.counted('and wrote two disbursements in all', (select count(*) from public.aid_disbursements where award_id = w1), 2);
  perform pg_temp.refused_for('a disbursement after the award is whole', aid,
    format($q$select public.aid_disbursement_record(%L, 100, current_date, null, 'w1-d-more-key-001')$q$, w1), 'accepted award');
  perform pg_temp.works('the second award accepted, a control', aid,
    format($q$select public.aid_status_record(%L, 'accepted', 'The student accepted.', 'w5-accept-key-0001')$q$, w5));
  perform pg_temp.refused_for('using one aid credit for two disbursements', aid,
    format($q$select public.aid_disbursement_record(%L, 30000, current_date, %L, 'w5-d-twice-key-01')$q$, w5, e1), 'already linked to a disbursement');
  perform pg_temp.owner_refused_for('the same, written straight into the table',
    format($q$insert into public.aid_disbursements (tenant_id, award_id, student_ref, amount_cents, disbursed_on, ledger_entry_id, operation)
              values ('aa-u', %L, 'S100', 30000, current_date, %L, 'direct')$q$, w5, e1), 'duplicate key');
  perform pg_temp.owner_refused_for('editing a disbursement', format($q$update public.aid_disbursements set amount_cents = 1 where id = %L$q$, d1), 'append-only');
  perform pg_temp.owner_refused_for('deleting a disbursement', format($q$delete from public.aid_disbursements where id = %L$q$, d1), 'append-only');
  perform pg_temp.works('and a disbursement linked to a matching aid credit, a control', aid,
    format($q$select public.aid_disbursement_record(%L, 20000, current_date, %L, 'w5-d-e4-key-00001')$q$, w5, e4));
  perform pg_temp.said('a partial award stays accepted', (select status from public.aid_awards where id = w5), 'accepted');

  perform pg_temp.counted('NOTHING was written to the student-accounts ledger', (select count(*) from public.student_account_entries), entries_before);
  perform pg_temp.counted('nor to its requests', (select count(*) from public.student_account_requests), requests_before);
  perform pg_temp.counted('and no function here writes to it',
    (select count(*) from pg_proc p
      where p.proname ~ '^(admissions_|aid_|adm_aid_)'
        and p.prosrc ~* '(insert into|update|delete from)\s+public\.student_account'), 0);
  perform pg_temp.counted('(control: the probe does see a function that writes to it)',
    (select count(*) from pg_proc p
      where p.proname = 'student_account_request_guard' and p.prosrc ~* '(insert into|update|delete from)\s+public\.student_account'), 1);

  -- ── Financial aid: corrections and a fund that has been closed ────────────
  perform pg_temp.refused_for('an aid officer correcting an aid entry', aid,
    format($q$select public.aid_status_correct(%L, 'accepted', 3, 'The last entry was a mistake.', 'aid-fix-key-00002')$q$, w1), 'aid:approve_high');
  perform pg_temp.works('a business administrator correcting it, a control', biz,
    format($q$select public.aid_status_correct(%L, 'accepted', 3, 'The disbursement was entered against the wrong award.', 'biz-fix-key-000001')$q$, w1));
  perform pg_temp.said('as an entry of its own', (select kind || ' ' || corrects_seq || ' ' || to_status from public.aid_award_history where award_id = w1 order by seq desc limit 1), 'correction 3 accepted');
  w6 := pg_temp.ask(aid, $q$select public.aid_award_record('S100', '2026-2027', 'Campus Job', 'work_study', 10000, 'Offered.', 'award-w6-key-0001')$q$)::uuid;
  perform pg_temp.works('the student declining it', aid, format($q$select public.aid_status_record(%L, 'declined', 'The student declined.', 'w6-decline-key-001')$q$, w6));
  perform pg_temp.works('a declined fund making way for a new offer, a control', aid,
    $q$select public.aid_award_record('S100', '2026-2027', 'Campus Job', 'work_study', 12000, 'Offered again.', 'award-w6b-key-001')$q$);
  perform pg_temp.refused_for('a declined award coming back by a status', aid,
    format($q$select public.aid_status_record(%L, 'accepted', 'Changed its mind.', 'w6-back-key-000001')$q$, w6), 'does not move from declined to accepted');

  -- ── A student reads their own awards and disbursements, and nobody else's ──
  perform pg_temp.counted('Ana reads her awards, declined and offered included', pg_temp.seen(ana, 'select * from public.aid_awards'), 4);
  perform pg_temp.counted('and the disbursements against them', pg_temp.seen(ana, 'select * from public.aid_disbursements'), 3);
  perform pg_temp.counted('Ben reads none of hers', pg_temp.seen(ben, 'select * from public.aid_disbursements'), 0);
  perform pg_temp.counted('a student not linked reads no disbursements', pg_temp.seen(cal, 'select * from public.aid_disbursements'), 0);
  perform pg_temp.counted('the aid officer reads all of them', pg_temp.seen(aid, 'select * from public.aid_disbursements'), 3);
  perform pg_temp.counted('a registrar reads none', pg_temp.seen(reg, 'select * from public.aid_disbursements'), 0);

  -- ── No federal, tax or scoring columns, anywhere ──────────────────────────
  perform pg_temp.counted('no column of the new tables can hold federal or tax data',
    (select count(*) from information_schema.columns c
      where c.table_schema = 'public' and (c.table_name like 'admissions\_%' or c.table_name like 'aid\_%')
        and c.column_name ~* '(ssn|social|fafsa|isir|tax|citizen|federal|pell|title_iv|income|dob|birth)'), 0);
  perform pg_temp.counted('nor a score, rank or recommendation',
    (select count(*) from information_schema.columns c
      where c.table_schema = 'public' and (c.table_name like 'admissions\_%' or c.table_name like 'aid\_%')
        and c.column_name ~* '(score|rank|recommend|predict|rating|likelihood|yield|probab)'), 0);
  perform pg_temp.counted('(control: the probe does read their columns)',
    (select (count(*) > 30)::int from information_schema.columns c where c.table_schema = 'public' and (c.table_name like 'admissions\_%' or c.table_name like 'aid\_%')), 1);

  -- ── The mode, the kill switch and a frozen module ─────────────────────────
  perform pg_temp.counted('before the pause, Ana reads her awards', pg_temp.seen(ana, 'select * from public.aid_awards'), 4);
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason) values ('aa-u', 'kill.core_modules', true, 'drill');
  perform pg_temp.refused_for('an admissions step while Core modules are paused', reg,
    format($q$select public.admissions_status_record(%L, 'withdrawn', 'The applicant withdrew.', 'reg-pause-key-001')$q$, a5), 'paused');
  perform pg_temp.refused_for('an aid award while they are paused', aid,
    $q$select public.aid_award_record('S100', '2026-2027', 'Paused Grant', 'grant', 5000, 'Offered.', 'aid-pause-key-001')$q$, 'paused');
  perform pg_temp.counted('what was recorded is still readable', pg_temp.seen(ana, 'select * from public.aid_awards'), 4);
  perform pg_temp.counted('and the applicant files', pg_temp.seen(reg, 'select * from public.admissions_applicants'), 7);
  update public.feature_kill_switch set engaged = false where switch_key = 'kill.core_modules';
  perform pg_temp.works('an admissions step once it is lifted, a control', reg,
    format($q$select public.admissions_status_record(%L, 'withdrawn', 'The applicant withdrew.', 'reg-pause-key-002')$q$, a5));
  update public.tenant_module_mode set mode = 'connect', frozen = true where tenant_id = 'aa-u' and module = 'financial_aid';
  perform pg_temp.refused_for('an aid award in a frozen module', aid,
    $q$select public.aid_award_record('S100', '2026-2027', 'Frozen Grant', 'grant', 5000, 'Offered.', 'aid-frozen-key-01')$q$, 'has not switched financial aid');
  perform pg_temp.works('while admissions, a different module, is untouched, a control', reg,
    $q$select public.admissions_applicant_add('Fall 2027', 'A-8001', 'History, B.A.', 'Received.', 'adm-frozen-key-01')$q$);
  perform pg_temp.counted('and what aid recorded is still readable', pg_temp.seen(ana, 'select * from public.aid_awards'), 4);
  update public.tenant_module_mode set mode = 'core', frozen = false where tenant_id = 'aa-u' and module = 'financial_aid';
  perform pg_temp.refused_for('a registrar at a Connect school', conn_reg,
    $q$select public.admissions_applicant_add('Fall 2027', 'A-1001', 'Economics, B.A.', 'Received.', 'conn-add-key-0001')$q$, 'has not switched admissions');
  perform pg_temp.refused_for('an aid officer at a Connect school', conn_aid,
    $q$select public.aid_award_record('S100', '2026-2027', 'Merit Grant', 'grant', 40000, 'Offered.', 'conn-award-key-001')$q$, 'has not switched financial aid');

  -- ── Account deletion clears who recorded and leaves the record ────────────
  perform pg_temp.counted('before: awards recorded by the aid officer', (select count(*) from public.aid_awards where recorded_by = aid), 6);
  delete from auth.users where id = aid;
  perform pg_temp.counted('the awards stay', (select count(*) from public.aid_awards), 7);
  perform pg_temp.counted('no longer naming who recorded them', (select count(*) from public.aid_awards where recorded_by = aid), 0);
  perform pg_temp.counted('and the history stays', (select count(*) from public.aid_award_history), 13);
  perform pg_temp.counted('with the aid officer cleared from it', (select count(*) from public.aid_award_history where recorded_by is null), 11);
  delete from auth.users where id = reg;
  perform pg_temp.counted('the registrar''s applicants stay', (select count(*) from public.admissions_applicants where tenant_id = 'aa-u'), 8);
  perform pg_temp.counted('without naming them', (select count(*) from public.admissions_applicants where tenant_id = 'aa-u' and created_by is null), 8);

  -- A school is never deleted (20260930200000_school_offboarding.sql), so the
  -- append-only triggers' allowance for a school's removal is not reachable and
  -- is not exercised here; it is the same allowance student_account_append_only has.
  perform pg_temp.owner_refused_for('deleting a school that holds records',
    $q$delete from public.schools where id = 'aa-u'$q$, 'never deleted');

  raise notice 'admissions-aid.check: all checks passed';
end $$;

rollback;
