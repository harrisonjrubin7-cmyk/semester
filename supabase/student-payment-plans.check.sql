-- Payment plans on student accounts (D-146): a plan is asked for only by
-- the student it concerns or by Student Accounts; the database reads the
-- balance from the ledger and writes the schedule by the school's rules,
-- summing to the cent; one plan is live at a time; nobody edits a plan or its
-- schedule; someone other than the asker decides it, and only for the balance
-- it was asked for and before its first payment is past; an agreed plan is
-- cancelled only by an approver, with a reason; a student reads their own
-- plans and no one else's; and an account's deletion leaves the plan with the
-- school. Every refusal is attempted as the account that should be refused.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh student-payment-plans

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
create or replace function pg_temp.request(who uuid, kind text, category text, cents bigint, eff date, student text default 'S100')
returns uuid language plpgsql as $$
begin
  return pg_temp.value_as(who, format(
    'insert into public.student_account_requests (tenant_id, student_ref, kind, category, amount_cents, description, effective_on)
     values (''sp-u'', %L, %L, %L, %s, %L, %L) returning id',
    student, kind, category, cents, 'Fall 2026 ' || kind, eff))::uuid;
end $$;

create or replace function pg_temp.decide(who uuid, req uuid, to_status text)
returns text language plpgsql as $$
begin
  return pg_temp.error_as(who, format('update public.student_account_requests set status = %L where id = %L', to_status, req));
end $$;

-- As the owner of the tables, with no role switch: the refusals no grant makes.
create or replace function pg_temp.error_owner(q text)
returns text language plpgsql as $$
begin
  execute q;
  return null;
exception when others then
  return sqlerrm;
end $$;

-- A plan asked for as someone: null and its id, or the refusal.
create or replace function pg_temp.ask(who uuid, n int, first date, student text default 'S100')
returns text language plpgsql as $$
begin
  return pg_temp.error_as(who, format(
    'insert into public.student_payment_plans (tenant_id, student_ref, installments, first_due) values (''sp-u'', %L, %s, %L)', student, n, first));
end $$;

create or replace function pg_temp.live(student text default 'S100')
returns uuid language sql as $$
  select id from public.student_payment_plans where tenant_id = 'sp-u' and student_ref = student and status in ('proposed', 'approved');
$$;

create or replace function pg_temp.plan_set(who uuid, plan uuid, sets text)
returns text language plpgsql as $$
begin
  return pg_temp.error_as(who, format('update public.student_payment_plans set %s where id = %L', sets, plan));
end $$;

do $$
declare
  off1 uuid; off2 uuid; aid uuid; adm uuid; student uuid; other uuid; lone uuid; far uuid;
  r uuid; plan uuid; first_plan uuid; audits bigint;
  today date := current_date;
begin
  insert into public.schools (id, name, email_domains) values
    ('sp-u', 'Payment Plan University', array['sp-u.example']),
    ('sp-other', 'Other University', array['sp-other.example']);

  off1    := pg_temp.newuser('off1@sp-u.example', 'sp-u');
  off2    := pg_temp.newuser('off2@sp-u.example', 'sp-u');
  aid     := pg_temp.newuser('aid@sp-u.example', 'sp-u');
  adm     := pg_temp.newuser('adm@sp-u.example', 'sp-u');
  student := pg_temp.newuser('student@sp-u.example', 'sp-u');
  other   := pg_temp.newuser('other@sp-u.example', 'sp-u');
  lone    := pg_temp.newuser('lone@sp-u.example', 'sp-u');
  far     := pg_temp.newuser('off@sp-other.example', 'sp-other');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (off1,    'student_accounts_officer', 'school', 'sp-u',     'institution'),
    (off2,    'student_accounts_officer', 'school', 'sp-u',     'institution'),
    (aid,     'financial_aid_officer',    'school', 'sp-u',     'institution'),
    (adm,     'business_admin',           'school', 'sp-u',     'institution'),
    (student, 'student',                  'school', 'sp-u',     'institution'),
    (other,   'student',                  'school', 'sp-u',     'institution'),
    (lone,    'student',                  'school', 'sp-u',     'institution'),
    (far,     'student_accounts_officer', 'school', 'sp-other', 'institution');
  insert into public.academic_record_subjects (tenant_id, student_ref, user_id) values
    ('sp-u', 'S100', student), ('sp-u', 'S200', other);

  -- S100 owes $5,000.45: tuition and a lab fee, each approved by someone else.
  r := pg_temp.request(off1, 'charge', 'tuition', 500000, today - 10);
  perform pg_temp.runs_clean('the tuition is posted', pg_temp.decide(off2, r, 'approved'));
  r := pg_temp.request(off1, 'charge', 'fees', 45, today - 5);
  perform pg_temp.runs_clean('and a lab fee', pg_temp.decide(off2, r, 'approved'));
  -- A charge for next term is on the account and not owed yet.
  r := pg_temp.request(off1, 'charge', 'tuition', 450000, today + 60);
  perform pg_temp.runs_clean('and next term''s tuition, not yet owed', pg_temp.decide(off2, r, 'approved'));

  -- ── who may ask ───────────────────────────────────────────────────────
  perform pg_temp.says('an unlinked student cannot ask for a plan on another''s account',
    pg_temp.ask(lone, 4, today), 'Only the student, or Student Accounts');
  perform pg_temp.says('nor can a student linked to a different record',
    pg_temp.ask(other, 4, today), 'Only the student, or Student Accounts');
  perform pg_temp.says('nor an officer at another school',
    pg_temp.ask(far, 4, today), 'Only the student, or Student Accounts');

  -- ── the school's rules ────────────────────────────────────────────────
  perform pg_temp.says('seven payments is more than the default rule allows',
    pg_temp.ask(student, 7, today), 'between 2 and 6 payments');
  perform pg_temp.says('one payment is not a plan',
    pg_temp.ask(student, 1, today), 'between 2 and 6 payments');
  perform pg_temp.says('a first payment in the past is refused',
    pg_temp.ask(student, 4, today - 1), 'between today and 30 days');
  perform pg_temp.says('and one more than 30 days out',
    pg_temp.ask(student, 4, today + 31), 'between today and 30 days');
  perform pg_temp.says('a student who owes nothing has nothing to spread',
    pg_temp.ask(other, 4, today, 'S200'), 'nothing owed');
  perform pg_temp.says('a first payment of nothing is not a rule a school can set',
    pg_temp.error_as(adm, $q$insert into public.student_account_settings (tenant_id, plan_min_down_percent) values ('sp-u', 0)$q$),
    'student_account_settings_plan_min_down_percent_check');
  perform pg_temp.says('nor a monthly minimum of nothing',
    pg_temp.error_as(adm, $q$insert into public.student_account_settings (tenant_id, plan_min_installment_cents) values ('sp-u', 0)$q$),
    'student_account_settings_plan_min_installment_cents_check');
  perform pg_temp.runs_clean('a business administrator sets a $1,000 monthly minimum',
    pg_temp.error_as(adm, $q$insert into public.student_account_settings (tenant_id, plan_min_installment_cents) values ('sp-u', 100000)$q$));
  perform pg_temp.says('six payments would each be under it',
    pg_temp.ask(student, 6, today), 'under the school''s minimum');
  perform pg_temp.runs_clean('the student asks to spread it over four',
    pg_temp.error_as(student, format($q$insert into public.student_payment_plans (tenant_id, student_ref, installments, first_due, balance_cents)
      values ('sp-u', 'S100', 4, %L, 1)$q$, today)));
  plan := pg_temp.live();
  first_plan := plan;

  -- ── the schedule the database wrote ───────────────────────────────────
  perform pg_temp.counted('the balance is the ledger''s today, not the one the student sent',
    (select balance_cents from public.student_payment_plans where id = plan), 500045);
  perform pg_temp.counted('and the asker is the student',
    (select count(*) from public.student_payment_plans where id = plan and requested_by = student and status = 'proposed'), 1);
  perform pg_temp.counted('four payments',
    (select count(*) from public.student_payment_plan_installments where plan_id = plan), 4);
  perform pg_temp.counted('that sum to the balance to the cent',
    (select sum(cents)::bigint from public.student_payment_plan_installments where plan_id = plan), 500045);
  perform pg_temp.counted('10% first, rounded up: $500.05 today',
    (select cents from public.student_payment_plan_installments where plan_id = plan and seq = 1 and due_on = today), 50005);
  perform pg_temp.counted('then $1,500.13 a month',
    (select count(*) from public.student_payment_plan_installments where plan_id = plan and seq in (2, 3) and cents = 150013), 2);
  perform pg_temp.counted('the last absorbing the rounding, three months on',
    (select cents from public.student_payment_plan_installments where plan_id = plan and seq = 4 and due_on = (today + interval '3 months')::date), 150014);

  -- ── one at a time, and nothing edited ─────────────────────────────────
  perform pg_temp.says('a second plan while one is waiting is refused',
    pg_temp.ask(student, 3, today), 'student_payment_plans_one_live');
  perform pg_temp.says('the student does not change the number of payments',
    pg_temp.plan_set(student, plan, 'installments = 2'), 'A plan is not edited');
  perform pg_temp.says('nor the balance',
    pg_temp.plan_set(student, plan, 'balance_cents = 1'), 'A plan is not edited');
  perform pg_temp.says('nobody changes the schedule',
    pg_temp.error_as(student, format('update public.student_payment_plan_installments set cents = 1 where plan_id = %L', plan)), 'permission denied');
  perform pg_temp.says('not even the owner',
    pg_temp.error_owner(format('update public.student_payment_plan_installments set cents = 1 where plan_id = %L', plan)), 'does not change');

  -- ── who decides ───────────────────────────────────────────────────────
  perform pg_temp.says('the student does not approve their own plan',
    pg_temp.plan_set(student, plan, $q$status = 'approved'$q$), 'cannot decide payment plans');
  perform pg_temp.runs_clean('an aid officer''s approval reaches no row', pg_temp.plan_set(aid, plan, $q$status = 'approved'$q$));
  perform pg_temp.counted('and the plan is still waiting',
    (select count(*) from public.student_payment_plans where id = plan and status = 'proposed'), 1);

  -- A charge posted since the plan was asked for changes the balance.
  r := pg_temp.request(off1, 'charge', 'fees', 1000, today);
  perform pg_temp.runs_clean('a late fee is posted', pg_temp.decide(off2, r, 'approved'));
  perform pg_temp.says('a plan for a balance that has changed is not approved',
    pg_temp.plan_set(off2, plan, $q$status = 'approved'$q$), 'The balance has changed');
  perform pg_temp.says('a card number in the reason is refused',
    pg_temp.plan_set(off2, plan, $q$status = 'rejected', decision_note = 'card 4242 4242 4242 4242'$q$), 'student_payment_plan_no_pan');
  perform pg_temp.runs_clean('another student''s withdrawal reaches no row',
    pg_temp.plan_set(other, plan, $q$status = 'withdrawn'$q$));
  perform pg_temp.counted('(their update reached no row, so nothing changed)',
    (select count(*) from public.student_payment_plans where id = plan and status = 'proposed'), 1);
  perform pg_temp.runs_clean('the student withdraws it', pg_temp.plan_set(student, plan, $q$status = 'withdrawn'$q$));
  perform pg_temp.says('a withdrawn plan stays withdrawn',
    pg_temp.plan_set(off2, plan, $q$status = 'approved'$q$), 'Nothing else changes');

  perform pg_temp.runs_clean('and asks again, for the new balance', pg_temp.ask(student, 4, today));
  plan := pg_temp.live();
  perform pg_temp.counted('which the database read again',
    (select balance_cents from public.student_payment_plans where id = plan), 501045);
  perform pg_temp.runs_clean('someone else approves it', pg_temp.plan_set(off2, plan, $q$status = 'approved', decision_note = 'Agreed by phone'$q$));
  perform pg_temp.counted('as themselves',
    (select count(*) from public.student_payment_plans where id = plan and status = 'approved' and decided_by = off2 and decided_at is not null), 1);
  perform pg_temp.says('an agreed plan is not withdrawn',
    pg_temp.plan_set(student, plan, $q$status = 'withdrawn'$q$), 'Nothing else changes');
  perform pg_temp.says('nor re-decided',
    pg_temp.plan_set(off1, plan, $q$status = 'rejected'$q$), 'Nothing else changes');

  -- ── cancelling an agreed plan ─────────────────────────────────────────
  perform pg_temp.says('cancelling needs a reason',
    pg_temp.plan_set(off1, plan, $q$status = 'cancelled'$q$), 'student_payment_plan_cancel_reason');
  perform pg_temp.runs_clean('an aid officer''s cancellation reaches no row',
    pg_temp.plan_set(aid, plan, $q$status = 'cancelled', cancel_note = 'Missed two payments'$q$));
  perform pg_temp.says('the student does not cancel it',
    pg_temp.plan_set(student, plan, $q$status = 'cancelled', cancel_note = 'I changed my mind'$q$), 'cannot cancel payment plans');
  perform pg_temp.runs_clean('an approver cancels it, with the reason',
    pg_temp.plan_set(off1, plan, $q$status = 'cancelled', cancel_note = 'Missed two payments'$q$));
  perform pg_temp.counted('the approval stays on the record, and the canceller is named',
    (select count(*) from public.student_payment_plans where id = plan and decided_by = off2 and decision_note = 'Agreed by phone' and cancelled_by = off1), 1);
  perform pg_temp.says('a cancelled plan stays cancelled',
    pg_temp.plan_set(off2, plan, $q$status = 'approved'$q$), 'Nothing else changes');

  -- ── staff ask too, and still do not decide their own ──────────────────
  r := pg_temp.request(off1, 'charge', 'housing', 300000, today - 1, 'S200');
  perform pg_temp.runs_clean('S200''s housing is posted', pg_temp.decide(off2, r, 'approved'));
  perform pg_temp.runs_clean('an officer asks for a plan for S200', pg_temp.ask(off1, 3, today + 7, 'S200'));
  perform pg_temp.says('and does not approve it',
    pg_temp.plan_set(off1, pg_temp.live('S200'), $q$status = 'approved'$q$), 'does not decide it');
  perform pg_temp.runs_clean('a colleague does', pg_temp.plan_set(off2, pg_temp.live('S200'), $q$status = 'approved'$q$));

  -- A plan approved after its first payment date has passed.
  perform pg_temp.runs_clean('S100 asks once more', pg_temp.ask(student, 2, today));
  plan := pg_temp.live();
  set local session_replication_role = replica;
  update public.student_payment_plans set first_due = today - 1 where id = plan;
  set local session_replication_role = origin;
  perform pg_temp.says('a plan whose first payment has passed is asked for again',
    pg_temp.plan_set(off2, plan, $q$status = 'approved'$q$), 'first payment date has passed');
  perform pg_temp.runs_clean('so it is rejected', pg_temp.plan_set(off2, plan, $q$status = 'rejected', decision_note = 'Ask again with a new date'$q$));

  -- ── who reads what ────────────────────────────────────────────────────
  perform pg_temp.counted('the student reads their own plans, every one', pg_temp.seen(student, 'select * from public.student_payment_plans'), 3);
  perform pg_temp.counted('and every payment of them', pg_temp.seen(student, 'select * from public.student_payment_plan_installments'), 10);
  perform pg_temp.counted('another student reads only theirs', pg_temp.seen(other, 'select * from public.student_payment_plans'), 1);
  perform pg_temp.counted('and none of S100''s schedule',
    pg_temp.seen(other, format('select * from public.student_payment_plan_installments where plan_id = %L', first_plan)), 0);
  perform pg_temp.counted('an unlinked student reads none', pg_temp.seen(lone, 'select * from public.student_payment_plans'), 0);
  perform pg_temp.counted('an aid officer reads the school''s', pg_temp.seen(aid, 'select * from public.student_payment_plans'), 4);
  perform pg_temp.counted('an officer at another school reads none', pg_temp.seen(far, 'select * from public.student_payment_plans'), 0);

  -- ── a school that does not offer plans ────────────────────────────────
  perform pg_temp.runs_clean('the school stops offering plans',
    pg_temp.error_as(adm, $q$update public.student_account_settings set plans_offered = false where tenant_id = 'sp-u'$q$));
  perform pg_temp.says('and none is asked for',
    pg_temp.ask(student, 2, today), 'does not offer payment plans');

  -- ── audit ─────────────────────────────────────────────────────────────
  -- Four plans asked for (the refusals wrote nothing), and five decisions,
  -- withdrawals and cancellations that succeeded: a withdrawal, two
  -- approvals, a cancellation and a rejection. The first-date change was made
  -- with triggers off, so it wrote nothing either.
  select count(*) into audits from public.tenant_policy_audit_event where tenant_id = 'sp-u' and entity_type = 'student_payment_plans';
  perform pg_temp.counted('every change to a plan is audited, and nothing refused is', audits, 9);

  -- ── an account goes; the plan stays with the school ───────────────────
  perform set_config('request.jwt.claims', '', true);
  delete from auth.users where id = student;
  perform pg_temp.counted('the student''s plans stay, no longer naming them',
    (select count(*) from public.student_payment_plans where student_ref = 'S100' and requested_by is null), 3);
  perform pg_temp.counted('with their schedules',
    (select count(*) from public.student_payment_plan_installments i join public.student_payment_plans p on p.id = i.plan_id where p.student_ref = 'S100'), 10);
  delete from auth.users where id = off1;
  perform pg_temp.counted('the canceller goes, and the cancellation stays',
    (select count(*) from public.student_payment_plans where status = 'cancelled' and cancelled_by is null and cancel_note = 'Missed two payments'), 1);
end $$;

rollback;
