-- Student accounts (D-146): nobody writes the ledger but the approval of
-- someone other than the requester; above the threshold only a high-value
-- approver approves; whoever put a payment on the ledger does not approve its
-- refund; a refund never returns more than is left; an entry is reversed once,
-- in full; no card number is stored; a month closes only on a passing
-- reconciliation recorded by someone else with nothing waiting, and then takes
-- nothing new; the ledger is append-only for the owner too; a linked student
-- reads their own account and no one else's; and an account's deletion leaves
-- the school's record standing. Every refusal is attempted as the account that
-- should be refused.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh student-accounts

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

-- A request as someone; returns its id.
create or replace function pg_temp.request(who uuid, kind text, category text, cents bigint, eff date,
                                          ref uuid default null, provider text default '', student text default 'S100')
returns uuid language plpgsql as $$
begin
  return pg_temp.value_as(who, format(
    'insert into public.student_account_requests (tenant_id, student_ref, kind, category, amount_cents, description, reference_entry_id, provider_ref, effective_on)
     values (''sa-u'', %L, %L, %L, %s, %L, %L, %L, %L) returning id',
    student, kind, category, cents, 'Fall 2026 ' || kind, ref, provider, eff))::uuid;
end $$;

create or replace function pg_temp.decide(who uuid, req uuid, to_status text)
returns text language plpgsql as $$
begin
  return pg_temp.error_as(who, format('update public.student_account_requests set status = %L where id = %L', to_status, req));
end $$;

create or replace function pg_temp.entry_of(req uuid)
returns uuid language sql as $$
  select entry_id from public.student_account_requests where id = req;
$$;

create or replace function pg_temp.reconcile(who uuid, period text, provider_total bigint, differing int default 0)
returns text language plpgsql as $$
begin
  return pg_temp.error_as(who, format(
    'insert into public.student_account_reconciliations (tenant_id, period, provider_total_cents, matched, missing, extra, differing, settlement_sha256)
     values (''sa-u'', %L, %s, 1, 0, 0, %s, %L)', period, provider_total, differing, repeat('cd', 32)));
end $$;

create or replace function pg_temp.close(who uuid, period text)
returns text language plpgsql as $$
begin
  return pg_temp.error_as(who, format('insert into public.student_account_closes (tenant_id, period, reconciliation_id) values (''sa-u'', %L, gen_random_uuid())', period));
end $$;

do $$
declare
  off1 uuid; off2 uuid; aid uuid; adm1 uuid; adm2 uuid; student uuid; other uuid; far uuid;
  charge uuid; wrong uuid; pay uuid; refund uuid; big_refund uuid; schol uuid; rev_part uuid; rev uuid; rev2 uuid; late uuid; waiting uuid; adj uuid;
  audits bigint;
begin
  insert into public.schools (id, name, email_domains) values
    ('sa-u', 'Student Accounts University', array['sa-u.example']),
    ('sa-other', 'Other University', array['sa-other.example']);

  off1    := pg_temp.newuser('off1@sa-u.example', 'sa-u');
  off2    := pg_temp.newuser('off2@sa-u.example', 'sa-u');
  aid     := pg_temp.newuser('aid@sa-u.example', 'sa-u');
  adm1    := pg_temp.newuser('adm1@sa-u.example', 'sa-u');
  adm2    := pg_temp.newuser('adm2@sa-u.example', 'sa-u');
  student := pg_temp.newuser('student@sa-u.example', 'sa-u');
  other   := pg_temp.newuser('other@sa-u.example', 'sa-u');
  far     := pg_temp.newuser('off@sa-other.example', 'sa-other');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (off1,    'student_accounts_officer', 'school', 'sa-u',     'institution'),
    (off2,    'student_accounts_officer', 'school', 'sa-u',     'institution'),
    (aid,     'financial_aid_officer',    'school', 'sa-u',     'institution'),
    (adm1,    'business_admin',           'school', 'sa-u',     'institution'),
    (adm2,    'business_admin',           'school', 'sa-u',     'institution'),
    (student, 'student',                  'school', 'sa-u',     'institution'),
    (other,   'student',                  'school', 'sa-u',     'institution'),
    (far,     'student_accounts_officer', 'school', 'sa-other', 'institution');

  -- ── nobody writes the ledger ───────────────────────────────────────────
  perform pg_temp.says('an officer cannot write an entry directly',
    pg_temp.error_as(off1, $q$insert into public.student_account_entries (tenant_id, student_ref, kind, category, amount_cents, description, provider_ref,
      effective_on, period, request_id, high_value) values ('sa-u', 'S100', 'charge', 'tuition', 100, 'x', '', '2026-09-01', '2026-09', gen_random_uuid(), false)$q$),
    'permission denied');

  -- ── a charge, and who may approve it ───────────────────────────────────
  charge := pg_temp.request(off1, 'charge', 'tuition', 500000, '2026-09-01');
  perform pg_temp.says('a student cannot request', pg_temp.error_as(student,
    $q$insert into public.student_account_requests (tenant_id, student_ref, kind, category, amount_cents, description, effective_on)
       values ('sa-u', 'S100', 'adjustment_credit', 'other', 500000, 'please', '2026-09-01')$q$), 'cannot make requests');
  perform pg_temp.says('an officer at another school cannot request here', pg_temp.error_as(far,
    $q$insert into public.student_account_requests (tenant_id, student_ref, kind, category, amount_cents, description, effective_on)
       values ('sa-u', 'S100', 'charge', 'fees', 100, 'x fee', '2026-09-01')$q$), 'cannot make requests');
  perform pg_temp.says('the requester does not approve their own', pg_temp.decide(off1, charge, 'approved'), 'does not decide it');
  perform pg_temp.decide(aid, charge, 'approved');
  perform pg_temp.counted('the aid officer cannot approve: row-level security leaves the request waiting',
    (select count(*) from public.student_account_requests where id = charge and status = 'proposed'), 1);
  perform pg_temp.runs_clean('another officer approves the charge', pg_temp.decide(off2, charge, 'approved'));
  perform pg_temp.counted('the charge is one signed entry naming both people',
    (select count(*) from public.student_account_entries where id = pg_temp.entry_of(charge) and amount_cents = 500000 and period = '2026-09'
       and requested_by = off1 and approved_by = off2 and not high_value), 1);
  perform pg_temp.says('a decided request does not change', pg_temp.decide(adm1, charge, 'rejected'), 'does not change');

  -- ── no card numbers ────────────────────────────────────────────────────
  perform pg_temp.says('a card number in a description is refused', pg_temp.error_as(off1,
    $q$insert into public.student_account_requests (tenant_id, student_ref, kind, category, amount_cents, description, provider_ref, effective_on)
       values ('sa-u', 'S100', 'payment', 'tuition', 100, 'paid with 4111 1111 1111 1111', 'pi_1', '2026-09-02')$q$), 'student_account_request_no_pan');
  perform pg_temp.says('and as a provider reference', pg_temp.error_as(off1,
    $q$insert into public.student_account_requests (tenant_id, student_ref, kind, category, amount_cents, description, provider_ref, effective_on)
       values ('sa-u', 'S100', 'payment', 'tuition', 100, 'card payment', '5555-5555-5555-4444', '2026-09-02')$q$), 'student_account_request_no_pan');
  perform pg_temp.says('a payment needs the provider reference', pg_temp.error_as(off1,
    $q$insert into public.student_account_requests (tenant_id, student_ref, kind, category, amount_cents, description, effective_on)
       values ('sa-u', 'S100', 'payment', 'tuition', 100, 'cash?', '2026-09-02')$q$), 'student_account_request_provider');
  perform pg_temp.says('a scholarship is an aid credit', pg_temp.error_as(aid,
    $q$insert into public.student_account_requests (tenant_id, student_ref, kind, category, amount_cents, description, effective_on)
       values ('sa-u', 'S100', 'adjustment_credit', 'scholarship', 100, 'Dean award', '2026-09-02')$q$), 'student_account_request_aid');

  -- ── a payment and its refund ───────────────────────────────────────────
  pay := pg_temp.request(off1, 'payment', 'tuition', 200000, '2026-09-05', null, 'pi_3Nq8xLk2');
  perform pg_temp.runs_clean('a payment recorded by the provider''s reference', pg_temp.decide(off2, pay, 'approved'));
  refund := pg_temp.request(off1, 'refund', 'tuition', 50000, '2026-09-20', pg_temp.entry_of(pay), 're_1Nq9');
  perform pg_temp.says('whoever approved the payment does not approve its refund', pg_temp.decide(off2, refund, 'approved'), 'does not approve what answers it');
  perform pg_temp.says('nor the requester, who put it there too', pg_temp.decide(off1, refund, 'approved'), 'does not decide it');
  perform pg_temp.runs_clean('an administrator approves the refund', pg_temp.decide(adm1, refund, 'approved'));
  big_refund := pg_temp.request(aid, 'refund', 'tuition', 160000, '2026-09-21', pg_temp.entry_of(pay), 're_2Nq9');
  perform pg_temp.says('a refund never returns more than is left', pg_temp.decide(adm2, big_refund, 'approved'), 'left to return');
  perform pg_temp.runs_clean('so it is rejected', pg_temp.decide(adm2, big_refund, 'rejected'));
  wrong := pg_temp.request(aid, 'refund', 'tuition', 100, '2026-09-21', pg_temp.entry_of(charge), 're_3');
  perform pg_temp.says('a refund answers a payment, not a charge', pg_temp.decide(adm2, wrong, 'approved'), 'answers a payment');
  perform pg_temp.runs_clean('so it is rejected', pg_temp.decide(adm2, wrong, 'rejected'));

  -- ── thresholds ─────────────────────────────────────────────────────────
  schol := pg_temp.request(aid, 'aid_credit', 'scholarship', 150000, '2026-09-10');
  perform pg_temp.says('an officer cannot approve a scholarship at the threshold', pg_temp.decide(off2, schol, 'approved'), 'high-value approver');
  perform pg_temp.runs_clean('a high-value approver can', pg_temp.decide(adm1, schol, 'approved'));
  perform pg_temp.counted('and the entry says it was high value',
    (select count(*) from public.student_account_entries where id = pg_temp.entry_of(schol) and amount_cents = -150000 and high_value), 1);
  perform pg_temp.says('an officer cannot set the thresholds', pg_temp.error_as(off1,
    $q$insert into public.student_account_settings (tenant_id, high_value_cents) values ('sa-u', 999999999)$q$), 'row-level security');
  perform pg_temp.runs_clean('an administrator raises the threshold to $2,000', pg_temp.error_as(adm1,
    $q$insert into public.student_account_settings (tenant_id, high_value_cents) values ('sa-u', 200000)$q$));
  adj := pg_temp.request(off1, 'adjustment_credit', 'fees', 150000, '2026-09-11');
  perform pg_temp.runs_clean('under the new threshold an officer approves $1,500', pg_temp.decide(off2, adj, 'approved'));

  -- ── reversals ──────────────────────────────────────────────────────────
  rev_part := pg_temp.request(off1, 'reversal', 'tuition', 100000, '2026-09-12', pg_temp.entry_of(charge));
  perform pg_temp.says('a reversal is for the whole entry', pg_temp.decide(adm2, rev_part, 'approved'), 'whole entry');
  perform pg_temp.runs_clean('so it is rejected', pg_temp.decide(adm2, rev_part, 'rejected'));
  rev := pg_temp.request(off1, 'reversal', 'tuition', 500000, '2026-09-12', pg_temp.entry_of(charge));
  perform pg_temp.says('the charge''s approver does not approve its reversal', pg_temp.decide(off2, rev, 'approved'), 'does not approve what answers it');
  perform pg_temp.runs_clean('a high-value approver reverses the whole charge', pg_temp.decide(adm2, rev, 'approved'));
  perform pg_temp.counted('the reversal carries the opposite amount, naming what it reversed',
    (select count(*) from public.student_account_entries where id = pg_temp.entry_of(rev) and amount_cents = -500000 and reference_entry_id = pg_temp.entry_of(charge)), 1);
  rev2 := pg_temp.request(off1, 'reversal', 'tuition', 500000, '2026-09-13', pg_temp.entry_of(charge));
  perform pg_temp.says('an entry is reversed once', pg_temp.decide(adm2, rev2, 'approved'), 'already been reversed');
  perform pg_temp.runs_clean('the requester withdraws the second', pg_temp.decide(off1, rev2, 'withdrawn'));

  -- Two approvals at one moment cannot both answer the same entry: the guard
  -- takes a lock on it, and on the month against a close, before it reads.
  perform pg_temp.counted('the approval guard locks the entry it answers and the month',
    (select count(*) from pg_proc where proname = 'student_account_request_guard'
      and prosrc like '%student_account_entry:%' and prosrc like '%pg_advisory_xact_lock(hashtextextended(''student_account_period:%'), 1);
  perform pg_temp.counted('and the close guard the month',
    (select count(*) from pg_proc where proname = 'student_account_close_guard' and prosrc like '%pg_advisory_xact_lock%'), 1);
  begin
    insert into public.student_account_entries (tenant_id, student_ref, kind, category, amount_cents, description, reference_entry_id,
      provider_ref, effective_on, period, request_id, high_value)
    values ('sa-u', 'S100', 'reversal', 'tuition', -500000, 'a second reversal', pg_temp.entry_of(charge), '', '2026-09-14', '2026-09', rev2, true);
    raise exception 'FAILED: a second reversal of one entry was written';
  exception when unique_violation then
    raise notice 'ok  and the database holds one reversal per entry, whoever writes it';
  end;

  -- ── reconciliation and the monthly close ───────────────────────────────
  perform pg_temp.says('a month with no reconciliation does not close', pg_temp.close(adm1, '2026-09'), 'no passing reconciliation');
  perform pg_temp.says('an officer cannot reconcile', pg_temp.reconcile(off1, '2026-09', 150000), 'cannot reconcile');
  perform pg_temp.runs_clean('a reconciliation whose provider total is wrong is recorded', pg_temp.reconcile(adm1, '2026-09', 170000));
  perform pg_temp.counted('the database read the ledger''s side itself: $2,000 in, $500 back',
    (select count(*) from public.student_account_reconciliations where period = '2026-09' and ledger_total_cents = 150000 and ledger_count = 2 and not passed), 1);
  perform pg_temp.says('and it does not pass', pg_temp.close(adm2, '2026-09'), 'no passing reconciliation');
  perform pg_temp.runs_clean('a matching reconciliation', pg_temp.reconcile(adm1, '2026-09', 150000));
  waiting := pg_temp.request(off1, 'charge', 'fees', 2500, '2026-09-30');
  perform pg_temp.says('a month with a request waiting does not close', pg_temp.close(adm2, '2026-09'), 'still has requests waiting');
  perform pg_temp.runs_clean('the officer withdraws it', pg_temp.decide(off1, waiting, 'withdrawn'));
  -- A payment approved after the reconciliation was recorded: the month is
  -- not reconciled any more, whatever the old row says.
  perform pg_temp.runs_clean('a late payment is approved after the reconciliation',
    pg_temp.decide(off2, pg_temp.request(off1, 'payment', 'tuition', 1000, '2026-09-29', null, 'pi_late1'), 'approved'));
  perform pg_temp.says('a month with a provider entry since its reconciliation does not close', pg_temp.close(adm2, '2026-09'), 'reconcile it again');
  perform pg_temp.runs_clean('September is reconciled again, with the late payment', pg_temp.reconcile(adm1, '2026-09', 151000));
  perform pg_temp.says('the person who reconciled does not close', pg_temp.close(adm1, '2026-09'), 'does not close it');
  perform pg_temp.runs_clean('another administrator closes September', pg_temp.close(adm2, '2026-09'));
  late := pg_temp.request(off1, 'charge', 'fees', 2500, '2026-09-30');
  perform pg_temp.says('a closed month takes nothing new', pg_temp.decide(off2, late, 'approved'), 'is closed');
  perform pg_temp.runs_clean('the same charge in October is approved', pg_temp.decide(off2, pg_temp.request(off1, 'charge', 'fees', 2500, '2026-10-01'), 'approved'));

  -- ── append-only, for the owner too ─────────────────────────────────────
  begin
    update public.student_account_entries set amount_cents = 1 where id = pg_temp.entry_of(pay);
    raise exception 'FAILED: the owner edited an entry';
  exception when insufficient_privilege then
    raise notice 'ok  the owner cannot edit an entry';
  end;
  begin
    update public.student_account_entries set approved_by = off1 where id = pg_temp.entry_of(pay);
    raise exception 'FAILED: the owner re-attributed an entry';
  exception when insufficient_privilege then
    raise notice 'ok  nor change who approved it';
  end;
  begin
    delete from public.student_account_closes where period = '2026-09';
    raise exception 'FAILED: the owner reopened a month';
  exception when insufficient_privilege then
    raise notice 'ok  nor reopen a closed month';
  end;

  -- ── who reads what ─────────────────────────────────────────────────────
  perform pg_temp.counted('an officer reads the ledger', pg_temp.seen(off1, 'select * from public.student_account_entries'), 8);
  perform pg_temp.counted('an officer at another school reads none', pg_temp.seen(far, 'select * from public.student_account_entries'), 0);
  perform pg_temp.counted('an unlinked student reads none', pg_temp.seen(student, 'select * from public.student_account_entries'), 0);
  perform pg_temp.counted('nor the school''s thresholds', pg_temp.seen(student, 'select * from public.student_account_settings'), 0);
  insert into public.academic_record_subjects (tenant_id, student_ref, user_id) values ('sa-u', 'S100', student), ('sa-u', 'S200', other);
  perform pg_temp.counted('a linked student reads their own account', pg_temp.seen(student, 'select * from public.student_account_entries'), 8);
  perform pg_temp.counted('a student linked to their own reads nothing of another''s', pg_temp.seen(other, 'select * from public.student_account_entries'), 0);
  perform pg_temp.counted('and no request behind it', pg_temp.seen(student, 'select * from public.student_account_requests'), 0);
  perform pg_temp.counted('a linked student reads the hold rule they are held to', pg_temp.seen(student, 'select * from public.student_account_settings'), 1);
  perform pg_temp.counted('an officer at another school does not', pg_temp.seen(far, 'select * from public.student_account_settings'), 0);
  perform pg_temp.counted('a linked student reads no reconciliation', pg_temp.seen(student, 'select * from public.student_account_reconciliations'), 0);
  perform pg_temp.counted('and no close', pg_temp.seen(student, 'select * from public.student_account_closes'), 0);

  -- ── audit ──────────────────────────────────────────────────────────────
  -- Fourteen requests written (the four refused at insert wrote nothing),
  -- thirteen decisions that succeeded, one settings row, three
  -- reconciliations and one close.
  select count(*) into audits from public.tenant_policy_audit_event where tenant_id = 'sa-u' and entity_type like 'student_account_%';
  perform pg_temp.counted('every change is audited, and nothing refused is', audits, 32);

  -- ── an account goes; the record stays ──────────────────────────────────
  perform set_config('request.jwt.claims', '', true);
  delete from auth.users where id = off1;
  perform pg_temp.counted('the officer''s entries stay, no longer naming them',
    (select count(*) from public.student_account_entries where requested_by is null), 7);
  perform pg_temp.counted('and the ledger still sums: $5,000 − $2,000 + $500 − $1,500 − $1,500 − $5,000 + $25 − $10',
    (select sum(amount_cents)::bigint from public.student_account_entries where student_ref = 'S100'), -448500);
end $$;

reset role;
do $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  perform count(*) from public.student_account_entries;
  raise exception 'FAILED: anon read the ledger';
exception when insufficient_privilege then
  raise notice 'ok  anon cannot read the ledger';
end $$;
reset role;

rollback;
