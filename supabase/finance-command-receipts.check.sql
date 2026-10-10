-- Receipt-safe student-account commands. Synthetic fixtures only; always rolled back.
-- Run only through: supabase/check.sh finance-command-receipts

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
  values (who, replace(split_part(address, '@', 1), '.', '_'), school);
  return who;
end $$;

create or replace function pg_temp.call_as(who uuid, q text)
returns text language plpgsql as $$
declare answer text;
begin
  perform pg_temp.become(who);
  execute q into answer;
  execute 'reset role';
  return answer;
exception when others then
  execute 'reset role';
  raise;
end $$;

create or replace function pg_temp.error_as(who uuid, q text)
returns text language plpgsql as $$
begin
  perform pg_temp.call_as(who, q);
  return null;
exception when others then return sqlerrm;
end $$;

create or replace function pg_temp.assert(what text, ok boolean)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
  raise notice 'ok  %', what;
end $$;

do $$
declare
  maker uuid; checker uuid; admin uuid; outsider uuid; student uuid;
  first jsonb; replay jsonb; req_id uuid; version bigint;
  key1 text := 'finance-request-0001';
begin
  insert into public.schools (id, name, email_domains) values
    ('fin-u', 'Finance U', array['fin-u.example']),
    ('fin-other', 'Other Finance U', array['fin-other.example']);
  maker := pg_temp.newuser('maker@fin-u.example', 'fin-u');
  checker := pg_temp.newuser('checker@fin-u.example', 'fin-u');
  admin := pg_temp.newuser('admin@fin-u.example', 'fin-u');
  student := pg_temp.newuser('student@fin-u.example', 'fin-u');
  outsider := pg_temp.newuser('outsider@fin-other.example', 'fin-other');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (maker, 'student_accounts_officer', 'school', 'fin-u', 'institution'),
    (checker, 'student_accounts_officer', 'school', 'fin-u', 'institution'),
    (admin, 'business_admin', 'school', 'fin-u', 'institution'),
    (outsider, 'student_accounts_officer', 'school', 'fin-other', 'institution'),
    (student, 'student', 'school', 'fin-u', 'institution');
  insert into public.academic_record_subjects (tenant_id, student_ref, user_id)
  values ('fin-u', 'S100', student);

  first := pg_temp.call_as(maker, format($q$
    select public.finance_command('fin-u','S100','request.create',%L,null,
      '{"kind":"charge","category":"tuition","amount_cents":250000,"description":"Fall tuition","reference_entry_id":null,"provider_ref":"","effective_on":"2026-10-01"}'::jsonb)::text$q$, key1))::jsonb;
  replay := pg_temp.call_as(maker, format($q$
    select public.finance_command('fin-u','S100','request.create',%L,null,
      '{"provider_ref":"","effective_on":"2026-10-01","reference_entry_id":null,"description":"Fall tuition","amount_cents":250000,"category":"tuition","kind":"charge"}'::jsonb)::text$q$, key1))::jsonb;
  perform pg_temp.assert('an ambiguous retry returns the byte-stable accepted receipt', first = replay and first->>'status' = 'accepted');
  req_id := (first->>'resourceId')::uuid;
  version := (first->>'version')::bigint;
  perform pg_temp.assert('one request, receipt, audit and outbox event exist',
    (select count(*) = 1 from public.student_account_requests where id = req_id)
    and (select count(*) = 1 from private.finance_command_receipts where command_key = key1)
    and (select count(*) = 1 from public.tenant_policy_audit_event where entity_type = 'student_account_requests' and entity_id = req_id::text)
    and (select count(*) = 1 from private.domain_outbox_events where aggregate_type = 'finance_command' and aggregate_id = (first->>'id')));

  perform pg_temp.assert('the key is payload-bound', position('different finance command' in pg_temp.error_as(maker, format($q$
    select public.finance_command('fin-u','S100','request.create',%L,null,
      '{"kind":"charge","category":"fees","amount_cents":1,"description":"Different fee","reference_entry_id":null,"provider_ref":"","effective_on":"2026-10-01"}'::jsonb)$q$, key1))) > 0);
  perform pg_temp.assert('the key is actor-bound', position('different finance command' in pg_temp.error_as(checker, format($q$
    select public.finance_command('fin-u','S100','request.create',%L,null,
      '{"kind":"charge","category":"tuition","amount_cents":250000,"description":"Fall tuition","reference_entry_id":null,"provider_ref":"","effective_on":"2026-10-01"}'::jsonb)$q$, key1))) > 0);
  perform pg_temp.assert('the key is tenant-bound', position('different finance command' in pg_temp.error_as(outsider, format($q$
    select public.finance_command('fin-other','S100','request.create',%L,null,
      '{"kind":"charge","category":"tuition","amount_cents":250000,"description":"Fall tuition","reference_entry_id":null,"provider_ref":"","effective_on":"2026-10-01"}'::jsonb)$q$, key1))) > 0);
  perform pg_temp.assert('the key is action-bound', position('different finance command' in pg_temp.error_as(maker, format($q$
    select public.finance_command('fin-u','S100','request.withdraw',%L,%s,jsonb_build_object('request_id',%L))$q$, key1, version, req_id))) > 0);
  perform pg_temp.assert('a maker cannot approve their own request', position('does not decide it' in pg_temp.error_as(maker, format($q$
    select public.finance_command('fin-u','S100','request.approve','test-command-11111111',%s,jsonb_build_object('request_id',%L,'note',''))$q$, version, req_id))) > 0);

  first := pg_temp.call_as(checker, format($q$
    select public.finance_command('fin-u','S100','request.approve','test-command-22222222',%s,jsonb_build_object('request_id',%L,'note',''))::text$q$, version, req_id))::jsonb;
  replay := pg_temp.call_as(checker, format($q$
    select public.finance_command('fin-u','S100','request.approve','test-command-22222222',%s,jsonb_build_object('note','','request_id',%L))::text$q$, version, req_id))::jsonb;
  perform pg_temp.assert('an approval retry has one receipt and one ledger effect', first = replay
    and (select count(*) = 1 from public.student_account_entries where request_id = req_id)
    and (select count(*) = 1 from private.finance_command_receipts where command_key = 'test-command-22222222'));
  perform pg_temp.assert('a stale expected version is an explicit conflict', position('version conflict' in pg_temp.error_as(admin, format($q$
    select public.finance_command('fin-u','S100','request.reject','finance-reject-0001',%s,jsonb_build_object('request_id',%L,'note','late'))$q$, version, req_id))) > 0);
  perform pg_temp.assert('a foreign actor cannot recover the receipt', position('cannot read that finance receipt' in pg_temp.error_as(outsider,
    format($q$select public.finance_command_receipt('fin-u','S100','request.approve','test-command-22222222')$q$))) > 0);
  perform pg_temp.assert('the original actor cannot cross-read another student with the key', position('cannot read that finance receipt' in pg_temp.error_as(checker,
    format($q$select public.finance_command_receipt('fin-u','S999','request.approve','test-command-22222222')$q$))) > 0);

  -- Force the final atomic write to fail. The decision, ledger trigger, audit,
  -- receipt and event must all roll back with it.
  first := pg_temp.call_as(maker, $q$
    select public.finance_command('fin-u','S100','request.create','finance-atomic-create',null,
      jsonb_build_object('kind','charge','category','fees','amount_cents',3000,'description','Atomic fee',
        'reference_entry_id',null,'provider_ref','','effective_on',current_date))::text$q$)::jsonb;
  req_id := (first->>'resourceId')::uuid;
  alter table private.domain_outbox_events add constraint finance_fixture_reject_event
    check (aggregate_type <> 'finance_command') not valid;
  perform pg_temp.assert('an outbox failure rejects the command', pg_temp.error_as(admin, format($q$
    select public.finance_command('fin-u','S100','request.approve','test-command-33333333',1,
      jsonb_build_object('request_id',%L,'note','checked'))$q$, req_id)) is not null);
  perform pg_temp.assert('decision, ledger, audit, receipt and outbox roll back together',
    (select status = 'proposed' from public.student_account_requests where id = req_id)
    and not exists (select 1 from public.student_account_entries where request_id = req_id)
    and not exists (select 1 from private.finance_command_receipts where command_key = 'test-command-33333333')
    and (select count(*) = 1 from public.tenant_policy_audit_event where entity_type = 'student_account_requests' and entity_id = req_id::text)
    and not exists (select 1 from private.domain_outbox_events where idempotency_key = 'test-command-33333333'));
  alter table private.domain_outbox_events drop constraint finance_fixture_reject_event;

  first := pg_temp.call_as(maker, $q$
    select public.finance_command('fin-u','S100','request.create','finance-reject-create',null,
      jsonb_build_object('kind','charge','category','fees','amount_cents',3100,'description','Reject fee',
        'reference_entry_id',null,'provider_ref','','effective_on',current_date))::text$q$)::jsonb;
  req_id := (first->>'resourceId')::uuid;
  first := pg_temp.call_as(admin, format($q$
    select public.finance_command('fin-u','S100','request.reject','finance-reject-success',1,
      jsonb_build_object('request_id',%L,'note','not owed'))::text$q$, req_id))::jsonb;
  perform pg_temp.assert('a rejection commits its receipt and no ledger entry', first->>'state' = 'rejected'
    and not exists (select 1 from public.student_account_entries where request_id = req_id));

  first := pg_temp.call_as(maker, $q$
    select public.finance_command('fin-u','S100','request.create','finance-withdraw-create',null,
      jsonb_build_object('kind','charge','category','fees','amount_cents',3200,'description','Withdraw fee',
        'reference_entry_id',null,'provider_ref','','effective_on',current_date))::text$q$)::jsonb;
  req_id := (first->>'resourceId')::uuid;
  first := pg_temp.call_as(maker, format($q$
    select public.finance_command('fin-u','S100','request.withdraw','finance-withdraw-success',1,
      jsonb_build_object('request_id',%L,'note',''))::text$q$, req_id))::jsonb;
  perform pg_temp.assert('a withdrawal commits its receipt and no ledger entry', first->>'state' = 'withdrawn'
    and not exists (select 1 from public.student_account_entries where request_id = req_id));

  update public.role_grants set revoked_at = now() where subject = checker and role = 'student_accounts_officer';
  perform pg_temp.assert('a revoked role cannot recover a receipt', position('cannot read that finance receipt' in pg_temp.error_as(checker,
    format($q$select public.finance_command_receipt('fin-u','S100','request.approve','test-command-22222222')$q$))) > 0);

  first := pg_temp.call_as(student, $q$
    select public.finance_command('fin-u','S100','plan.request','finance-plan-000001',null,
      jsonb_build_object('installments',3,'first_due',current_date + 7))::text$q$)::jsonb;
  replay := pg_temp.call_as(student, $q$
    select public.finance_command('fin-u','S100','plan.request','finance-plan-000001',null,
      jsonb_build_object('first_due',current_date + 7,'installments',3))::text$q$)::jsonb;
  perform pg_temp.assert('a payment-plan retry returns one receipt and one plan', first = replay
    and (select count(*) = 1 from public.student_payment_plans where id = (first->>'resourceId')::uuid));

  -- Historical clients remain temporarily writable through the old table path.
  perform pg_temp.become(maker);
  insert into public.student_account_requests
    (tenant_id, student_ref, kind, category, amount_cents, description, effective_on)
  values ('fin-u','S101','charge','fees',5000,'Legacy direct request','2026-10-02');
  execute 'reset role';
  perform pg_temp.assert('a legacy direct write still works but has no command receipt',
    (select count(*) = 1 from public.student_account_requests where student_ref = 'S101')
    and (select count(*) = 0 from private.finance_command_receipts where student_ref = 'S101'));

  perform pg_temp.assert('the command serializes before looking up a receipt',
    (select position('pg_advisory_xact_lock' in prosrc) > 0
       and position('pg_advisory_xact_lock' in prosrc) < position('from private.finance_command_receipts' in prosrc)
       from pg_proc where oid = 'public.finance_command(text,text,text,text,bigint,jsonb)'::regprocedure));
  perform pg_temp.assert('receipt recovery joins the same lock before looking up a receipt',
    (select position('pg_advisory_xact_lock' in prosrc) > 0
       and position('pg_advisory_xact_lock' in prosrc) < position('from private.finance_command_receipts' in prosrc)
       from pg_proc where oid = 'public.finance_command_receipt(text,text,text,text)'::regprocedure));
end $$;

rollback;
