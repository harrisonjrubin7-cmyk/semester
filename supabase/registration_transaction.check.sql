-- supabase/registration_transaction.check.sql — the official registration transaction.
--
-- For 20260929300000_registration_transaction.sql. Two students at one
-- school, the school's registrar, and a student and a registrar at another
-- school walk the transaction and are held to what each may and may not do:
--
--   * nothing moves while `writeback.registration_submit` is off, or while
--     `kill.writeback` is engaged — for the school or for every school;
--   * a seat is taken at commit; a stale confirmation writes nothing; a full
--     section waitlists in order; a replayed key returns the stored answer
--     and a reused key with other arguments is refused;
--   * a hold blocks enrolling and its reason reaches the student nowhere;
--   * prerequisites, clashes and the credit ceiling refuse, and a
--     registrar's override lifts exactly the one it names;
--   * a drop inside add/drop promotes the next student who is not blocked;
--     after add/drop a drop is refused and a withdrawal is a W on a kept row;
--   * a student reads only their own enrollments, nobody writes a table
--     directly, the registrar's functions refuse a student, and a registrar
--     at another school sees none of this one.
--
-- `now()` is the transaction's start and does not move, so the calendar is
-- set relative to it and moved by the superuser to cross each deadline.
--
--   How to run it: supabase/check.sh registration_transaction

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

create or replace function pg_temp.said(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

-- A function's jsonb answer, called as `who`.
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

create or replace function pg_temp.seen(who uuid, q text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute 'select count(*) from (' || q || ') t' into n;
  execute 'reset role';
  return n;
end $$;

-- The reason a registration call answered with.
create or replace function pg_temp.reason(who uuid, statement text)
returns text language plpgsql as $$
declare r jsonb := pg_temp.call(who, statement);
begin
  return coalesce(r->>'reason', 'raised: ' || (r->>'raised'));
end $$;

do $$
declare
  ana uuid; ben uuid; cy uuid; reg uuid; outsider uuid; far_reg uuid; pending uuid;
  math uuid; hist uuid; calc uuid; arts uuid; chem uuid; later uuid; theirs uuid;
  r jsonb; n bigint; e text;
begin
  insert into public.schools (id, name, email_domains) values
    ('rt-u', 'Registration University', array['rt-u.example']),
    ('rt-other', 'Other University', array['rt-other.example']);

  ana      := pg_temp.newuser('ana@rt-u.example', 'rt-u');
  ben      := pg_temp.newuser('ben@rt-u.example', 'rt-u');
  cy       := pg_temp.newuser('cy@rt-u.example', 'rt-u');
  reg      := pg_temp.newuser('registrar@rt-u.example', 'rt-u');
  outsider := pg_temp.newuser('student@rt-other.example', 'rt-other');
  far_reg  := pg_temp.newuser('registrar@rt-other.example', 'rt-other');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (reg,     'registrar', 'school', 'rt-u',     'institution'),
    (far_reg, 'registrar', 'school', 'rt-other', 'institution');

  -- ── The registrar sets up; nobody else can ──────────────────────────────
  perform pg_temp.refused('a student setting a term calendar', ana,
    $q$select public.registrar_put_term('2026FA', now() - interval '1 day', now() + interval '1 day', now() + interval '10 days', 12)$q$);
  perform pg_temp.counted('the registrar sets the 2026FA calendar',
    (pg_temp.err(reg, $q$select public.registrar_put_term('2026FA', now() - interval '1 day', now() + interval '1 day', now() + interval '10 days', 12)$q$) is null)::int, 1);
  perform pg_temp.counted('at their own school, which was never a parameter',
    (select count(*) from public.registration_terms where tenant_id = 'rt-u' and term = '2026FA'), 1);
  perform pg_temp.refused('a calendar whose deadlines are out of order', reg,
    $q$select public.registrar_put_term('2026SP', now(), now() - interval '1 day', now() + interval '1 day', 12)$q$);

  perform pg_temp.become(reg);
  math := public.registrar_put_section('2026FA', 'math 101', '01', 'Calculus I', 4, 1, 1,
            '[{"days":[1,3,5],"start":540,"end":590}]', '{}', false);
  hist := public.registrar_put_section('2026FA', 'HIST 100', '01', 'World History', 3, 5, 0,
            '[{"days":[1,3,5],"start":570,"end":620}]', '{}', false);
  calc := public.registrar_put_section('2026FA', 'MATH 201', '01', 'Calculus II', 4, 5, 0,
            '[{"days":[2,4],"start":600,"end":675}]', array['math 101'], false);
  arts := public.registrar_put_section('2026FA', 'ARTS 300', '01', 'Studio', 2, 5, 0,
            '[{"days":[2,4],"start":780,"end":855}]', '{}', true);
  chem := public.registrar_put_section('2026FA', 'CHEM 110', '01', 'Chemistry with lab', 6, 5, 0,
            '[{"days":[5],"start":780,"end":960}]', '{}', false);
  reset role;
  perform pg_temp.counted('the registrar created five sections, the code normalised',
    (select count(*) from public.registration_sections where tenant_id = 'rt-u' and course_code in ('MATH 101', 'HIST 100', 'MATH 201', 'ARTS 300', 'CHEM 110')), 5);
  perform pg_temp.refused('a meeting that ends before it starts', reg,
    $q$select public.registrar_put_section('2026FA', 'BIOL 100', '01', 'Bio', 3, 5, 0, '[{"days":[1],"start":600,"end":540}]', '{}', false)$q$);
  perform pg_temp.refused('a student creating a section', ana,
    $q$select public.registrar_put_section('2026FA', 'BIOL 100', '01', 'Bio', 3, 5, 0, '[]', '{}', false)$q$);

  -- ── Off, until the school turns it on ───────────────────────────────────
  perform pg_temp.said('an enroll while writeback.registration_submit is off',
    pg_temp.reason(ana, format($q$select public.registration_enroll(%L, 'ana-math-0001', 'seat')$q$, math)), 'flag_off');
  insert into public.tenant_feature_policy (tenant_id, capability, state) values ('rt-u', 'writeback.registration_submit', 'sandbox');
  perform pg_temp.said('and while it is only sandbox',
    pg_temp.reason(ana, format($q$select public.registration_enroll(%L, 'ana-math-0001', 'seat')$q$, math)), 'flag_off');
  update public.tenant_feature_policy set state = 'production' where tenant_id = 'rt-u' and capability = 'writeback.registration_submit';
  -- On at the other school too, so a refusal there is about the school, not the flag.
  insert into public.tenant_feature_policy (tenant_id, capability, state) values ('rt-other', 'writeback.registration_submit', 'production');
  perform pg_temp.counted('and the refusals wrote nothing', (select count(*) from public.registration_enrollments), 0);

  -- ── A seat, taken at commit ─────────────────────────────────────────────
  r := pg_temp.call(ana, format($q$select public.registration_enroll(%L, 'ana-math-0001', 'seat')$q$, math));
  perform pg_temp.said('ana enrolls in MATH 101, the one seat', r->>'outcome', 'enrolled');
  perform pg_temp.counted('the section counts it', (select seats_taken from public.registration_sections where id = math), 1);
  r := pg_temp.call(ana, format($q$select public.registration_enroll(%L, 'ana-math-0001', 'seat')$q$, math));
  perform pg_temp.said('the same key again replays the stored answer', r->>'replayed', 'true');
  perform pg_temp.counted('and writes no second row', (select count(*) from public.registration_enrollments where student = ana), 1);
  perform pg_temp.said('the same key for another section is refused',
    pg_temp.reason(ana, format($q$select public.registration_enroll(%L, 'ana-math-0001', 'seat')$q$, hist)), 'idempotency_conflict');
  perform pg_temp.said('a new key for the same section is a duplicate',
    pg_temp.reason(ana, format($q$select public.registration_enroll(%L, 'ana-math-0002')$q$, math)), 'already_enrolled');
  perform pg_temp.refused('a request with no idempotency key', ana,
    format($q$select public.registration_enroll(%L, null)$q$, math));

  -- ── Full: a stale confirmation, then the waitlist ───────────────────────
  perform pg_temp.said('ben confirmed a seat that is gone',
    pg_temp.reason(ben, format($q$select public.registration_enroll(%L, 'ben-math-0001', 'seat')$q$, math)), 'stale_seat_count');
  perform pg_temp.counted('and nothing was written for him', (select count(*) from public.registration_enrollments where student = ben), 0);
  r := pg_temp.call(ben, format($q$select public.registration_enroll(%L, 'ben-math-0002', 'waitlist')$q$, math));
  perform pg_temp.said('ben confirms the waitlist instead', r->>'outcome', 'waitlisted');
  perform pg_temp.said('first in the queue', r->>'wait_position', '1');
  perform pg_temp.said('a full section with a full waitlist refuses a third student',
    pg_temp.reason(cy, format($q$select public.registration_enroll(%L, 'cy-math-0001')$q$, math)), 'full');
  perform pg_temp.said('another school''s student cannot find the section at all',
    pg_temp.reason(outsider, format($q$select public.registration_enroll(%L, 'out-math-0001')$q$, math)), 'unknown_section');

  -- ── Prerequisite, clash, credit ceiling, and overrides ──────────────────
  perform pg_temp.said('ana is refused a clash with MATH 101',
    pg_temp.reason(ana, format($q$select public.registration_enroll(%L, 'ana-hist-0001')$q$, hist)), 'time_conflict');
  perform pg_temp.said('ana is refused MATH 201 without MATH 101 passed',
    pg_temp.reason(ana, format($q$select public.registration_enroll(%L, 'ana-calc-0001')$q$, calc)), 'prerequisite_missing');
  perform pg_temp.said('ana enrolls in CHEM 110, 10 of 12 credits',
    pg_temp.call(ana, format($q$select public.registration_enroll(%L, 'ana-chem-0001')$q$, chem))->>'outcome', 'enrolled');
  perform pg_temp.refused('a student granting themselves an override', ana,
    format($q$select public.registrar_grant_override(%L, %L, array['prerequisite'], 'I asked nicely', 'ana-ovr-0001')$q$, ana, calc));
  perform pg_temp.said('an override naming a hold is refused',
    pg_temp.reason(reg, format($q$select public.registrar_grant_override(%L, %L, array['hold'], 'no', 'reg-ovr-0000')$q$, ana, calc)), 'bad_override');
  perform pg_temp.said('an override with no reason is refused',
    pg_temp.reason(reg, format($q$select public.registrar_grant_override(%L, %L, array['prerequisite'], '  ', 'reg-ovr-0009')$q$, ana, calc)), 'bad_override');
  perform pg_temp.said('the registrar waives MATH 201''s prerequisite for ana',
    pg_temp.call(reg, format($q$select public.registrar_grant_override(%L, %L, array['prerequisite'], 'Transfer credit', 'reg-ovr-0001')$q$, ana, calc))->>'outcome', 'override_granted');
  perform pg_temp.said('which lifts only the prerequisite: 14 credits is over the ceiling',
    pg_temp.reason(ana, format($q$select public.registration_enroll(%L, 'ana-calc-0002')$q$, calc)), 'credit_limit');
  perform pg_temp.said('a registrar at another school cannot override here',
    pg_temp.reason(far_reg, format($q$select public.registrar_grant_override(%L, %L, array['credit_limit'], 'x', 'far-ovr-0001')$q$, ana, calc)), 'unknown_section');
  perform pg_temp.said('the credit override lets ana in',
    pg_temp.call(reg, format($q$select public.registrar_grant_override(%L, %L, array['credit_limit'], 'Honors load', 'reg-ovr-0002')$q$, ana, calc))->>'outcome', 'override_granted');
  perform pg_temp.said('ana enrolls in MATH 201 under both overrides',
    pg_temp.reason(ana, format($q$select public.registration_enroll(%L, 'ana-calc-0003')$q$, calc)), 'ok');

  -- ── A hold, and that its reason goes nowhere ────────────────────────────
  insert into public.registration_holds (tenant_id, student, office, link, reason)
  values ('rt-u', ben, 'Student Accounts', 'https://accounts.rt-u.example', 'Unpaid balance 4210 referred to collections');
  r := pg_temp.call(ben, format($q$select public.registration_enroll(%L, 'ben-arts-0001')$q$, arts));
  perform pg_temp.said('a hold that appeared after ben planned refuses him', r->>'reason', 'hold');
  perform pg_temp.said('naming the office', r->'hold'->>'office', 'Student Accounts');
  perform pg_temp.counted('and never the reason, in the refusal', (r::text like '%4210%' or r::text like '%collections%')::int, 0);
  perform pg_temp.counted('the control: the same probe finds what is there', (r::text like '%Student Accounts%')::int, 1);
  perform pg_temp.counted('my_registration_hold answers whether and which office, without the reason',
    pg_temp.seen(ben, $q$select * from public.my_registration_hold() h where h::text like '%4210%' or h::text like '%collections%'$q$), 0);
  perform pg_temp.counted('and does answer for ben',
    pg_temp.seen(ben, 'select * from public.my_registration_hold() where held'), 1);
  perform pg_temp.counted('and says nothing is held for ana',
    pg_temp.seen(ana, 'select * from public.my_registration_hold() where held'), 0);
  perform pg_temp.refused('ben reading the holds table', ben, 'select reason from public.registration_holds');
  perform pg_temp.refused('the registrar reading the holds table', reg, 'select reason from public.registration_holds');

  -- ── A drop, and a promotion that passes over a blocked head ─────────────
  r := pg_temp.call(ana, format($q$select public.registration_drop(%L, 'ana-drop-0001')$q$, math));
  perform pg_temp.said('ana drops MATH 101 inside add/drop', r->>'outcome', 'dropped');
  perform pg_temp.said('ben is at the head of the queue under a hold, so nobody moved', r->>'promoted', '0');
  perform pg_temp.counted('the dropping student is not told who waits or why',
    (r::text like '%' || ben::text || '%' or r::text like '%hold%')::int, 0);
  perform pg_temp.counted('ben keeps his place',
    (select count(*) from public.registration_enrollments where student = ben and section_id = math and state = 'waitlisted'), 1);
  perform pg_temp.counted('and the registrar''s audit says why he was passed over',
    (select count(*) from public.registration_audit_event where action = 'promotion_skipped' and student = ben and reason = 'hold'), 1);
  perform pg_temp.counted('the drop is kept as history, not deleted',
    (select count(*) from public.registration_enrollments where student = ana and section_id = math and state = 'dropped'), 1);
  update public.registration_holds set released_at = now() where student = ben;
  perform pg_temp.become(reg);
  perform public.registrar_put_section('2026FA', 'MATH 101', '01', 'Calculus I', 4, 1, 1,
            '[{"days":[1,3,5],"start":540,"end":590}]', '{}', false);
  reset role;
  perform pg_temp.counted('with the hold released, the next change to the section seats ben',
    (select count(*) from public.registration_enrollments where student = ben and section_id = math and state = 'enrolled'), 1);
  perform pg_temp.counted('as a promotion in the audit',
    (select count(*) from public.registration_audit_event where action = 'promoted' and student = ben), 1);

  -- ── Approval ────────────────────────────────────────────────────────────
  r := pg_temp.call(ana, format($q$select public.registration_enroll(%L, 'ana-arts-0001')$q$, arts));
  perform pg_temp.said('ARTS 300 waits for the registrar', r->>'outcome', 'pending_approval');
  perform pg_temp.counted('and holds no seat while it waits', (select seats_taken from public.registration_sections where id = arts), 0);
  pending := (r->'enrollment'->>'id')::uuid;
  perform pg_temp.refused('a student deciding an approval', ben,
    format($q$select public.registrar_decide(%L, true, 'sure', 'ben-dec-0001')$q$, pending));
  perform pg_temp.said('a registrar at another school finds nothing to decide',
    pg_temp.reason(far_reg, format($q$select public.registrar_decide(%L, true, 'sure', 'far-dec-0001')$q$, pending)), 'not_pending');
  perform pg_temp.said('the registrar approves, and ana is seated at 12 of 12 credits',
    pg_temp.call(reg, format($q$select public.registrar_decide(%L, true, 'Portfolio reviewed', 'reg-dec-0001')$q$, pending))->>'outcome', 'enrolled');
  pending := (pg_temp.call(ben, format($q$select public.registration_enroll(%L, 'ben-arts-0002')$q$, arts))->'enrollment'->>'id')::uuid;
  insert into public.registration_holds (tenant_id, student, office, link, reason)
  values ('rt-u', ben, 'Advising', 'https://advising.rt-u.example', 'Missed mandatory advising');
  perform pg_temp.said('an approval is re-checked against now: a hold that arrived while it waited stops it',
    pg_temp.reason(reg, format($q$select public.registrar_decide(%L, true, 'Portfolio reviewed', 'reg-dec-0002')$q$, pending)), 'hold');
  perform pg_temp.said('the registrar declines it instead',
    pg_temp.call(reg, format($q$select public.registrar_decide(%L, false, 'Section is for majors', 'reg-dec-0003')$q$, pending))->>'outcome', 'denied');
  perform pg_temp.counted('kept as a denial, not deleted',
    (select count(*) from public.registration_enrollments where id = pending and state = 'denied'), 1);
  update public.registration_holds set released_at = now() where student = ben;

  -- ── Who reads what, and that nobody writes directly ─────────────────────
  perform pg_temp.counted('ana reads her own enrollments',
    pg_temp.seen(ana, 'select * from public.registration_enrollments'), (select count(*) from public.registration_enrollments where student = ana));
  perform pg_temp.counted('and none of ben''s',
    pg_temp.seen(ana, format('select * from public.registration_enrollments where student = %L', ben)), 0);
  perform pg_temp.counted('my_registration gives ana her own rows only',
    pg_temp.seen(ana, $q$select * from public.my_registration('2026FA')$q$), (select count(*) from public.registration_enrollments where student = ana));
  perform pg_temp.counted('the registrar reads the school''s enrollments',
    pg_temp.seen(reg, 'select * from public.registration_enrollments'), (select count(*) from public.registration_enrollments));
  perform pg_temp.counted('a registrar at another school reads none of them',
    pg_temp.seen(far_reg, 'select * from public.registration_enrollments'), 0);
  perform pg_temp.counted('a student reads no audit',
    pg_temp.seen(ana, 'select * from public.registration_audit_event'), 0);
  perform pg_temp.counted('the registrar reads every audit row',
    pg_temp.seen(reg, 'select * from public.registration_audit_event'), (select count(*) from public.registration_audit_event));
  perform pg_temp.counted('another school''s student reads none of these sections',
    pg_temp.seen(outsider, 'select * from public.registration_sections'), 0);
  perform pg_temp.refused('ana inserting an enrollment directly', ana,
    format($q$insert into public.registration_enrollments (tenant_id, section_id, student, state) values ('rt-u', %L, %L, 'enrolled')$q$, hist, ana));
  perform pg_temp.refused('ana raising a section''s capacity directly', ana,
    format($q$update public.registration_sections set capacity = 100 where id = %L$q$, math));
  perform pg_temp.refused('the registrar deleting an enrollment directly', reg, 'delete from public.registration_enrollments');
  perform pg_temp.refused('ana writing an override directly', ana,
    format($q$insert into public.registration_overrides (tenant_id, section_id, student, waives, reason) values ('rt-u', %L, %L, array['capacity'], 'me')$q$, math, ana));
  perform pg_temp.refused('ana writing a completion directly', ana,
    $q$insert into public.registration_completions (tenant_id, student, course_code) values ('rt-u', auth.uid(), 'MATH 101')$q$);
  perform pg_temp.counted('a signed-out visitor cannot call enroll',
    has_function_privilege('anon', 'public.registration_enroll(uuid, text, text)', 'execute')::int, 0);

  -- ── The kill switch ─────────────────────────────────────────────────────
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason, engaged_at)
  values ('rt-u', 'kill.writeback', true, 'registration check', now());
  perform pg_temp.said('kill.writeback for this school stops a drop',
    pg_temp.reason(ana, format($q$select public.registration_drop(%L, 'ana-drop-0002')$q$, chem)), 'kill_switch');
  perform pg_temp.said('and a registrar override',
    pg_temp.reason(reg, format($q$select public.registrar_grant_override(%L, %L, array['capacity'], 'x', 'reg-ovr-0003')$q$, ben, hist)), 'kill_switch');
  perform pg_temp.said('a committed request still replays: it writes nothing',
    pg_temp.call(ana, format($q$select public.registration_enroll(%L, 'ana-chem-0001')$q$, chem))->>'replayed', 'true');
  update public.feature_kill_switch set engaged = false where tenant_id = 'rt-u' and switch_key = 'kill.writeback';
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason, engaged_at)
  values (null, 'kill.writeback', true, 'every school', now());
  perform pg_temp.said('the global switch stops it too, and outranks the flag',
    pg_temp.reason(ana, format($q$select public.registration_drop(%L, 'ana-drop-0002')$q$, chem)), 'kill_switch');
  perform pg_temp.counted('CHEM 110 is still ana''s',
    (select count(*) from public.registration_enrollments where student = ana and section_id = chem and state = 'enrolled'), 1);
  delete from public.feature_kill_switch where tenant_id is null and switch_key = 'kill.writeback';

  -- ── Before it opens ─────────────────────────────────────────────────────
  perform pg_temp.become(reg);
  perform public.registrar_put_term('2027SP', now() + interval '30 days', now() + interval '45 days', now() + interval '60 days', 12);
  later := public.registrar_put_section('2027SP', 'HIST 200', '01', 'Later History', 3, 5, 0, '[]', '{}', false);
  reset role;
  perform pg_temp.said('a term that has not opened refuses',
    pg_temp.reason(ana, format($q$select public.registration_enroll(%L, 'ana-late-0001')$q$, later)), 'window_not_open');

  -- ── After add/drop: no drop, a W, and no re-sold seat ───────────────────
  perform pg_temp.said('a withdrawal while add/drop is open is refused: drop instead',
    pg_temp.reason(ana, format($q$select public.registration_withdraw(%L, 'ana-wd-0000')$q$, chem)), 'withdraw_not_yet');
  update public.registration_terms
     set opens_at = now() - interval '10 days', add_drop_ends_at = now() - interval '1 hour'
   where tenant_id = 'rt-u' and term = '2026FA';
  perform pg_temp.said('after add/drop, a drop is refused',
    pg_temp.reason(ana, format($q$select public.registration_drop(%L, 'ana-drop-0003')$q$, chem)), 'drop_deadline_passed');
  perform pg_temp.said('and an enroll finds the window closed',
    pg_temp.reason(ben, format($q$select public.registration_enroll(%L, 'ben-hist-0001')$q$, hist)), 'window_closed');
  r := pg_temp.call(ana, format($q$select public.registration_withdraw(%L, 'ana-wd-0001')$q$, chem));
  perform pg_temp.said('ana withdraws from CHEM 110', r->>'outcome', 'withdrawn');
  perform pg_temp.counted('as a W on the row that is kept',
    (select count(*) from public.registration_enrollments where student = ana and section_id = chem and state = 'withdrawn' and grade = 'W'), 1);
  perform pg_temp.counted('and the seat is not re-sold', (r->>'promoted')::bigint, 0);
  update public.registration_terms set withdraw_ends_at = now() - interval '1 minute'
   where tenant_id = 'rt-u' and term = '2026FA';
  perform pg_temp.said('after the withdrawal deadline, a withdrawal is refused',
    pg_temp.reason(ana, format($q$select public.registration_withdraw(%L, 'ana-wd-0002')$q$, calc)), 'withdraw_deadline_passed');

  -- ── Every change was audited ────────────────────────────────────────────
  perform pg_temp.counted('every committed request has an audit row naming its enrollment',
    (select count(*) from public.registration_requests q
      where q.action in ('enroll', 'drop', 'withdraw')
        and not exists (select 1 from public.registration_audit_event a
                         where a.enrollment_id = (q.result->'enrollment'->>'id')::uuid)), 0);
  perform pg_temp.counted('the control: there are committed requests to check',
    ((select count(*) from public.registration_requests where action in ('enroll', 'drop', 'withdraw')) >= 8)::int, 1);

  -- ── The last seat: every writer that moves a seat holds both locks ──────
  --
  -- One transaction cannot race itself, so this is structural: each writer
  -- that can take or free a seat takes the term's advisory lock and then
  -- re-reads the section row `for update` before deciding on its count.
  -- Without them, two sessions each read seats_taken = capacity - 1 and both
  -- insert — measured on a kept cluster when this was written (the commit
  -- says how). The control is a writer that moves no seat and needs neither.
  select string_agg(p.proname, ', ' order by p.proname) into e
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('registration_enroll', 'registration_drop', 'registration_withdraw',
                       'registrar_grant_override', 'registrar_decide')
     and not (p.prosrc ~ 'private\.registration_lock_term\('
              and p.prosrc ~ 'from public\.registration_sections[^;]*for update');
  perform pg_temp.counted('the five seat-moving writers are there to read',
    (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('registration_enroll', 'registration_drop', 'registration_withdraw',
                        'registrar_grant_override', 'registrar_decide')), 5);
  perform pg_temp.said('every seat-moving writer locks the term and then the section row', coalesce(e, 'all five'), 'all five');
  perform pg_temp.counted('the control: the probe does not find the row lock in a reader',
    (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'my_registration'
        and prosrc ~ 'from public\.registration_sections[^;]*for update'), 0);
end $$;

-- ── The flag's narrowing holds at the database ─────────────────────────────
--
-- 20260929370000_feature_policy_narrowing.sql. A pilot limited to a cohort,
-- or to a role, is limited at `registration_enroll` — not only on the screen.
-- The registrar is not narrowed: their writes act on the school's
-- registration. The control comes first: with both lists empty, the same
-- student enrolls.
do $$
declare
  reg uuid; sam uuid; mo uuid; lee uuid; s1 uuid; s2 uuid; s3 uuid; r jsonb;
begin
  insert into public.schools (id, name, email_domains) values ('rn-u', 'Pilot University', array['rn-u.example']);
  reg := pg_temp.newuser('registrar@rn-u.example', 'rn-u');
  sam := pg_temp.newuser('sam@rn-u.example', 'rn-u');   -- in no cohort
  mo  := pg_temp.newuser('mo@rn-u.example', 'rn-u');    -- in the pilot cohort
  lee := pg_temp.newuser('lee@rn-u.example', 'rn-u');   -- holds undergraduate_student here
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (reg, 'registrar',             'school', 'rn-u', 'institution'),
    (lee, 'undergraduate_student', 'school', 'rn-u', 'institution'),
    -- The role somewhere else is not the role here.
    (sam, 'undergraduate_student', 'school', 'rt-u', 'institution');
  perform pg_temp.become(reg);
  perform public.registrar_put_term('2026FA', now() - interval '1 day', now() + interval '1 day', now() + interval '10 days', 18);
  s1 := public.registrar_put_section('2026FA', 'PLT 101', '01', 'One', 3, 20, 0, '[]', '{}', false);
  s2 := public.registrar_put_section('2026FA', 'PLT 102', '01', 'Two', 3, 20, 0, '[]', '{}', false);
  s3 := public.registrar_put_section('2026FA', 'PLT 103', '01', 'Three', 3, 20, 0, '[]', '{}', false);
  reset role;
  insert into public.tenant_feature_policy (tenant_id, capability, state) values ('rn-u', 'writeback.registration_submit', 'production');

  perform pg_temp.said('with no narrowing, a student enrolls',
    pg_temp.call(sam, format($q$select public.registration_enroll(%L, 'rn-sam-00001')$q$, s1))->>'outcome', 'enrolled');

  -- A cohort pilot.
  update public.tenant_feature_policy set permitted_cohorts = array['reg-pilot-2027']
   where tenant_id = 'rn-u' and capability = 'writeback.registration_submit';
  insert into public.feature_cohort_members (tenant_id, cohort, user_id) values ('rn-u', 'reg-pilot-2027', mo);
  perform pg_temp.said('a student outside the cohort enrolling',
    pg_temp.reason(sam, format($q$select public.registration_enroll(%L, 'rn-sam-00002')$q$, s2)), 'flag_off');
  perform pg_temp.said('or dropping',
    pg_temp.reason(sam, format($q$select public.registration_drop(%L, 'rn-sam-drop-1')$q$, s1)), 'flag_off');
  perform pg_temp.counted('and the refusals wrote nothing',
    (select count(*) from public.registration_enrollments where student = sam and state = 'enrolled'), 1);
  perform pg_temp.said('a member of the cohort enrolls',
    pg_temp.call(mo, format($q$select public.registration_enroll(%L, 'rn-mo-000001')$q$, s1))->>'outcome', 'enrolled');
  update public.feature_cohort_members set removed_at = now() where user_id = mo;
  perform pg_temp.said('a member removed from the cohort is refused',
    pg_temp.reason(mo, format($q$select public.registration_enroll(%L, 'rn-mo-000002')$q$, s2)), 'flag_off');
  perform pg_temp.said('the registrar, in no cohort, is not narrowed: an override still lands',
    pg_temp.call(reg, format($q$select public.registrar_grant_override(%L, %L, array['credit_limit'], 'Pilot load', 'rn-reg-ovr-01')$q$, sam, s3))->>'outcome', 'override_granted');

  -- A role pilot.
  update public.tenant_feature_policy set permitted_cohorts = '{}', permitted_roles = array['undergraduate_student']
   where tenant_id = 'rn-u' and capability = 'writeback.registration_submit';
  perform pg_temp.said('a student without the role here enrolling',
    pg_temp.reason(sam, format($q$select public.registration_enroll(%L, 'rn-sam-00003')$q$, s2)), 'flag_off');
  perform pg_temp.said('a student with the role here enrolls',
    pg_temp.call(lee, format($q$select public.registration_enroll(%L, 'rn-lee-00001')$q$, s2))->>'outcome', 'enrolled');
end $$;

rollback;
