-- supabase/student_accounts.check.sql — the student account ledger, aid, holds,
-- plans and payments, walked by two students, a bursar and the offices around them.
--
-- For 20260929320000_student_accounts.sql. What it proves:
--
--   * it is off until the module is on AND a finance owner is named, and the
--     owner must be at the school and hold bursar:post;
--   * and it stays on only while they do: revoking the owner's grant, letting
--     it expire, or moving the owner to another school turns off every
--     person's write — another bursar's, the aid office's, a student's award
--     answer and payment — and the adapter's sync, until the grant is back;
--   * only a bursar at the student's own school posts; a student, the aid
--     office, the registrar and a bursar at another school do not;
--   * an idempotency key replays to the same entry and refuses a different one;
--   * the ledger is append-only — no update or delete through the API, and
--     none by the owner either — yet deleting an account still removes its rows;
--   * a student reads their own account and nobody else's;
--   * awards come only from the adapter (service role); the student accepts
--     their own; a disbursement is refused while verification is pending, for
--     work-study, and beyond the offer; accepted-but-undisbursed aid is not in
--     the balance;
--   * a refund cannot exceed the credit balance;
--   * a hold needs a balance over the threshold; the registrar learns whether,
--     never why, and cannot read the holds table;
--   * a provider event applies once; a duplicate, a late failure and a wrong
--     amount post nothing; a refund before its payment waits for it; nobody
--     reads the events.
--
-- The control: each refusal changes one thing about a call that works.
--
--   How to run it: supabase/check.sh student_accounts

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
  values (who, replace(split_part(address, '@', 1), '.', '_') || '_' || substr(md5(address), 1, 4), school);
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

create or replace function pg_temp.answered(what text, got text, want text)
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

create or replace function pg_temp.refused(what text, who uuid, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;

create or replace function pg_temp.allowed(what text, who uuid, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is not null then raise exception 'FAILED: % — refused: %', what, e; end if;
  raise notice 'ok  %', what;
end $$;

-- Refused *because the module is off* — not for some other reason a broken
-- fixture could supply. Every "off" refusal in the migration says this.
create or replace function pg_temp.off(what text, who uuid, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  if e not like '%student accounts are off%' then
    raise exception 'FAILED: % — refused, but not as module off: %', what, e;
  end if;
  raise notice 'ok  % is refused as module off (%)', what, e;
end $$;

-- A scalar a statement returns as `who`.
create or replace function pg_temp.said(who uuid, q text)
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

-- As the adapter and the webhook: the service role.
create or replace function pg_temp.service(q text)
returns text language plpgsql as $$
declare v text;
begin
  execute 'set local role service_role';
  execute q into v;
  execute 'reset role';
  return v;
exception when others then
  execute 'reset role';
  return 'ERROR: ' || sqlerrm;
end $$;

do $$
declare
  admin uuid; bursar uuid; aid uuid; registrar uuid; s1 uuid; s2 uuid; far_bursar uuid; clerk uuid; bursar2 uuid;
  charge uuid; award uuid; award2 uuid; ws uuid; intent uuid; hold uuid; e text; n bigint;
begin
  insert into public.schools (id, name, email_domains) values
    ('sa-u', 'Student Accounts University', array['sa-u.example']),
    ('sa-far', 'Far University', array['sa-far.example']);

  admin      := pg_temp.newuser('admin@sa-u.example', 'sa-u');
  bursar     := pg_temp.newuser('bursar@sa-u.example', 'sa-u');
  aid        := pg_temp.newuser('aid@sa-u.example', 'sa-u');
  registrar  := pg_temp.newuser('registrar@sa-u.example', 'sa-u');
  clerk      := pg_temp.newuser('clerk@sa-u.example', 'sa-u');
  s1         := pg_temp.newuser('one@sa-u.example', 'sa-u');
  s2         := pg_temp.newuser('two@sa-u.example', 'sa-u');
  far_bursar := pg_temp.newuser('bursar@sa-far.example', 'sa-far');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (admin,      'university_admin',         'school', 'sa-u',   'institution'),
    (bursar,     'student_accounts_officer', 'school', 'sa-u',   'institution'),
    (aid,        'financial_aid_officer',    'school', 'sa-u',   'institution'),
    (registrar,  'registrar',                'school', 'sa-u',   'institution'),
    (far_bursar, 'student_accounts_officer', 'school', 'sa-far', 'institution');

  -- ── Off until the module and a finance owner ────────────────────────────
  perform pg_temp.refused('a bursar posting while the module is off', bursar,
    format($q$select public.post_student_ledger_entry(%L, '2026FA', 'charge', 900000, 'Tuition', 'tuition')$q$, s1));
  insert into public.tenant_feature_policy (tenant_id, capability, state) values ('sa-u', 'module.student_accounts', 'production');
  perform pg_temp.refused('a bursar posting with the module on and no finance owner', bursar,
    format($q$select public.post_student_ledger_entry(%L, '2026FA', 'charge', 900000, 'Tuition', 'tuition')$q$, s1));
  perform pg_temp.refused('the bursar naming themselves finance owner (needs tenant:configure)', bursar,
    format($q$select public.configure_student_accounts(%L, 50000, 10)$q$, bursar));
  perform pg_temp.refused('naming a finance owner who lacks bursar:post', admin,
    format($q$select public.configure_student_accounts(%L, 50000, 10)$q$, clerk));
  perform pg_temp.refused('naming another school''s bursar as finance owner', admin,
    format($q$select public.configure_student_accounts(%L, 50000, 10)$q$, far_bursar));
  perform pg_temp.allowed('the school''s administrator names the bursar finance owner', admin,
    format($q$select public.configure_student_accounts(%L, 50000, 10)$q$, bursar));
  -- The far school is on too, so its bursar is refused for the student's
  -- school and not merely for the module being off at theirs.
  insert into public.tenant_feature_policy (tenant_id, capability, state) values ('sa-far', 'module.student_accounts', 'production');
  insert into public.student_account_settings (tenant_id, finance_owner) values ('sa-far', far_bursar);

  -- ── Posting ─────────────────────────────────────────────────────────────
  perform pg_temp.allowed('the bursar posts a charge', bursar,
    format($q$select public.post_student_ledger_entry(%L, '2026FA', 'charge', 900000, 'Tuition', 'tuition')$q$, s1));
  select id into charge from public.student_ledger_entries where idempotency_key = 'tuition';
  perform pg_temp.answered('the same key replays to the same entry',
    pg_temp.said(bursar, format($q$select public.post_student_ledger_entry(%L, '2026FA', 'charge', 900000, 'Tuition', 'tuition')$q$, s1)),
    charge::text);
  perform pg_temp.counted('and posts nothing new', (select count(*) from public.student_ledger_entries), 1);
  perform pg_temp.refused('the same key for a different amount', bursar,
    format($q$select public.post_student_ledger_entry(%L, '2026FA', 'charge', 1, 'Tuition', 'tuition')$q$, s1));
  perform pg_temp.refused('a person posting under a provider key', bursar,
    format($q$select public.post_student_ledger_entry(%L, '2026FA', 'payment', 100, 'x', 'provider:fakepay:pay-9')$q$, s1));
  perform pg_temp.refused('the bursar posting aid by hand', bursar,
    format($q$select public.post_student_ledger_entry(%L, '2026FA', 'aid_disbursement', 100, 'x', 'k-aid')$q$, s1));
  perform pg_temp.refused('fractional cents are not cents', bursar,
    format($q$select public.post_student_ledger_entry(%L, '2026FA', 'charge', 0, 'x', 'k-zero')$q$, s1));
  perform pg_temp.refused('a student posting to their own account', s1,
    format($q$select public.post_student_ledger_entry(%L, '2026FA', 'credit', 900000, 'x', 'k-s')$q$, s1));
  perform pg_temp.refused('the aid office posting a charge', aid,
    format($q$select public.post_student_ledger_entry(%L, '2026FA', 'charge', 1, 'x', 'k-a')$q$, s1));
  perform pg_temp.refused('the registrar posting a charge', registrar,
    format($q$select public.post_student_ledger_entry(%L, '2026FA', 'charge', 1, 'x', 'k-r')$q$, s1));
  perform pg_temp.refused('another school''s bursar posting to this student', far_bursar,
    format($q$select public.post_student_ledger_entry(%L, '2026FA', 'charge', 1, 'x', 'k-f')$q$, s1));
  perform pg_temp.counted('and the refusals wrote nothing', (select count(*) from public.student_ledger_entries), 1);

  -- ── Append-only ─────────────────────────────────────────────────────────
  perform pg_temp.refused('a bursar updating an entry directly', bursar,
    format($q$update public.student_ledger_entries set cents = 1 where id = %L$q$, charge));
  perform pg_temp.refused('a bursar inserting an entry directly', bursar,
    format($q$insert into public.student_ledger_entries (tenant_id, student_id, term, kind, cents, what, idempotency_key, source) values ('sa-u', %L, '2026FA', 'credit', 1, 'x', 'direct', 'bursar')$q$, s1));
  begin
    update public.student_ledger_entries set cents = 1 where id = charge;
    raise exception 'FAILED: the owner rewrote a ledger entry';
  exception when insufficient_privilege then
    raise notice 'ok  the owner updating an entry is refused (append-only)';
  end;
  begin
    delete from public.student_ledger_entries where id = charge;
    raise exception 'FAILED: the owner deleted a ledger entry';
  exception when insufficient_privilege then
    raise notice 'ok  the owner deleting an entry is refused (append-only)';
  end;
  perform pg_temp.allowed('a correction is a reversal', bursar,
    format($q$select public.reverse_student_ledger_entry(%L, 100000, 'Dropped a course', 'rev-1')$q$, charge));
  perform pg_temp.refused('another school''s bursar reversing it', far_bursar,
    format($q$select public.reverse_student_ledger_entry(%L, 1, 'x', 'rev-far')$q$, charge));
  perform pg_temp.refused('the aid office reversing a charge', aid,
    format($q$select public.reverse_student_ledger_entry(%L, 1, 'x', 'rev-aid')$q$, charge));
  perform pg_temp.refused('reversing more than is left', bursar,
    format($q$select public.reverse_student_ledger_entry(%L, 800001, 'x', 'rev-2')$q$, charge));
  perform pg_temp.counted('the balance is derived: 900,000 less 100,000',
    private.student_ledger_balance('sa-u', s1, '2026FA'), 800000);

  -- ── Who reads ───────────────────────────────────────────────────────────
  perform pg_temp.counted('the student reads their own entries', pg_temp.seen(s1, 'select * from public.student_ledger_entries'), 2);
  perform pg_temp.counted('another student reads none of them', pg_temp.seen(s2, 'select * from public.student_ledger_entries'), 0);
  perform pg_temp.counted('the bursar reads the school''s', pg_temp.seen(bursar, 'select * from public.student_ledger_entries'), 2);
  perform pg_temp.counted('another school''s bursar reads none', pg_temp.seen(far_bursar, 'select * from public.student_ledger_entries'), 0);
  perform pg_temp.counted('the registrar reads none', pg_temp.seen(registrar, 'select * from public.student_ledger_entries'), 0);
  perform pg_temp.counted('the aid office reads no non-aid entries', pg_temp.seen(aid, 'select * from public.student_ledger_entries'), 0);

  -- ── Aid: from the adapter, accepted by the student ──────────────────────
  perform pg_temp.refused('a signed-in account syncing an award', aid,
    format($q$select public.sync_aid_award('sa-u', %L, 'pell-1', '2026FA', 'grant', 'Pell', 300000, 'pending', 'meeting', 1, false)$q$, s1));
  perform pg_temp.answered('the adapter offers a Pell grant, verification pending',
    pg_temp.service(format($q$select public.sync_aid_award('sa-u', %L, 'pell-1', '2026FA', 'grant', 'Pell Grant', 300000, 'pending', 'meeting', 1, false)$q$, s1)),
    'offered');
  perform pg_temp.answered('the adapter offers work-study',
    pg_temp.service(format($q$select public.sync_aid_award('sa-u', %L, 'fws-1', '2026FA', 'work', 'Federal Work-Study', 250000, 'not_selected', 'meeting', 1, false)$q$, s1)),
    'offered');
  select id into award from public.student_aid_awards where external_ref = 'pell-1';
  select id into ws from public.student_aid_awards where external_ref = 'fws-1';
  perform pg_temp.refused('another student accepting it', s2, format($q$select public.respond_to_aid_award(%L, true)$q$, award));
  perform pg_temp.refused('the aid office accepting it for the student', aid, format($q$select public.respond_to_aid_award(%L, true)$q$, award));
  perform pg_temp.refused('the aid office disbursing an award not yet accepted', aid,
    format($q$select public.record_aid_disbursement(%L, 300000, 'd-1')$q$, award));
  perform pg_temp.allowed('the student accepts their own award', s1, format($q$select public.respond_to_aid_award(%L, true)$q$, award));
  perform pg_temp.allowed('and the work-study', s1, format($q$select public.respond_to_aid_award(%L, true)$q$, ws));
  perform pg_temp.refused('declining after accepting', s1, format($q$select public.respond_to_aid_award(%L, false)$q$, award));
  perform pg_temp.refused('disbursing while verification is pending', aid,
    format($q$select public.record_aid_disbursement(%L, 300000, 'd-1')$q$, award));
  perform pg_temp.counted('accepted aid not yet disbursed is not in the balance',
    private.student_ledger_balance('sa-u', s1, '2026FA'), 800000);
  perform pg_temp.answered('the adapter reports verification complete',
    pg_temp.service(format($q$select public.sync_aid_award('sa-u', %L, 'pell-1', '2026FA', 'grant', 'Pell Grant', 300000, 'complete', 'meeting', 2, false)$q$, s1)),
    'updated');
  perform pg_temp.answered('and a version-1 sync arriving after it is stale',
    pg_temp.service(format($q$select public.sync_aid_award('sa-u', %L, 'pell-1', '2026FA', 'grant', 'Pell Grant', 1, 'pending', 'meeting', 1, false)$q$, s1)),
    'stale');
  perform pg_temp.counted('the award keeps its amount', (select offered_cents from public.student_aid_awards where id = award), 300000);
  perform pg_temp.refused('the bursar disbursing aid', bursar,
    format($q$select public.record_aid_disbursement(%L, 300000, 'd-1')$q$, award));
  perform pg_temp.refused('disbursing more than was offered', aid,
    format($q$select public.record_aid_disbursement(%L, 300001, 'd-1')$q$, award));
  perform pg_temp.refused('disbursing work-study to the account', aid,
    format($q$select public.record_aid_disbursement(%L, 250000, 'd-ws')$q$, ws));
  perform pg_temp.allowed('the aid office records the disbursement', aid,
    format($q$select public.record_aid_disbursement(%L, 300000, 'd-1')$q$, award));
  perform pg_temp.counted('the balance falls by the grant and not by the work-study',
    private.student_ledger_balance('sa-u', s1, '2026FA'), 500000);
  perform pg_temp.counted('the aid office now reads the aid entry', pg_temp.seen(aid, 'select * from public.student_ledger_entries'), 1);
  perform pg_temp.counted('another student reads none of the awards', pg_temp.seen(s2, 'select * from public.student_aid_awards'), 0);
  perform pg_temp.counted('the registrar reads none of the awards', pg_temp.seen(registrar, 'select * from public.student_aid_awards'), 0);

  -- ── Refunds of credit balances ──────────────────────────────────────────
  perform pg_temp.refused('a refund with no credit balance', bursar,
    format($q$select public.refund_student_credit(%L, '2026FA', 1, 'rf-0')$q$, s1));
  perform pg_temp.allowed('the bursar posts a payment that overpays', bursar,
    format($q$select public.post_student_ledger_entry(%L, '2026FA', 'payment', 560000, 'Wire', 'wire-1')$q$, s1));
  perform pg_temp.refused('a refund exceeding the credit balance', bursar,
    format($q$select public.refund_student_credit(%L, '2026FA', 60001, 'rf-1')$q$, s1));
  perform pg_temp.allowed('a refund of the credit balance', bursar,
    format($q$select public.refund_student_credit(%L, '2026FA', 60000, 'rf-1')$q$, s1));
  perform pg_temp.counted('which closes it', private.student_ledger_balance('sa-u', s1, '2026FA'), 0);

  -- ── Holds ───────────────────────────────────────────────────────────────
  perform pg_temp.allowed('a charge for the spring', bursar,
    format($q$select public.post_student_ledger_entry(%L, '2027SP', 'charge', 50000, 'Housing', 'housing')$q$, s1));
  perform pg_temp.refused('a hold at the threshold, not over it', bursar,
    format($q$select public.place_student_hold(%L, 'Unpaid spring balance')$q$, s1));
  perform pg_temp.allowed('another charge', bursar,
    format($q$select public.post_student_ledger_entry(%L, '2027SP', 'charge', 1, 'Late fee', 'late')$q$, s1));
  perform pg_temp.refused('the registrar placing a hold', registrar,
    format($q$select public.place_student_hold(%L, 'x')$q$, s1));
  perform pg_temp.refused('another school''s bursar holding this student', far_bursar,
    format($q$select public.place_student_hold(%L, 'x')$q$, s1));
  perform pg_temp.allowed('a hold over the threshold', bursar,
    format($q$select public.place_student_hold(%L, 'Unpaid spring balance')$q$, s1));
  select id into hold from public.student_account_holds where student_id = s1;
  perform pg_temp.answered('the registrar learns the student is held',
    pg_temp.said(registrar, format($q$select held::text || '/' || office from public.student_hold_status(%L)$q$, s1)), 'true/student_accounts');
  perform pg_temp.counted('and can read nothing of the hold itself', pg_temp.seen(registrar, 'select * from public.student_account_holds'), 0);
  perform pg_temp.counted('the status has three columns, none a reason or an amount',
    (select count(*) from information_schema.parameters p join information_schema.routines r using (specific_schema, specific_name)
      where r.routine_schema = 'public' and r.routine_name = 'student_hold_status' and p.parameter_mode = 'OUT'
        and p.parameter_name in ('held', 'office', 'since')), 3);
  perform pg_temp.counted('the student reads their own hold, reason included',
    pg_temp.seen(s1, $q$select * from public.student_account_holds where reason = 'Unpaid spring balance'$q$), 1);
  perform pg_temp.refused('another student asking about the hold', s2,
    format($q$select * from public.student_hold_status(%L)$q$, s1));
  perform pg_temp.refused('another school''s bursar asking', far_bursar,
    format($q$select * from public.student_hold_status(%L)$q$, s1));
  perform pg_temp.allowed('the bursar releases it', bursar, format($q$select public.release_student_hold(%L, 'Paid')$q$, hold));
  perform pg_temp.answered('and the registrar reads it released',
    pg_temp.said(registrar, format($q$select held::text from public.student_hold_status(%L)$q$, s1)), 'false');

  -- ── Plans ───────────────────────────────────────────────────────────────
  perform pg_temp.refused('a plan for a term that owes nothing', bursar,
    format($q$select public.create_student_payment_plan(%L, '2026FA', 3, date '2026-10-01', 1, 'plan-fa')$q$, s1));
  perform pg_temp.allowed('a plan for the spring balance', bursar,
    format($q$select public.create_student_payment_plan(%L, '2027SP', 3, date '2027-01-15', 1, 'plan-sp')$q$, s1));
  perform pg_temp.counted('its total is the balance when made', (select total_cents from public.student_payment_plans where student_id = s1), 50001);
  perform pg_temp.refused('a second plan for the same term', bursar,
    format($q$select public.create_student_payment_plan(%L, '2027SP', 4, date '2027-01-15', 1, 'plan-sp2')$q$, s1));
  perform pg_temp.counted('another student reads none of the plans', pg_temp.seen(s2, 'select * from public.student_payment_plans'), 0);

  -- ── Paying through the provider ─────────────────────────────────────────
  perform pg_temp.refused('paying more than the term owes', s1, $q$select public.start_student_payment('2027SP', 50002, 'pay-1')$q$);
  perform pg_temp.refused('paying a term that owes nothing', s2, $q$select public.start_student_payment('2027SP', 1, 'pay-1')$q$);
  intent := pg_temp.said(s1, $q$select public.start_student_payment('2027SP', 50001, 'pay-1')$q$)::uuid;
  perform pg_temp.counted('the student started a payment', (select count(*) from public.student_payment_intents where id = intent), 1);
  perform pg_temp.refused('a signed-in account applying a webhook', s1,
    format($q$select public.apply_student_payment_event('fakepay', 'evt-1', 'payment_succeeded', %L, 'pay-1', 50001, 'usd', %L, now())$q$, intent, repeat('a', 64)));
  perform pg_temp.answered('a refund arriving before its payment waits',
    pg_temp.service(format($q$select public.apply_student_payment_event('fakepay', 'evt-r', 'payment_refunded', %L, 'pay-1', 1, 'usd', %L, now())$q$, intent, repeat('c', 64))),
    'waiting_for_payment');
  perform pg_temp.answered('a success for a different amount posts nothing',
    pg_temp.service(format($q$select public.apply_student_payment_event('fakepay', 'evt-0', 'payment_succeeded', %L, 'pay-1', 50000, 'usd', %L, now())$q$, intent, repeat('d', 64))),
    'amount_mismatch');
  perform pg_temp.answered('the payment lands, and the waiting refund with it',
    pg_temp.service(format($q$select public.apply_student_payment_event('fakepay', 'evt-1', 'payment_succeeded', %L, 'pay-1', 50001, 'usd', %L, now())$q$, intent, repeat('a', 64))),
    'posted_and_reversed');
  perform pg_temp.answered('the same webhook again is a duplicate',
    pg_temp.service(format($q$select public.apply_student_payment_event('fakepay', 'evt-1', 'payment_succeeded', %L, 'pay-1', 50001, 'usd', %L, now())$q$, intent, repeat('a', 64))),
    'duplicate');
  perform pg_temp.answered('another event for the same payment posts nothing twice',
    pg_temp.service(format($q$select public.apply_student_payment_event('fakepay', 'evt-2', 'payment_succeeded', %L, 'pay-1', 50001, 'usd', %L, now())$q$, intent, repeat('b', 64))),
    'already_posted');
  perform pg_temp.answered('a failure arriving after the success changes nothing',
    pg_temp.service(format($q$select public.apply_student_payment_event('fakepay', 'evt-3', 'payment_failed', %L, 'pay-1', 50001, 'usd', %L, now())$q$, intent, repeat('e', 64))),
    'ignored_after_success');
  perform pg_temp.counted('the spring balance is the one cent refunded', private.student_ledger_balance('sa-u', s1, '2027SP'), 1);
  e := pg_temp.err(s1, 'select count(*) from public.student_payment_events');
  perform pg_temp.answered('the student cannot read webhooks', (e is not null)::text, 'true');
  e := pg_temp.err(bursar, 'select count(*) from public.student_payment_events');
  perform pg_temp.answered('the bursar cannot read webhooks either', (e is not null)::text, 'true');
  begin
    delete from public.student_payment_events;
    raise exception 'FAILED: the owner deleted payment events';
  exception when insufficient_privilege then
    raise notice 'ok  payment events are append-only for the owner too';
  end;

  -- ── Switching it off stops people, not money already moved ─────────────
  update public.tenant_feature_policy set state = 'off' where tenant_id = 'sa-u' and capability = 'module.student_accounts';
  perform pg_temp.refused('the bursar posting after the module is switched off', bursar,
    format($q$select public.post_student_ledger_entry(%L, '2027SP', 'charge', 1, 'x', 'after-off')$q$, s1));
  perform pg_temp.refused('a student starting a payment after it is off', s1, $q$select public.start_student_payment('2027SP', 1, 'pay-2')$q$);
  update public.tenant_feature_policy set state = 'production' where tenant_id = 'sa-u' and capability = 'module.student_accounts';

  -- ── The finance owner must still be one ─────────────────────────────────
  -- A second bursar, who is not the owner and keeps their own grant
  -- throughout: what stops them is the owner's grant, and nothing of theirs.
  bursar2 := pg_temp.newuser('bursar2@sa-u.example', 'sa-u');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (bursar2, 'student_accounts_officer', 'school', 'sa-u', 'institution');
  perform pg_temp.answered('the adapter offers a second award while the owner holds bursar:post',
    pg_temp.service(format($q$select public.sync_aid_award('sa-u', %L, 'seog-1', '2027SP', 'grant', 'SEOG', 1000, 'complete', 'meeting', 1, false)$q$, s1)),
    'offered');
  select id into award2 from public.student_aid_awards where external_ref = 'seog-1';
  -- The control: each of these works while the owner's grant is live.
  perform pg_temp.allowed('another bursar posts while the owner holds bursar:post', bursar2,
    format($q$select public.post_student_ledger_entry(%L, '2027SP', 'charge', 100, 'Lab fee', 'owner-live')$q$, s1));

  -- Revoked.
  update public.role_grants set revoked_at = now()
   where subject = bursar and role = 'student_accounts_officer' and scope_id = 'sa-u';
  perform pg_temp.off('another bursar posting after the owner''s grant is revoked', bursar2,
    format($q$select public.post_student_ledger_entry(%L, '2027SP', 'charge', 100, 'Lab fee', 'owner-revoked')$q$, s1));
  perform pg_temp.off('another bursar placing a hold after it is revoked', bursar2,
    format($q$select public.place_student_hold(%L, 'x')$q$, s1));
  perform pg_temp.off('the aid office disbursing after it is revoked', aid,
    format($q$select public.record_aid_disbursement(%L, 1000, 'd-revoked')$q$, award2));
  perform pg_temp.off('the student answering an award after it is revoked', s1,
    format($q$select public.respond_to_aid_award(%L, true)$q$, award2));
  perform pg_temp.off('the student starting a payment after it is revoked', s1,
    $q$select public.start_student_payment('2027SP', 1, 'pay-revoked')$q$);
  perform pg_temp.answered('the adapter''s sync is refused as off too',
    (pg_temp.service(format($q$select public.sync_aid_award('sa-u', %L, 'seog-2', '2027SP', 'grant', 'SEOG', 1, 'complete', 'meeting', 1, false)$q$, s1))
       like '%student accounts are off%')::text, 'true');
  perform pg_temp.counted('and nothing was written while it was off',
    (select count(*) from public.student_ledger_entries where idempotency_key in ('owner-revoked', 'd-revoked'))
    + (select count(*) from public.student_payment_intents where idempotency_key = 'pay-revoked')
    + (select count(*) from public.student_aid_awards where external_ref = 'seog-2' or (id = award2 and status <> 'offered')), 0);

  -- Re-granted: the same row, revoked_at cleared, as role_grants says a
  -- re-grant is.
  update public.role_grants set revoked_at = null
   where subject = bursar and role = 'student_accounts_officer' and scope_id = 'sa-u';
  perform pg_temp.allowed('re-granting the owner restores the other bursar''s posting', bursar2,
    format($q$select public.post_student_ledger_entry(%L, '2027SP', 'charge', 100, 'Lab fee', 'owner-revoked')$q$, s1));

  -- Expired.
  update public.role_grants set expires_at = now() - interval '1 minute'
   where subject = bursar and role = 'student_accounts_officer' and scope_id = 'sa-u';
  perform pg_temp.off('another bursar posting after the owner''s grant expires', bursar2,
    format($q$select public.post_student_ledger_entry(%L, '2027SP', 'charge', 100, 'Lab fee', 'owner-expired')$q$, s1));
  perform pg_temp.off('the aid office disbursing after it expires', aid,
    format($q$select public.record_aid_disbursement(%L, 1000, 'd-expired')$q$, award2));
  perform pg_temp.off('the student answering an award after it expires', s1,
    format($q$select public.respond_to_aid_award(%L, true)$q$, award2));
  perform pg_temp.off('the student starting a payment after it expires', s1,
    $q$select public.start_student_payment('2027SP', 1, 'pay-expired')$q$);

  -- A live grant, but the owner's profile is now at another school.
  update public.role_grants set expires_at = null
   where subject = bursar and role = 'student_accounts_officer' and scope_id = 'sa-u';
  update public.profiles set school_id = 'sa-far' where user_id = bursar;
  perform pg_temp.off('another bursar posting once the owner is at another school', bursar2,
    format($q$select public.post_student_ledger_entry(%L, '2027SP', 'charge', 100, 'Lab fee', 'owner-moved')$q$, s1));
  update public.profiles set school_id = 'sa-u' where user_id = bursar;

  -- Re-granted after expiry: each write the expiry refused now works.
  perform pg_temp.allowed('re-granting restores the other bursar''s posting', bursar2,
    format($q$select public.post_student_ledger_entry(%L, '2027SP', 'charge', 100, 'Lab fee', 'owner-expired')$q$, s1));
  perform pg_temp.allowed('and the student''s answer to the award', s1,
    format($q$select public.respond_to_aid_award(%L, true)$q$, award2));
  perform pg_temp.allowed('and the student''s payment', s1,
    $q$select public.start_student_payment('2027SP', 1, 'pay-expired')$q$);
  perform pg_temp.allowed('and the aid office''s disbursement', aid,
    format($q$select public.record_aid_disbursement(%L, 1000, 'd-expired')$q$, award2));

  -- ── Deleting an account still removes its rows ──────────────────────────
  perform pg_temp.allowed('a charge for the second student', bursar,
    format($q$select public.post_student_ledger_entry(%L, '2026FA', 'charge', 100, 'Fee', 's2-fee')$q$, s2));
  delete from auth.users where id = s2;
  perform pg_temp.counted('the append-only ledger lets the account deletion cascade',
    (select count(*) from public.student_ledger_entries where student_id = s2), 0);
  n := (select count(*) from public.student_ledger_entries);
  delete from auth.users where id = bursar;
  perform pg_temp.counted('deleting a bursar keeps every entry they posted', (select count(*) from public.student_ledger_entries), n);
  perform pg_temp.counted('with posted_by emptied', (select count(*) from public.student_ledger_entries where posted_by = bursar), 0);
end $$;

rollback;
