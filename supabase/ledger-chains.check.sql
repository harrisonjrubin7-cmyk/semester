-- The hash chain over the academic-record and student-account ledgers: that a
-- normal flow builds a chain the verifier accepts; that each kind of tampering
-- it claims to catch is caught, and reported as that kind; that the things that
-- legitimately change (a deleted clerk's account, the session's time zone, a
-- school's removal) are not mistaken for tampering; and that nobody reaches the
-- chain or the verifier through the API. Every tamper is attempted as the owner
-- with the protecting trigger switched off, which is the attacker the chain is
-- for, and is rolled back so the next one starts clean.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh ledger-chains

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

-- Verify as the operator: no user, no impersonated role.
create or replace function pg_temp.verify(which text, school text)
returns jsonb language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  return private.verify_ledger_chain(which, school);
end $$;

do $$
declare
  reg uuid; prof uuid; off1 uuid; off2 uuid; clerk uuid; far_reg uuid; far_prof uuid;
  r1 uuid; r3 uuid;
  v jsonb; kind text; i integer;
begin
  insert into public.schools (id, name, email_domains) values
    ('ch-u',     'Chain University', array['ch-u.example']),
    ('ch-other', 'Other University', array['ch-other.example']);

  reg      := pg_temp.newuser('reg@ch-u.example', 'ch-u');
  prof     := pg_temp.newuser('prof@ch-u.example', 'ch-u');
  clerk    := pg_temp.newuser('clerk@ch-u.example', 'ch-u');
  off1     := pg_temp.newuser('off1@ch-u.example', 'ch-u');
  off2     := pg_temp.newuser('off2@ch-u.example', 'ch-u');
  far_reg  := pg_temp.newuser('reg@ch-other.example', 'ch-other');
  far_prof := pg_temp.newuser('prof@ch-other.example', 'ch-other');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (reg,      'registrar',                'school', 'ch-u',     'institution'),
    (prof,     'faculty',                  'school', 'ch-u',     'institution'),
    (clerk,    'faculty',                  'school', 'ch-u',     'institution'),
    (off1,     'student_accounts_officer', 'school', 'ch-u',     'institution'),
    (off2,     'student_accounts_officer', 'school', 'ch-u',     'institution'),
    (far_reg,  'registrar',                'school', 'ch-other', 'institution'),
    (far_prof, 'faculty',                  'school', 'ch-other', 'institution');

  -- ── nothing yet: an empty chain verifies ───────────────────────────────
  v := pg_temp.verify('academic_record', 'ch-u');
  perform pg_temp.must('an empty chain verifies, with nothing checked',
    (v ->> 'ok')::boolean and (v ->> 'checked')::int = 0 and (v ->> 'unchained')::int = 0);

  -- ── build the academic chain through the real approval flow ────────────
  for i in 1..3 loop
    r1 := pg_temp.value_as(prof, format(
      $q$insert into public.academic_record_changes (tenant_id, student_ref, kind, subject_key, action, value, effective_on, reason, source)
         values ('ch-u', 'S100', 'grade', %L, 'set', %L, '2026-12-18', 'Posted from the final grade roster.', 'faculty') returning id$q$,
      'PSCI 210' || i || ' · Fall 2026', (array['A', 'B+', 'B'])[i]))::uuid;
    perform pg_temp.error_as(reg, format($q$update public.academic_record_changes set status = 'approved' where id = %L$q$, r1));
  end loop;
  -- One at the other school, so the chains can be told apart.
  r3 := pg_temp.value_as(far_prof, $q$insert into public.academic_record_changes (tenant_id, student_ref, kind, subject_key, action, value, effective_on, reason, source)
       values ('ch-other', 'S900', 'grade', 'ECON 1010 · Fall 2026', 'set', 'A', '2026-12-18', 'Posted from the final grade roster.', 'faculty') returning id$q$)::uuid;
  perform pg_temp.error_as(far_reg, format($q$update public.academic_record_changes set status = 'approved' where id = %L$q$, r3));

  perform pg_temp.must('three approvals made three entries at ch-u and one at the other school',
    (select count(*) from public.academic_record_entries where tenant_id = 'ch-u') = 3
    and (select count(*) from public.academic_record_entries where tenant_id = 'ch-other') = 1);
  perform pg_temp.must('each entry has a link, numbered from one and chained per school',
    (select array_agg(seq order by seq) from private.ledger_chain where ledger = 'academic_record' and tenant_id = 'ch-u') = array[1, 2, 3]::bigint[]
    and (select array_agg(seq) from private.ledger_chain where ledger = 'academic_record' and tenant_id = 'ch-other') = array[1]::bigint[]);
  perform pg_temp.must('the first link chains to zeros and each next to the one before',
    (select prev_hash = repeat('0', 64) from private.ledger_chain where ledger = 'academic_record' and tenant_id = 'ch-u' and seq = 1)
    and (select l2.prev_hash = l1.hash from private.ledger_chain l1 join private.ledger_chain l2
          on l2.ledger = l1.ledger and l2.tenant_id = l1.tenant_id and l2.seq = l1.seq + 1
         where l1.ledger = 'academic_record' and l1.tenant_id = 'ch-u' and l1.seq = 2));

  v := pg_temp.verify('academic_record', 'ch-u');
  perform pg_temp.must('the academic chain verifies',
    (v ->> 'ok')::boolean and (v ->> 'checked')::int = 3 and (v ->> 'unchained')::int = 0 and (v ->> 'before_chain')::int = 0);

  -- ── the student-account chain, through its real flow ───────────────────
  for i in 1..2 loop
    r1 := pg_temp.value_as(off1, format(
      $q$insert into public.student_account_requests (tenant_id, student_ref, kind, category, amount_cents, description, effective_on)
         values ('ch-u', 'S100', 'charge', 'tuition', %s, 'Fall 2026 charge', '2026-09-01') returning id$q$, 100000 * i))::uuid;
    perform pg_temp.error_as(off2, format($q$update public.student_account_requests set status = 'approved' where id = %L$q$, r1));
  end loop;
  v := pg_temp.verify('student_account', 'ch-u');
  perform pg_temp.must('the student-account chain verifies, with its own numbering',
    (v ->> 'ok')::boolean and (v ->> 'checked')::int = 2);

  -- ── what legitimately changes is not tampering ─────────────────────────
  set local timezone = 'America/New_York';
  v := pg_temp.verify('academic_record', 'ch-u');
  perform pg_temp.must('a different session time zone does not change a hash', (v ->> 'ok')::boolean);
  set local timezone = 'Pacific/Auckland';
  v := pg_temp.verify('student_account', 'ch-u');
  perform pg_temp.must('nor does another', (v ->> 'ok')::boolean);
  reset timezone;

  delete from auth.users where id = prof;
  perform pg_temp.must('the professor''s account deletion cleared the person column on the ledger',
    (select proposed_by is null from public.academic_record_entries where tenant_id = 'ch-u' order by recorded_at limit 1));
  v := pg_temp.verify('academic_record', 'ch-u');
  perform pg_temp.must('and the chain still verifies: person columns are outside the hash', (v ->> 'ok')::boolean);

  -- ── tampering, each rolled back ────────────────────────────────────────
  -- The attacker: the owner, with the protecting trigger off.
  kind := null;
  begin
    alter table public.academic_record_entries disable trigger academic_record_entries_append_only;
    update public.academic_record_entries set value = 'A+'
     where id = (select entry_id from private.ledger_chain where ledger = 'academic_record' and tenant_id = 'ch-u' and seq = 2);
    v := pg_temp.verify('academic_record', 'ch-u');
    raise exception 'rollback the tamper';
  exception when others then
    if sqlerrm <> 'rollback the tamper' then raise; end if;
  end;
  perform pg_temp.must('a rewritten entry is caught, at its link, as rewritten_entry',
    not (v ->> 'ok')::boolean and (v ->> 'first_break_seq')::int = 2 and v ->> 'first_break_kind' = 'rewritten_entry');

  begin
    -- A superuser can switch every trigger and foreign-key check off at once.
    set local session_replication_role = replica;
    delete from public.academic_record_entries
     where id = (select entry_id from private.ledger_chain where ledger = 'academic_record' and tenant_id = 'ch-u' and seq = 3);
    v := pg_temp.verify('academic_record', 'ch-u');
    raise exception 'rollback the tamper';
  exception when others then
    if sqlerrm <> 'rollback the tamper' then raise; end if;
  end;
  perform pg_temp.must('a removed entry is caught as removed_entry',
    not (v ->> 'ok')::boolean and (v ->> 'first_break_seq')::int = 3 and v ->> 'first_break_kind' = 'removed_entry');

  begin
    alter table private.ledger_chain disable trigger ledger_chain_immutable;
    delete from private.ledger_chain where ledger = 'academic_record' and tenant_id = 'ch-u' and seq = 2;
    v := pg_temp.verify('academic_record', 'ch-u');
    raise exception 'rollback the tamper';
  exception when others then
    if sqlerrm <> 'rollback the tamper' then raise; end if;
  end;
  perform pg_temp.must('a removed link is caught as removed_link',
    not (v ->> 'ok')::boolean and v ->> 'first_break_kind' = 'removed_link');

  begin
    alter table private.ledger_chain disable trigger ledger_chain_immutable;
    update private.ledger_chain set prev_hash = repeat('1', 64) where ledger = 'academic_record' and tenant_id = 'ch-u' and seq = 2;
    v := pg_temp.verify('academic_record', 'ch-u');
    raise exception 'rollback the tamper';
  exception when others then
    if sqlerrm <> 'rollback the tamper' then raise; end if;
  end;
  perform pg_temp.must('a link that does not follow its predecessor is caught as reordered_link',
    not (v ->> 'ok')::boolean and (v ->> 'first_break_seq')::int = 2 and v ->> 'first_break_kind' = 'reordered_link');

  begin
    alter table public.student_account_entries disable trigger chain_student_account_entries;
    insert into public.student_account_requests (id, tenant_id, student_ref, kind, category, amount_cents, description, effective_on, requested_by)
      values ('11111111-1111-1111-1111-111111111111', 'ch-u', 'S100', 'charge', 'fees', 999, 'slipped in', '2026-09-02', off1);
    insert into public.student_account_entries
      (tenant_id, student_ref, kind, category, amount_cents, description, provider_ref, effective_on, period, request_id, high_value)
      values ('ch-u', 'S100', 'charge', 'fees', 999, 'slipped in', '', '2026-09-02', '2026-09', '11111111-1111-1111-1111-111111111111', false);
    v := pg_temp.verify('student_account', 'ch-u');
    raise exception 'rollback the tamper';
  exception when others then
    if sqlerrm <> 'rollback the tamper' then raise; end if;
  end;
  perform pg_temp.must('an entry appended with the trigger off is caught as unchained_entry',
    not (v ->> 'ok')::boolean and v ->> 'first_break_kind' = 'unchained_entry' and (v ->> 'unchained')::int = 1);

  -- After all that rolling back, the real chain is untouched.
  perform pg_temp.must('every tamper was rolled back: both chains verify again',
    (pg_temp.verify('academic_record', 'ch-u') ->> 'ok')::boolean and (pg_temp.verify('student_account', 'ch-u') ->> 'ok')::boolean);

  -- ── the chain itself is as immutable as the ledger ─────────────────────
  begin
    update private.ledger_chain set hash = repeat('2', 64) where ledger = 'academic_record' and tenant_id = 'ch-u' and seq = 1;
    raise exception 'FAILED: a link was edited';
  exception when sqlstate '42501' then
    raise notice 'ok  a link cannot be edited, even by the owner';
  end;
  begin
    delete from private.ledger_chain where ledger = 'academic_record' and tenant_id = 'ch-u' and seq = 1;
    raise exception 'FAILED: a link was deleted';
  exception when sqlstate '42501' then
    raise notice 'ok  nor deleted while its school exists';
  end;

  -- ── nobody reaches it through the API ──────────────────────────────────
  perform pg_temp.says('a signed-in account cannot read the chain',
    pg_temp.error_as(reg, 'select * from private.ledger_chain'), 'permission denied');
  perform pg_temp.says('nor run the verifier',
    pg_temp.error_as(reg, $q$select private.verify_ledger_chain('academic_record', 'ch-u')$q$), 'permission denied');
  begin
    perform private.verify_ledger_chain('gradebook', 'ch-u');
    raise exception 'FAILED: an unknown ledger was accepted';
  exception when sqlstate '22023' then
    raise notice 'ok  the verifier refuses a ledger it does not know';
  end;

  -- ── a school's removal takes its chain with it ─────────────────────────
  -- The delete guard of 20260930200000 is off for this one proof of the
  -- cascade, inside a transaction that is rolled back.
  alter table public.schools disable trigger refuse_school_delete;
  delete from public.schools where id = 'ch-other';
  alter table public.schools enable trigger refuse_school_delete;
  perform pg_temp.must('removing a school removes its chain, and only its chain',
    not exists (select 1 from private.ledger_chain where tenant_id = 'ch-other')
    and exists (select 1 from private.ledger_chain where tenant_id = 'ch-u'));
end $$;

rollback;
