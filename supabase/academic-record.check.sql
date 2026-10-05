-- The academic-record ledger (D-145): who may propose, decide and read; that
-- nobody writes the ledger but the approval of someone other than the
-- proposer; that each entry names the entry and value it replaced; that a
-- correction of a grade, standing or conferral needs a registrar override;
-- that the ledger is append-only for the owner too; that a linked student
-- reads their own record and no one else's; and that deleting an account
-- leaves the school's record standing. Every refusal is attempted as the
-- account that should be refused.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh academic-record

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
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', address, now(), now(), now());
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

create or replace function pg_temp.seen(who uuid, q text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute 'select count(*) from (' || q || ') t' into n;
  execute 'reset role';
  return n;
end $$;

create or replace function pg_temp.value_as(who uuid, q text)
returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.become(who);
  execute q into v;
  execute 'reset role';
  return v;
end $$;

create or replace function pg_temp.touched(who uuid, q text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute q;
  get diagnostics n = row_count;
  execute 'reset role';
  return n;
exception when others then
  execute 'reset role';
  return -1;
end $$;

create or replace function pg_temp.error_as(who uuid, q text)
returns text language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute q;
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlerrm;
end $$;

create or replace function pg_temp.says(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is null or position(want in got) = 0 then
    raise exception 'FAILED: % — expected "%", got "%"', what, want, got;
  end if;
  raise notice 'ok  % ("%")', what, want;
end $$;

create or replace function pg_temp.runs_clean(what text, got text)
returns void language plpgsql as $$
begin
  if got is not null then
    raise exception 'FAILED: % — refused: %', what, got;
  end if;
  raise notice 'ok  %', what;
end $$;

-- Propose a change as someone; returns its id.
create or replace function pg_temp.propose(who uuid, student text, kind text, subject text, val text, eff date,
                                          act text default 'set', src text default 'registrar', school text default 'ar-u')
returns uuid language plpgsql as $$
begin
  return pg_temp.value_as(who, format(
    'insert into public.academic_record_changes (tenant_id, student_ref, kind, subject_key, action, value, effective_on, reason, source)
     values (%L, %L, %L, %L, %L, %L, %L, %L, %L) returning id',
    school, student, kind, subject, act, val, eff, 'Posted from the final grade roster.', src))::uuid;
end $$;

create or replace function pg_temp.decide(who uuid, change uuid, to_status text)
returns text language plpgsql as $$
begin
  return pg_temp.error_as(who, format('update public.academic_record_changes set status = %L where id = %L', to_status, change));
end $$;

do $$
declare
  registrar uuid; registrar2 uuid; dean uuid; prof uuid; student uuid; other_student uuid; researcher uuid; far_registrar uuid;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid; c6 uuid; c7 uuid; c8 uuid; first_entry uuid;
  audits bigint;
begin
  insert into public.schools (id, name, email_domains) values
    ('ar-u', 'Academic Record University', array['ar-u.example']),
    ('ar-other', 'Other University', array['ar-other.example']);

  registrar     := pg_temp.newuser('registrar@ar-u.example', 'ar-u');
  registrar2    := pg_temp.newuser('registrar2@ar-u.example', 'ar-u');
  dean          := pg_temp.newuser('dean@ar-u.example', 'ar-u');
  prof          := pg_temp.newuser('prof@ar-u.example', 'ar-u');
  student       := pg_temp.newuser('student@ar-u.example', 'ar-u');
  other_student := pg_temp.newuser('other@ar-u.example', 'ar-u');
  researcher    := pg_temp.newuser('ir@ar-u.example', 'ar-u');
  far_registrar := pg_temp.newuser('registrar@ar-other.example', 'ar-other');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (registrar,     'registrar',                'school', 'ar-u',     'institution'),
    (registrar2,    'registrar',                'school', 'ar-u',     'institution'),
    (dean,          'dean',                     'school', 'ar-u',     'institution'),
    (prof,          'faculty',                  'school', 'ar-u',     'institution'),
    (student,       'student',                  'school', 'ar-u',     'institution'),
    (other_student, 'student',                  'school', 'ar-u',     'institution'),
    (researcher,    'institutional_researcher', 'school', 'ar-u',     'institution'),
    (far_registrar, 'registrar',                'school', 'ar-other', 'institution');

  -- ── nobody writes the ledger ───────────────────────────────────────────
  perform pg_temp.says('a registrar cannot write an entry directly',
    pg_temp.error_as(registrar, $q$insert into public.academic_record_entries (tenant_id, student_ref, kind, subject_key, action, value,
      effective_on, reason, source, change_id, override) values ('ar-u', 'S100', 'grade', 'PSCI 2100 · Fall 2026', 'set', 'A',
      '2026-12-18', 'straight in', 'registrar', gen_random_uuid(), false)$q$), 'permission denied');

  -- ── proposing ──────────────────────────────────────────────────────────
  c1 := pg_temp.propose(prof, 'S100', 'grade', 'PSCI 2100 · Fall 2026', 'B+', '2026-12-18', 'set', 'faculty');
  perform pg_temp.counted('a change is born proposed, by the account that proposed it',
    (select count(*) from public.academic_record_changes where id = c1 and status = 'proposed' and proposed_by = prof and entry_id is null), 1);
  perform pg_temp.says('a student cannot propose a change to a record',
    pg_temp.error_as(student, $q$insert into public.academic_record_changes (tenant_id, student_ref, kind, subject_key, value, effective_on, reason, source)
      values ('ar-u', 'S100', 'grade', 'PSCI 2100 · Fall 2026', 'A', '2026-12-18', 'I would like an A please', 'registrar')$q$), 'cannot propose');
  perform pg_temp.says('a registrar at another school cannot propose here',
    pg_temp.error_as(far_registrar, $q$insert into public.academic_record_changes (tenant_id, student_ref, kind, subject_key, value, effective_on, reason, source)
      values ('ar-u', 'S100', 'grade', 'X', 'A', '2026-12-18', 'Posted from the roster.', 'registrar')$q$), 'cannot propose');
  perform pg_temp.says('a change needs a reason',
    pg_temp.error_as(prof, $q$insert into public.academic_record_changes (tenant_id, student_ref, kind, subject_key, value, effective_on, reason, source)
      values ('ar-u', 'S100', 'grade', 'X', 'A', '2026-12-18', 'because', 'faculty')$q$), 'check constraint');
  perform pg_temp.says('a status sent with a proposal is ignored, not trusted',
    pg_temp.value_as(prof, $q$with t as (insert into public.academic_record_changes (tenant_id, student_ref, kind, subject_key, value, effective_on, reason, source, status)
      values ('ar-u', 'S100', 'credit', 'PSCI 2100 · Fall 2026', '3', '2026-12-18', 'Credit for the completed course.', 'faculty', 'approved') returning status) select status from t$q$), 'proposed');

  -- ── deciding ───────────────────────────────────────────────────────────
  perform pg_temp.says('the faculty member cannot approve', pg_temp.decide(prof, c1, 'approved'), 'cannot decide');
  perform pg_temp.says('a registrar at another school sees nothing to approve',
    coalesce(pg_temp.error_as(far_registrar, format($q$update public.academic_record_changes set status = 'approved' where id = %L$q$, c1)), 'untouched'), 'untouched');
  perform pg_temp.counted('and it is still proposed', (select count(*) from public.academic_record_changes where id = c1 and status = 'proposed'), 1);
  perform pg_temp.runs_clean('the registrar approves the professor''s grade', pg_temp.decide(registrar, c1, 'approved'));
  select entry_id into first_entry from public.academic_record_changes where id = c1;
  perform pg_temp.counted('approval wrote exactly one entry, naming both people and no prior value',
    (select count(*) from public.academic_record_entries where id = first_entry and change_id = c1 and value = 'B+'
       and proposed_by = prof and approved_by = registrar and previous_entry_id is null and previous_value is null and not override), 1);
  perform pg_temp.says('a decided change does not change again', pg_temp.decide(registrar2, c1, 'rejected'), 'does not change');
  perform pg_temp.says('a proposal is not edited once made',
    pg_temp.error_as(prof, format($q$update public.academic_record_changes set value = 'A' where id = %L$q$,
      pg_temp.propose(prof, 'S100', 'enrollment', 'ECON 1010 · Fall 2026', 'Enrolled', '2026-08-20', 'set', 'faculty'))), 'not edited');

  c2 := pg_temp.propose(registrar, 'S100', 'enrollment', 'PSCI 2100 · Fall 2026', 'Enrolled', '2026-08-20');
  perform pg_temp.says('a registrar does not approve their own change', pg_temp.decide(registrar, c2, 'approved'), 'does not decide it');
  perform pg_temp.says('another person cannot withdraw it', pg_temp.decide(registrar2, c2, 'withdrawn'), 'Only the person who proposed');
  perform pg_temp.runs_clean('the dean approves the registrar''s change', pg_temp.decide(dean, c2, 'approved'));

  -- ── corrections and overrides ──────────────────────────────────────────
  c3 := pg_temp.propose(prof, 'S100', 'grade', 'PSCI 2100 · Fall 2026', 'A-', '2027-01-15', 'set', 'appeal');
  perform pg_temp.says('correcting a posted grade is an override the dean does not hold', pg_temp.decide(dean, c3, 'approved'), 'registrar override');
  perform pg_temp.runs_clean('the registrar approves it as an override', pg_temp.decide(registrar, c3, 'approved'));
  perform pg_temp.counted('the correction is a new entry naming the one it replaced and its value',
    (select count(*) from public.academic_record_entries e join public.academic_record_changes c on c.entry_id = e.id
      where c.id = c3 and e.previous_entry_id = first_entry and e.previous_value = 'B+' and e.value = 'A-' and e.override), 1);
  perform pg_temp.counted('and the first entry is still there, unchanged',
    (select count(*) from public.academic_record_entries where id = first_entry and value = 'B+'), 1);

  -- A backdated change replaces what was in effect on its own date.
  c4 := pg_temp.propose(registrar2, 'S100', 'enrollment', 'HIST 1100 · Fall 2026', 'Enrolled', '2026-08-20');
  perform pg_temp.runs_clean('an enrollment is approved', pg_temp.decide(dean, c4, 'approved'));
  c5 := pg_temp.propose(registrar2, 'S100', 'enrollment', 'HIST 1100 · Fall 2026', '', '2026-09-10', 'void');
  perform pg_temp.runs_clean('a withdrawal from the course is recorded as a removal, not a deletion', pg_temp.decide(registrar, c5, 'approved'));
  perform pg_temp.counted('the removal names what it removed',
    (select count(*) from public.academic_record_entries e join public.academic_record_changes c on c.entry_id = e.id
      where c.id = c5 and e.action = 'void' and e.previous_value = 'Enrolled' and not e.override), 1);
  c6 := pg_temp.propose(registrar2, 'S100', 'standing', 'Fall 2026', '', '2026-12-20', 'void');
  perform pg_temp.says('nothing in effect cannot be removed', pg_temp.decide(registrar, c6, 'approved'), 'nothing in effect');
  perform pg_temp.runs_clean('a proposer withdraws their own change', pg_temp.decide(registrar2, c6, 'withdrawn'));
  c7 := pg_temp.propose(registrar2, 'S100', 'conferral', 'B.A. Political Science', 'Conferred', '2027-05-14');
  perform pg_temp.runs_clean('a first conferral is not an override, and the dean approves it', pg_temp.decide(dean, c7, 'approved'));
  c8 := pg_temp.propose(registrar2, 'S100', 'conferral', 'B.A. Political Science', '', '2027-06-01', 'void');
  perform pg_temp.says('rescinding a conferral is an override', pg_temp.decide(dean, c8, 'approved'), 'registrar override');
  perform pg_temp.runs_clean('a proposal can be rejected with a note', pg_temp.error_as(registrar,
    format($q$update public.academic_record_changes set status = 'rejected', decision_note = 'No rescission order on file.' where id = %L$q$, c8)));
  perform pg_temp.counted('a rejection writes no entry',
    (select count(*) from public.academic_record_changes where id = c8 and status = 'rejected' and entry_id is null and decided_by = registrar), 1);

  -- ── the ledger is append-only, for the owner too ───────────────────────
  perform pg_temp.says('a client cannot edit an entry',
    pg_temp.error_as(registrar, format($q$update public.academic_record_entries set value = 'A' where id = %L$q$, first_entry)), 'permission denied');
  begin
    update public.academic_record_entries set value = 'A' where id = first_entry;
    raise exception 'FAILED: the owner edited an entry';
  exception when insufficient_privilege then
    raise notice 'ok  the owner cannot edit an entry either';
  end;
  begin
    delete from public.academic_record_entries where id = first_entry;
    raise exception 'FAILED: the owner deleted an entry';
  exception when insufficient_privilege then
    raise notice 'ok  nor delete one';
  end;

  -- ── who reads what ─────────────────────────────────────────────────────
  perform pg_temp.counted('the registrar reads the whole ledger', pg_temp.seen(registrar, 'select * from public.academic_record_entries'), 6);
  perform pg_temp.counted('the dean reads it', pg_temp.seen(dean, 'select * from public.academic_record_entries'), 6);
  perform pg_temp.counted('the faculty member reads no entry', pg_temp.seen(prof, 'select * from public.academic_record_entries'), 0);
  perform pg_temp.counted('but reads the changes they proposed', pg_temp.seen(prof, 'select * from public.academic_record_changes'), 4);
  perform pg_temp.counted('an institutional researcher reads no individual record', pg_temp.seen(researcher, 'select * from public.academic_record_entries'), 0);
  perform pg_temp.counted('a registrar at another school reads none', pg_temp.seen(far_registrar, 'select * from public.academic_record_entries'), 0);
  perform pg_temp.counted('an unlinked student reads none', pg_temp.seen(student, 'select * from public.academic_record_entries'), 0);
  perform pg_temp.says('a student cannot link themselves to a record',
    pg_temp.error_as(student, format($q$insert into public.academic_record_subjects (tenant_id, student_ref, user_id) values ('ar-u', 'S100', %L)$q$, student)),
    'row-level security');
  perform pg_temp.runs_clean('the registrar links the student''s account to their record',
    pg_temp.error_as(registrar, format($q$insert into public.academic_record_subjects (tenant_id, student_ref, user_id) values ('ar-u', 'S100', %L)$q$, student)));
  perform pg_temp.counted('the linked student reads their own record', pg_temp.seen(student, 'select * from public.academic_record_entries'), 6);
  perform pg_temp.counted('but not the proposals behind it', pg_temp.seen(student, 'select * from public.academic_record_changes'), 0);
  perform pg_temp.counted('an unlinked student still reads none of it', pg_temp.seen(other_student, 'select * from public.academic_record_entries'), 0);
  -- The case that matters: a student linked to *their own* record, reading someone else's.
  perform pg_temp.runs_clean('a second student has a record of their own', pg_temp.decide(dean,
    pg_temp.propose(registrar, 'S200', 'enrollment', 'PSCI 2100 · Fall 2026', 'Enrolled', '2026-08-20'), 'approved'));
  perform pg_temp.runs_clean('and is linked to it',
    pg_temp.error_as(registrar, format($q$insert into public.academic_record_subjects (tenant_id, student_ref, user_id) values ('ar-u', 'S200', %L)$q$, other_student)));
  perform pg_temp.counted('a linked student reads their own record and nothing of anyone else''s',
    pg_temp.seen(other_student, 'select * from public.academic_record_entries'), 1);
  perform pg_temp.counted('not even by asking for it by identifier',
    pg_temp.seen(other_student, $q$select * from public.academic_record_entries where student_ref = 'S100'$q$), 0);

  -- ── audit ──────────────────────────────────────────────────────────────
  select count(*) into audits from public.tenant_policy_audit_event where tenant_id = 'ar-u' and entity_type like 'academic_record_%';
  -- Eleven proposals, nine decisions (eight approvals or rejections and one
  -- withdrawal), and two links: every write that succeeded, none that did not.
  perform pg_temp.counted('every change and link is audited, and nothing refused is', audits, 22);

  -- ── an account goes; the record stays ──────────────────────────────────
  perform set_config('request.jwt.claims', '', true);
  delete from auth.users where id = prof;
  perform pg_temp.counted('the professor''s entries stay, no longer naming them',
    (select count(*) from public.academic_record_entries where change_id in (c1, c3) and proposed_by is null), 2);
  delete from auth.users where id = student;
  perform pg_temp.counted('a student''s account deletion removes the link', (select count(*) from public.academic_record_subjects where student_ref = 'S100'), 0);
  perform pg_temp.counted('and the school''s record stays whole', (select count(*) from public.academic_record_entries where student_ref = 'S100'), 6);
end $$;

reset role;
do $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  perform count(*) from public.academic_record_entries;
  raise exception 'FAILED: anon read the ledger';
exception when insufficient_privilege then
  raise notice 'ok  anon cannot read the ledger';

  -- Two approvals at one moment on one record line: the guard locks the line
  -- before it reads what is in effect, so the second sees the first's entry.
  perform pg_temp.counted('the approval guard locks the record line before reading it',
    (select count(*) from pg_proc where proname = 'academic_record_change_guard'
      and position('pg_advisory_xact_lock' in prosrc) > 0
      and position('pg_advisory_xact_lock' in prosrc) < position('academic_record_in_effect' in prosrc)), 1);
end $$;
reset role;

rollback;
