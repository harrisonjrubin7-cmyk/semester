-- The shared override log: that a correction of a grade already on the record
-- is logged by the ledger itself, whatever a client does; that the log says
-- what was decided, what replaced it and why; that a student reads only their
-- own, only when it was marked for them, and a stranger reads none; that the
-- direct path exists for other domains and is closed to the academic record;
-- that a row is never edited or deleted; and that the review view counts a
-- rule as recurring at three in ninety days, for reviewers only. Every refusal
-- is attempted as the account that should be refused.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh human-overrides

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, 'u_' || replace(split_part(address, '@', 1), '.', '_'), school);
  return who;
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

create or replace function pg_temp.seen(who uuid, q text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute 'select count(*) from (' || q || ') t' into n;
  execute 'reset role';
  return n;
end $$;

create or replace function pg_temp.must(what text, ok boolean)
returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok  %', what;
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
  if got is not null then raise exception 'FAILED: % — refused: %', what, got; end if;
  raise notice 'ok  %', what;
end $$;

-- Propose a grade as faculty; approve it as a registrar. Returns the change id.
create or replace function pg_temp.grade(prof uuid, approver uuid, subject text, val text, school text default 'ov-u', student text default 'S100', act text default 'set')
returns uuid language plpgsql as $$
declare c uuid;
begin
  c := pg_temp.value_as(prof, format(
    $q$insert into public.academic_record_changes (tenant_id, student_ref, kind, subject_key, action, value, effective_on, reason, source)
       values (%L, %L, 'grade', %L, %L, %L, '2026-12-18', 'Corrected after the grade appeal.', 'faculty') returning id$q$,
    school, student, subject, act, val))::uuid;
  perform pg_temp.error_as(approver, format($q$update public.academic_record_changes set status = 'approved' where id = %L$q$, c));
  return c;
end $$;

do $$
declare
  reg uuid; reg2 uuid; prof uuid; stu uuid; other_stu uuid; admin uuid; far_reg uuid; far_prof uuid;
  c uuid; n bigint; kept uuid; who_after uuid; req_id uuid; gid uuid; i integer;
begin
  insert into public.schools (id, name, email_domains) values
    ('ov-u',     'Override University', array['ov-u.example']),
    ('ov-other', 'Other University',    array['ov-other.example']);

  reg       := pg_temp.newuser('reg@ov-u.example', 'ov-u');
  reg2      := pg_temp.newuser('reg2@ov-u.example', 'ov-u');
  prof      := pg_temp.newuser('prof@ov-u.example', 'ov-u');
  stu       := pg_temp.newuser('stu@ov-u.example', 'ov-u');
  other_stu := pg_temp.newuser('other@ov-u.example', 'ov-u');
  admin     := pg_temp.newuser('admin@ov-u.example', 'ov-u');
  far_reg   := pg_temp.newuser('reg@ov-other.example', 'ov-other');
  far_prof  := pg_temp.newuser('prof@ov-other.example', 'ov-other');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (reg,       'registrar',        'school', 'ov-u',     'institution'),
    (reg2,      'registrar',        'school', 'ov-u',     'institution'),
    (prof,      'faculty',          'school', 'ov-u',     'institution'),
    (stu,       'student',          'school', 'ov-u',     'institution'),
    (other_stu, 'student',          'school', 'ov-u',     'institution'),
    (admin,     'university_admin', 'school', 'ov-u',     'institution'),
    (far_reg,   'registrar',        'school', 'ov-other', 'institution'),
    (far_prof,  'faculty',          'school', 'ov-other', 'institution');

  -- The registrar links the student's account to their record, so they can read it.
  perform pg_temp.runs_clean('a registrar links the student to their record',
    pg_temp.error_as(reg, format($q$insert into public.academic_record_subjects (tenant_id, student_ref, user_id) values ('ov-u', 'S100', %L)$q$, stu)));

  -- ── a first grade is not an override ───────────────────────────────────
  perform pg_temp.grade(prof, reg, 'PSCI 2100 · Fall 2026', 'B+');
  perform pg_temp.must('a first grade on a key logs nothing: nothing was overridden',
    (select count(*) from public.human_overrides) = 0);

  -- ── a correction is ─────────────────────────────────────────────────────
  perform pg_temp.grade(prof, reg2, 'PSCI 2100 · Fall 2026', 'A');
  perform pg_temp.must('correcting a grade already in effect logs exactly one override, by the ledger itself',
    (select count(*) from public.human_overrides where domain = 'academic_record') = 1);
  perform pg_temp.must('it names the domain, the rule, the subject, what the system had and what replaced it',
    (select rule_ref = 'grade' and subject_ref = 'S100' and automated_outcome = 'B+' and final_outcome = 'A'
       and tenant_id = 'ov-u' from public.human_overrides));
  perform pg_temp.must('it names who overrode it and why',
    (select overridden_by = reg2 and reason = 'Corrected after the grade appeal.' from public.human_overrides));
  perform pg_temp.must('it points back at the ledger entry it came from',
    (select source_ref = (select id::text from public.academic_record_entries where override) from public.human_overrides));
  perform pg_temp.must('and carries a plain-language explanation for the student',
    (select student_visible and explanation like '%corrected the grade for PSCI 2100 · Fall 2026 from B+ to A%' from public.human_overrides));

  -- ── who reads it ───────────────────────────────────────────────────────
  perform pg_temp.must('the linked student reads their own override',
    pg_temp.seen(stu, 'select * from public.human_overrides') = 1);
  perform pg_temp.must('another student at the school reads none',
    pg_temp.seen(other_stu, 'select * from public.human_overrides') = 0);
  perform pg_temp.must('a reviewer at the school reads it',
    pg_temp.seen(admin, 'select * from public.human_overrides') = 1);
  perform pg_temp.must('so does a registrar',
    pg_temp.seen(reg, 'select * from public.human_overrides') = 1);
  perform pg_temp.must('a registrar at another school reads none',
    pg_temp.seen(far_reg, 'select * from public.human_overrides') = 0);
  perform pg_temp.must('faculty, who proposed it, read none',
    pg_temp.seen(prof, 'select * from public.human_overrides') = 0);

  -- ── the direct path ────────────────────────────────────────────────────
  perform pg_temp.runs_clean('a registrar records a permission override, which no producer logs yet',
    pg_temp.error_as(reg, format($q$insert into public.human_overrides (tenant_id, domain, rule_ref, subject_ref, automated_outcome, final_outcome, reason, overridden_by)
      values ('ov-u', 'permission', 'role_grant.expiry', %L, 'expires in 30 days', 'no expiry', 'Standing appointment, per the dean.', %L)$q$, other_stu, reg)));
  perform pg_temp.says('but not as somebody else',
    pg_temp.error_as(reg, format($q$insert into public.human_overrides (tenant_id, domain, rule_ref, subject_ref, automated_outcome, final_outcome, reason, overridden_by)
      values ('ov-u', 'permission', 'role_grant.expiry', 'x', 'a', 'b', 'Somebody else did it.', %L)$q$, reg2)), 'row-level security');
  perform pg_temp.says('faculty cannot record one',
    pg_temp.error_as(prof, format($q$insert into public.human_overrides (tenant_id, domain, rule_ref, subject_ref, automated_outcome, final_outcome, reason, overridden_by)
      values ('ov-u', 'permission', 'role_grant.expiry', 'x', 'a', 'b', 'Not mine to record.', %L)$q$, prof)), 'row-level security');
  perform pg_temp.says('nor a registrar at another school, over this school',
    pg_temp.error_as(far_reg, format($q$insert into public.human_overrides (tenant_id, domain, rule_ref, subject_ref, automated_outcome, final_outcome, reason, overridden_by)
      values ('ov-u', 'permission', 'role_grant.expiry', 'x', 'a', 'b', 'Wrong school entirely.', %L)$q$, far_reg)), 'row-level security');
  perform pg_temp.says('nobody records an academic-record override by hand: the ledger logs its own',
    pg_temp.error_as(reg, format($q$insert into public.human_overrides (tenant_id, domain, rule_ref, subject_ref, automated_outcome, final_outcome, reason, overridden_by)
      values ('ov-u', 'academic_record', 'grade', 'S100', 'A', 'F', 'A made-up correction.', %L)$q$, reg)), 'row-level security');
  perform pg_temp.says('a reason is required',
    pg_temp.error_as(reg, format($q$insert into public.human_overrides (tenant_id, domain, rule_ref, subject_ref, automated_outcome, final_outcome, reason, overridden_by)
      values ('ov-u', 'permission', 'role_grant.expiry', 'x', 'a', 'b', ' ', %L)$q$, reg)), 'check constraint');
  perform pg_temp.says('a row cannot be shown to a student without words a student can read',
    pg_temp.error_as(reg, format($q$insert into public.human_overrides (tenant_id, domain, rule_ref, subject_ref, automated_outcome, final_outcome, reason, student_visible, overridden_by)
      values ('ov-u', 'permission', 'role_grant.expiry', 'x', 'a', 'b', 'Visible but unexplained.', true, %L)$q$, reg)), 'override_visible_is_explained');
  perform pg_temp.says('a rule name is a name, not a sentence',
    pg_temp.error_as(reg, format($q$insert into public.human_overrides (tenant_id, domain, rule_ref, subject_ref, automated_outcome, final_outcome, reason, overridden_by)
      values ('ov-u', 'permission', 'The student said so', 'x', 'a', 'b', 'Free text in a rule.', %L)$q$, reg)), 'check constraint');

  perform pg_temp.runs_clean('a registrar records one a student may read, with an explanation',
    pg_temp.error_as(reg, format($q$insert into public.human_overrides (tenant_id, domain, rule_ref, subject_ref, automated_outcome, final_outcome, reason, student_visible, explanation, overridden_by)
      values ('ov-u', 'permission', 'lab_access.default', %L, 'no access', 'access', 'Approved by the lab director.', true, 'You were given lab access outside the usual rule, by the lab director.', %L)$q$, other_stu, reg)));
  perform pg_temp.must('and that student reads exactly that one, not the other student''s',
    pg_temp.seen(other_stu, 'select * from public.human_overrides') = 1
    and pg_temp.seen(stu, 'select * from public.human_overrides') = 1);
  perform pg_temp.must('the row not marked for a student stays out of their sight',
    not exists (select 1 from public.human_overrides where rule_ref = 'role_grant.expiry' and student_visible));

  -- ── append-only ────────────────────────────────────────────────────────
  perform pg_temp.says('an override cannot be edited by the person who made it',
    pg_temp.error_as(reg, $q$update public.human_overrides set reason = 'Rewritten history.' where rule_ref = 'role_grant.expiry'$q$), 'permission denied');
  perform pg_temp.says('nor deleted',
    pg_temp.error_as(reg, $q$delete from public.human_overrides where rule_ref = 'role_grant.expiry'$q$), 'permission denied');
  begin
    update public.human_overrides set reason = 'Rewritten by the owner.' where rule_ref = 'role_grant.expiry';
    raise exception 'FAILED: the owner edited an override';
  exception when sqlstate '42501' then
    raise notice 'ok  not even by the owner';
  end;
  begin
    delete from public.human_overrides where rule_ref = 'role_grant.expiry';
    raise exception 'FAILED: the owner deleted an override';
  exception when sqlstate '42501' then
    raise notice 'ok  nor is it deleted by the owner';
  end;

  -- An account deletion clears the person and leaves the record.
  select id into kept from public.human_overrides where domain = 'academic_record';
  delete from auth.users where id = reg2;
  perform pg_temp.must('deleting the overriding account clears the person and keeps the override',
    (select overridden_by is null and final_outcome = 'A' from public.human_overrides where id = kept));

  -- ── voiding a grade is an override too, and must not break the approval ──
  perform pg_temp.grade(prof, reg, 'PSCI 2400 · Fall 2026', 'B');
  perform pg_temp.grade(prof, reg, 'PSCI 2400 · Fall 2026', '', 'ov-u', 'S100', 'void');
  perform pg_temp.must('voiding a grade on the record is approved and leaves an entry marked void',
    (select count(*) from public.academic_record_entries where subject_key = 'PSCI 2400 · Fall 2026' and action = 'void' and override) = 1);
  perform pg_temp.must('and it is logged as an override that says what was removed, not an empty outcome',
    (select final_outcome = 'removed from the record' and automated_outcome = 'B'
            and explanation like '%removed the grade for PSCI 2400 · Fall 2026 (it was B)%'
       from public.human_overrides where rule_ref = 'grade' and automated_outcome = 'B' and final_outcome <> 'A' order by occurred_at desc limit 1));

  -- ── the pattern view ───────────────────────────────────────────────────
  perform pg_temp.grade(prof, reg, 'PSCI 2200 · Fall 2026', 'C');
  perform pg_temp.grade(prof, reg, 'PSCI 2200 · Fall 2026', 'B');
  perform pg_temp.grade(prof, reg, 'PSCI 2300 · Fall 2026', 'D');
  perform pg_temp.grade(prof, reg, 'PSCI 2300 · Fall 2026', 'C');
  perform pg_temp.must('a reviewer sees the rule counted: three corrections and a void in ninety days is recurring',
    pg_temp.seen(admin, $q$select * from public.override_patterns where rule_ref = 'grade' and recurring and overrides = 4$q$) = 1);
  perform pg_temp.must('and a rule with fewer is listed, and not recurring',
    pg_temp.seen(admin, $q$select * from public.override_patterns where rule_ref = 'lab_access.default' and not recurring and overrides = 1$q$) = 1);
  perform pg_temp.must('the view is answered only to reviewers: a student sees no pattern at all',
    pg_temp.seen(stu, 'select * from public.override_patterns') = 0);
  perform pg_temp.must('nor does faculty',
    pg_temp.seen(prof, 'select * from public.override_patterns') = 0);
  perform pg_temp.must('a reviewer at another school sees none of this school''s',
    pg_temp.seen(far_reg, 'select * from public.override_patterns') = 0);
  -- The ninety-day line, with rows on both sides of it: five under one rule, two
  -- recent and three old. Counted, five; recurring, no.
  insert into public.human_overrides (tenant_id, domain, rule_ref, subject_ref, automated_outcome, final_outcome, reason, overridden_by, occurred_at)
    select 'ov-u', 'integration', 'sis.feed_hold', 'x', 'held', 'released', 'Feed corrected upstream.', admin, at
      from unnest(array[now() - interval '200 days', now() - interval '150 days', now() - interval '100 days',
                        now() - interval '20 days', now() - interval '2 days']) as at;
  perform pg_temp.must('five overrides, two of them recent: counted as five, not recurring',
    pg_temp.seen(admin, $q$select * from public.override_patterns where rule_ref = 'sis.feed_hold' and overrides = 5 and last_90_days = 2 and not recurring$q$) = 1);
  insert into public.human_overrides (tenant_id, domain, rule_ref, subject_ref, automated_outcome, final_outcome, reason, overridden_by, occurred_at)
    values ('ov-u', 'integration', 'sis.feed_hold', 'x', 'held', 'released', 'Feed corrected upstream again.', admin, now() - interval '1 day');
  perform pg_temp.must('a third in the window tips the same rule to recurring',
    pg_temp.seen(admin, $q$select * from public.override_patterns where rule_ref = 'sis.feed_hold' and overrides = 6 and last_90_days = 3 and recurring$q$) = 1);

  -- ── break-glass access is an override too ──────────────────────────────
  -- Built from the real tables, as the owner: the approval request the grant
  -- points at, then the grant. The trigger has to log it without being able to
  -- block it, so it is opened with the shortest inputs the grant table allows
  -- (a three-character ticket, one character of evidence) and the longest scope.
  perform set_config('request.jwt.claims', '', true);
  insert into public.approval_request (duty_id, requester, tenant_id, target, evidence, ticket, status)
    values ('break-glass', prof, 'ov-u', 'ov-u', 'x', 'T-1', 'executed') returning id into req_id;
  gid := gen_random_uuid();
  insert into public.break_glass_grant (id, request_id, subject, tenant_id, ticket, scope, expires_at, review_due)
    values (gid, req_id, prof, 'ov-u', 'T-1',
            'record:read ' || repeat('record:read ', 30) || 'record:read',
            now() + interval '3 hours', now() + interval '1 day');
  perform pg_temp.must('opening a break-glass grant logs a permission override, even with the shortest ticket and evidence and the longest scope',
    (select count(*) from public.human_overrides where domain = 'permission' and rule_ref = 'break_glass.access') = 1);
  perform pg_temp.must('it names the tenant, the account given access, what it replaced and what it became',
    (select tenant_id = 'ov-u' and subject_ref = prof::text and automated_outcome like 'no access outside%'
            and final_outcome like 'access for at most four hours: record:read%' and length(final_outcome) <= 300
       from public.human_overrides where rule_ref = 'break_glass.access'));
  perform pg_temp.must('it carries the ticket and the evidence as the reason, and points back at the grant',
    (select reason like 'T-1: x%' and source_ref = gid::text from public.human_overrides where rule_ref = 'break_glass.access'));
  perform pg_temp.must('it is a record for reviewers: not shown to the person given access',
    not (select student_visible from public.human_overrides where rule_ref = 'break_glass.access')
    and pg_temp.seen(prof, $q$select * from public.human_overrides where rule_ref = 'break_glass.access'$q$) = 0);
  perform pg_temp.must('a reviewer at the school sees it, and the pattern view counts it under its own rule',
    pg_temp.seen(admin, $q$select * from public.human_overrides where rule_ref = 'break_glass.access'$q$) = 1
    and pg_temp.seen(admin, $q$select * from public.override_patterns where domain = 'permission' and rule_ref = 'break_glass.access' and overrides = 1 and not recurring$q$) = 1);
  for i in 1..2 loop
    insert into public.approval_request (duty_id, requester, tenant_id, target, evidence, ticket, status)
      values ('break-glass', prof, 'ov-u', 'ov-u', 'Another outage', 'T-' || (i + 1), 'executed') returning id into req_id;
    insert into public.break_glass_grant (request_id, subject, tenant_id, ticket, scope, expires_at, review_due)
      values (req_id, prof, 'ov-u', 'T-' || (i + 1), 'record:read', now() + interval '2 hours', now() + interval '1 day');
  end loop;
  perform pg_temp.must('three break-glass grants at one school in ninety days make the rule recurring, whoever opened them',
    pg_temp.seen(admin, $q$select * from public.override_patterns where rule_ref = 'break_glass.access' and overrides = 3 and recurring$q$) = 1);

  -- ── a school's removal takes its log with it ───────────────────────────
  perform pg_temp.grade(far_prof, far_reg, 'ECON 1010 · Fall 2026', 'B', 'ov-other', 'S900');
  perform pg_temp.grade(far_prof, far_reg, 'ECON 1010 · Fall 2026', 'A', 'ov-other', 'S900');
  perform pg_temp.must('the other school''s override is logged in its own school',
    (select count(*) from public.human_overrides where tenant_id = 'ov-other') = 1);
  -- The delete guard of 20260930200000 is off for this one proof of the
  -- cascade, inside a transaction that is rolled back.
  alter table public.schools disable trigger refuse_school_delete;
  delete from public.schools where id = 'ov-other';
  alter table public.schools enable trigger refuse_school_delete;
  perform pg_temp.must('removing a school removes its overrides, and only its own',
    not exists (select 1 from public.human_overrides where tenant_id = 'ov-other')
    and exists (select 1 from public.human_overrides where tenant_id = 'ov-u'));
end $$;

rollback;
