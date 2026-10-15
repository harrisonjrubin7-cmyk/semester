-- supabase/registration_hardening.check.sql — for 20261014000000_registration_hardening.sql.
-- Same harness as supabase/registration_transaction.check.sql; its helpers are inlined below, so this runs alone.
-- Everything rolls back.
--
--   How to run it: supabase/check.sh registration_hardening
--
-- Holds the patch to:
--   * every registration, ledger and gradebook table forces RLS;
--   * an enrollment or override can't reference another school's section;
--   * an override can't be self-approved, stops counting once expired or used up,
--     and is used once each time a student it covers is enrolled or promoted;
--   * a swap into a full section leaves the original enrollment; a swap replays by key;
--   * an approved ledger entry carries the change's policy version; a missing one is stamped 'unversioned'
--     until the school requires it, then refused.

begin;
-- Helpers: verbatim from supabase/registration_transaction.check.sql (main @27103d1), so this file runs on its own.
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

create or replace function pg_temp.said(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.call(who uuid, statement text)
returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform pg_temp.become(who);
  execute statement into r;
  execute 'reset role';
  return r;
exception when others then
  execute 'reset role';
  return jsonb_build_object('raised', sqlerrm);
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

create or replace function pg_temp.refused(what text, who uuid, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;

create or replace function pg_temp.reason(who uuid, statement text)
returns text language plpgsql as $$
declare r jsonb := pg_temp.call(who, statement);
begin
  return coalesce(r->>'reason', 'raised: ' || (r->>'raised'));
end $$;

do $$
declare
  ana uuid; ben uuid; reg uuid; reg2 uuid; far uuid;
  math uuid; hist uuid; full_ uuid; theirs uuid;
  r jsonb; n bigint; ref text := 'HZ-0001'; ch uuid;
begin
  insert into public.schools (id, name, email_domains) values
    ('hz-u', 'Hardening University', array['hz-u.example']),
    ('hz-other', 'Other University', array['hz-other.example']);
  ana  := pg_temp.newuser('ana@hz-u.example', 'hz-u');
  ben  := pg_temp.newuser('ben@hz-u.example', 'hz-u');
  reg  := pg_temp.newuser('registrar@hz-u.example', 'hz-u');
  reg2 := pg_temp.newuser('registrar2@hz-u.example', 'hz-u');
  far  := pg_temp.newuser('registrar@hz-other.example', 'hz-other');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (reg, 'registrar', 'school', 'hz-u', 'institution'), (reg2, 'registrar', 'school', 'hz-u', 'institution'),
    (far, 'registrar', 'school', 'hz-other', 'institution');
  insert into public.tenant_feature_policy (tenant_id, capability, state) values
    ('hz-u', 'writeback.registration_submit', 'production'), ('hz-other', 'writeback.registration_submit', 'production');

  perform pg_temp.become(reg);
  perform public.registrar_put_term('2026FA', now() - interval '1 day', now() + interval '1 day', now() + interval '10 days', 12);
  math  := public.registrar_put_section('2026FA', 'MATH 101', '01', 'Calculus I', 4, 5, 0, '[{"days":[1,3],"start":540,"end":590}]', '{}', false);
  hist  := public.registrar_put_section('2026FA', 'HIST 100', '01', 'World History', 3, 5, 0, '[{"days":[2,4],"start":540,"end":590}]', '{}', false);
  full_ := public.registrar_put_section('2026FA', 'CHEM 110', '01', 'Chemistry', 4, 0, 0, '[{"days":[5],"start":780,"end":900}]', '{}', false);
  reset role;
  perform pg_temp.become(far);
  perform public.registrar_put_term('2026FA', now() - interval '1 day', now() + interval '1 day', now() + interval '10 days', 12);
  theirs := public.registrar_put_section('2026FA', 'MATH 101', '01', 'Their calculus', 4, 5, 0, '[]', '{}', false);
  reset role;

  -- ── 1. Forced RLS ──
  perform pg_temp.counted('registration, ledger and gradebook tables that do not force RLS',
    (select count(*) from pg_class c join pg_namespace s on s.oid = c.relnamespace
      where s.nspname = 'public' and c.relkind = 'r' and not c.relforcerowsecurity
        and (c.relname like 'registration\_%' or c.relname like 'academic\_record\_%'
             or c.relname like 'gradebook\_%' or c.relname in ('grade_entries','regrade_requests','regrade_resolutions','grade_passbacks'))), 0);

  -- ── 2. Tenant-consistent references (as the table owner, so only the constraint can stop it) ──
  begin
    insert into public.registration_enrollments (tenant_id, section_id, student, state) values ('hz-u', theirs, ana, 'enrolled');
    raise exception 'FAILED: an enrollment at hz-u pointed at another school''s section';
  exception when foreign_key_violation then raise notice 'ok  cross-school enrollment refused by the composite key';
  end;
  begin
    insert into public.registration_overrides (tenant_id, section_id, student, waives, reason) values ('hz-u', theirs, ana, array['capacity'], 'test');
    raise exception 'FAILED: an override at hz-u pointed at another school''s section';
  exception when foreign_key_violation then raise notice 'ok  cross-school override refused by the composite key';
  end;

  -- ── 3. Overrides: separation of duties, expiry, use counting ──
  begin
    insert into public.registration_overrides (tenant_id, section_id, student, waives, reason, requested_by, granted_by)
      values ('hz-u', math, ana, array['capacity'], 'self-approved', reg, reg);
    raise exception 'FAILED: a self-approved override was stored';
  exception when check_violation then raise notice 'ok  an override approved by its requester is refused';
  end;
  insert into public.registration_overrides (tenant_id, section_id, student, waives, reason, valid_until)
    values ('hz-u', hist, ana, array['prerequisite'], 'expired one', now() - interval '1 minute');
  perform pg_temp.counted('an expired waiver no longer counts', private.registration_waived(ana, hist, 'prerequisite')::int, 0);

  insert into public.registration_overrides (tenant_id, section_id, student, waives, reason, requested_by, granted_by, uses_allowed)
    values ('hz-u', full_, ben, array['capacity'], 'one seat over capacity', reg2, reg, 1);
  perform pg_temp.counted('before use, the capacity waiver counts', private.registration_waived(ben, full_, 'capacity')::int, 1);
  r := pg_temp.call(ben, format($q$select public.registration_enroll(%L, 'hz-ben-0001')$q$, full_));
  perform pg_temp.said('ben enrolls over capacity on the waiver', r->>'outcome', 'enrolled');
  perform pg_temp.counted('the enrollment used the override once',
    (select uses from public.registration_overrides where student = ben and section_id = full_), 1);
  perform pg_temp.counted('and a used-up waiver no longer counts', private.registration_waived(ben, full_, 'capacity')::int, 0);
  r := pg_temp.call(ben, format($q$select public.registration_enroll(%L, 'hz-ben-0001')$q$, full_));
  perform pg_temp.said('a replay of that enrollment', r->>'replayed', 'true');
  perform pg_temp.counted('does not use the override a second time',
    (select uses from public.registration_overrides where student = ben and section_id = full_), 1);

  -- ── 4–5. Swap ──  (was "wire to harness fixtures"; now self-contained)
  r := pg_temp.call(ana, format($q$select public.registration_enroll(%L, 'hz-ana-0001')$q$, math));
  perform pg_temp.said('ana enrolls in MATH 101', r->>'outcome', 'enrolled');
  r := pg_temp.call(ana, format($q$select public.registration_swap(%L, %L, 'hz-ana-swap-01')$q$, math, full_));
  perform pg_temp.said('a swap into a full section is refused', r->>'reason', 'swap_add_refused');
  perform pg_temp.counted('and ana is still enrolled in MATH 101',
    (select count(*) from public.registration_enrollments where student = ana and section_id = math and state = 'enrolled'), 1);
  perform pg_temp.counted('with no drop recorded for it',
    (select count(*) from public.registration_audit_event where student = ana and section_id = math and action = 'dropped'), 0);
  r := pg_temp.call(ana, format($q$select public.registration_swap(%L, %L, 'hz-ana-swap-02')$q$, math, hist));
  perform pg_temp.said('a swap into a section with room', r->>'outcome', 'swapped');
  perform pg_temp.counted('leaves ana in HIST 100 and out of MATH 101',
    (select count(*) from public.registration_enrollments where student = ana and state = 'enrolled' and section_id in (hist)) -
    (select count(*) from public.registration_enrollments where student = ana and state = 'enrolled' and section_id in (math)), 1);
  r := pg_temp.call(ana, format($q$select public.registration_swap(%L, %L, 'hz-ana-swap-02')$q$, math, hist));
  perform pg_temp.said('the same swap key again replays', r->>'replayed', 'true');
  perform pg_temp.said('the same swap key for other sections is refused',
    pg_temp.reason(ana, format($q$select public.registration_swap(%L, %L, 'hz-ana-swap-02')$q$, hist, math)), 'idempotency_conflict');

  -- ── 6. Ledger entries carry the policy version ──
  insert into public.academic_record_subjects (tenant_id, student_ref, user_id) values ('hz-u', ref, ana);
  perform pg_temp.become(reg);
  insert into public.academic_record_changes (tenant_id, student_ref, kind, subject_key, action, value, effective_on, reason, source, policy_version)
    values ('hz-u', ref, 'grade', 'MATH 101 2026FA', 'set', 'A-', current_date, 'Final grade posted by the registrar', 'registrar', 'grading-2026-v1')
    returning id into ch;
  reset role;
  perform pg_temp.become(reg);
  insert into public.academic_record_changes (tenant_id, student_ref, kind, subject_key, action, value, effective_on, reason, source)
    values ('hz-u', ref, 'grade', 'ARTS 100 2026FA', 'set', 'B+', current_date, 'Older writer with no policy version', 'registrar');
  reset role;
  perform pg_temp.said('while the school has not required it, a missing version is stamped, not hidden',
    (select policy_version from public.academic_record_changes where subject_key = 'ARTS 100 2026FA'), 'unversioned');
  insert into public.tenant_feature_policy (tenant_id, capability, state) values ('hz-u', 'records.require_policy_version', 'production');
  perform pg_temp.refused('once required, a grade change with no policy version', reg,
    $q$insert into public.academic_record_changes (tenant_id, student_ref, kind, subject_key, action, value, effective_on, reason, source)
       values ('hz-u', 'HZ-0001', 'grade', 'HIST 100 2026FA', 'set', 'B', current_date, 'Missing its policy version', 'registrar')$q$);
  perform pg_temp.become(reg2);
  update public.academic_record_changes set status = 'approved' where id = ch;
  reset role;
  perform pg_temp.said('the approved entry carries the change''s policy version',
    (select policy_version from public.academic_record_entries where change_id = ch), 'grading-2026-v1');
end $$;

rollback;
