-- Minimum age 13, and minors (13–17) out of discovery, matching, messaging
-- and employer visibility until they turn 18 (20260929150000_minimum_age).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- What must hold:
--   * an account with no stated age is created as before, and is not a minor
--     — every other suite here makes accounts that way;
--   * a birth date under 13 at sign-up is refused by the database, not a form;
--   * a minor's account keeps no birth date anywhere: the metadata loses it,
--     and the private table holds only the day they turn 18;
--   * an adult's keeps no date at all;
--   * a minor is not a verified student (so every policy that asks refuses),
--     but is a verified account, and may still report and share with a
--     guardian;
--   * a minor cannot ask for a mentor, send or receive a connection, opt into
--     study matching, or opt into employer visibility — however the row
--     arrives;
--   * on the day they turn 18 the rules lift, with nothing to run;
--   * an age is stated once and never changed; under 13 is recorded as such;
--   * a self-declared `student_context.is_minor` only ever makes it stricter;
--   * nobody can read the table, and a visitor cannot state an age.
--
--   How to run it: supabase/check.sh minimum-age

begin;
-- This suite tests the age rules themselves, so it turns off check.sh's
-- fixture that records every other suite's accounts as adults.
set local semester.fixture_age = 'off';

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.become_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end $$;

create or replace function pg_temp.answered(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, coalesce(want, 'null'), coalesce(got, 'null');
  end if;
  raise notice 'ok  %', what;
end $$;

-- An account, with or without a stated birth date. Returns null when the
-- database refuses it, with the refusal's message in `last_refusal`.
create or replace function pg_temp.account(address text, born date)
returns uuid language plpgsql as $$
declare made uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
  values (made, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now(),
          case when born is null then '{}'::jsonb else jsonb_build_object('birth_date', born::text) end);
  return made;
exception when others then
  perform set_config('semester.last_refusal', sqlerrm, true);
  return null;
end $$;

-- Whether a statement, run as someone, is refused.
create or replace function pg_temp.refused(who uuid, stmt text)
returns boolean language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute stmt;
  reset role;
  return false;
exception when others then
  reset role;
  return true;
end $$;

do $$
declare
  nobody uuid; young uuid; teen uuid; adult uuid; parent uuid; unsaid uuid; child_later uuid; self_said uuid; flip uuid; grown uuid;
  n bigint;
  o text;
begin
  -- ── Sign-up ─────────────────────────────────────────────────────────────
  nobody := pg_temp.account('nobody@age.example', null);
  perform pg_temp.answered('an account with no stated age is created', (nobody is not null)::text, 'true');

  young := pg_temp.account('young@age.example', (current_date - interval '12 years 11 months')::date);
  perform pg_temp.answered('under 13 is refused at sign-up', (young is null)::text, 'true');
  perform pg_temp.answered('with the sentence invite.ts explains', current_setting('semester.last_refusal', true), 'semester: under the minimum age');
  select count(*) into n from auth.users where email = 'young@age.example';
  perform pg_temp.answered('and no account is left behind', n::text, '0');

  teen := pg_temp.account('teen@age.example', (current_date - interval '15 years')::date);
  adult := pg_temp.account('adult@age.example', (current_date - interval '20 years')::date);
  parent := pg_temp.account('parent@age.example', (current_date - interval '45 years')::date);
  perform pg_temp.answered('13 to 17 may make an account', (teen is not null)::text, 'true');

  select count(*) into n from auth.users where id in (teen, adult) and raw_user_meta_data ? 'birth_date';
  perform pg_temp.answered('the birth date leaves the metadata as soon as it is read', n::text, '0');
  select minor_until::text into o from private.account_ages where user_id = teen;
  perform pg_temp.answered('a minor keeps only the day they turn 18', o, ((current_date - interval '15 years') + interval '18 years')::date::text);
  select coalesce(minor_until::text, 'none') into o from private.account_ages where user_id = adult;
  perform pg_temp.answered('an adult keeps no date at all', o, 'none');

  -- ── What a minor is, and is not ─────────────────────────────────────────
  perform pg_temp.become(teen);
  perform pg_temp.answered('a minor is not a verified student', private.verified_student()::text, 'false');
  perform pg_temp.answered('but is a verified account', private.verified_account()::text, 'true');
  perform pg_temp.answered('and sees their standing as minor', public.my_age_status(), 'minor');
  reset role;
  perform pg_temp.become(adult);
  perform pg_temp.answered('an adult is a verified student', private.verified_student()::text, 'true');
  perform pg_temp.answered('and sees their standing as adult', public.my_age_status(), 'adult');
  reset role;
  perform pg_temp.become(nobody);
  perform pg_temp.answered('an account that never said is kept out until it does', private.verified_student()::text, 'false');
  perform pg_temp.answered('but is still a verified account', private.verified_account()::text, 'true');
  perform pg_temp.answered('and sees its standing as unknown', public.my_age_status(), 'unknown');
  reset role;
  begin
    insert into public.connections (requester, addressee) values (adult, nobody);
    raise exception 'FAILED: a connection reached an account that never said its age';
  exception when insufficient_privilege then raise notice 'ok  nor can anybody connect to it';
  end;

  perform pg_temp.answered('a minor cannot pick a classmate profile',
    pg_temp.refused(teen, format($q$insert into public.profiles (user_id, handle) values (%L, 'teen')$q$, teen))::text, 'true');
  perform pg_temp.answered('an adult can',
    pg_temp.refused(adult, format($q$insert into public.profiles (user_id, handle) values (%L, 'adult')$q$, adult))::text, 'false');

  perform pg_temp.answered('a minor may still report',
    pg_temp.refused(teen, format($q$insert into public.reports (reporter, about, reason) values (%L, %L, 'unkind')$q$, teen, adult))::text, 'false');
  perform pg_temp.answered('and may still share with a guardian',
    pg_temp.refused(teen, format($q$insert into public.family_grants (institution_id, student_id, recipient_id, category, access, expires_at)
      values ('vanderbilt', %L, %L, 'academic', 'selected', now() + interval '30 days')$q$, teen, parent))::text, 'false');

  -- ── The ways in that do not ask verified_student ────────────────────────
  -- Inserted as the table owner, so only the trigger stands in the way.
  begin
    insert into public.connections (requester, addressee) values (teen, adult);
    raise exception 'FAILED: a minor sent a connection';
  exception when insufficient_privilege then raise notice 'ok  a minor cannot send a connection';
  end;
  begin
    insert into public.connections (requester, addressee) values (adult, teen);
    raise exception 'FAILED: a minor received a connection';
  exception when insufficient_privilege then raise notice 'ok  nor receive one';
  end;
  insert into public.connections (requester, addressee) values (adult, parent);
  raise notice 'ok  two adults still connect';

  begin
    insert into public.talent_profiles (user_id, opted_in) values (teen, true);
    raise exception 'FAILED: a minor opted into employer visibility';
  exception when insufficient_privilege then raise notice 'ok  a minor cannot opt into employer visibility';
  end;
  insert into public.talent_profiles (user_id, opted_in) values (teen, false);
  raise notice 'ok  but may keep a private profile';
  begin
    update public.talent_profiles set opted_in = true where user_id = teen;
    raise exception 'FAILED: a minor turned employer visibility on';
  exception when insufficient_privilege then raise notice 'ok  nor turn it on later';
  end;

  insert into public.schools (id, name, email_domains) values ('age-u', 'Age University', array['age.example'])
  on conflict (id) do nothing;
  begin
    insert into public.study_match_optins (user_id, tenant_id, course_code) values (teen, 'age-u', 'MATH 101');
    raise exception 'FAILED: a minor opted into study matching';
  exception when insufficient_privilege then raise notice 'ok  a minor cannot opt into study matching';
  end;
  begin
    insert into public.mentor_requests (kind, tenant_id, requester, recipient) values ('alumni', 'age-u', teen, adult);
    raise exception 'FAILED: a minor asked for a mentor';
  exception
    when insufficient_privilege then raise notice 'ok  a minor cannot ask for a mentor';
    when not_null_violation or check_violation then
      raise exception 'FAILED: the mentor request fixture is incomplete (%), so the trigger was not what refused it', sqlerrm;
  end;

  begin
    insert into public.mentor_requests (kind, tenant_id, requester, recipient, requester_name) values ('alumni', 'age-u', adult, teen, 'Adult');
    raise exception 'FAILED: a minor was sent a mentor request';
  exception
    when insufficient_privilege then raise notice 'ok  nor be sent one';
    when not_null_violation or check_violation then
      raise exception 'FAILED: the mentor request fixture is incomplete (%), so the trigger was not what refused it', sqlerrm;
  end;
  begin
    insert into public.peer_mentor_offers (user_id, tenant_id, cohort_scope, display_name) values (teen, 'age-u', 'age-u/cohort-a', 'Teen');
    raise exception 'FAILED: a minor was listed as a peer mentor';
  exception when insufficient_privilege then raise notice 'ok  a minor cannot be listed as a peer mentor';
  end;
  begin
    insert into public.alumni_mentor_offers (user_id, tenant_id) values (teen, 'age-u');
    raise exception 'FAILED: a minor was listed as an alumni mentor';
  exception when insufficient_privilege then raise notice 'ok  nor as an alumni mentor';
  end;
  insert into public.peer_mentor_offers (user_id, tenant_id, cohort_scope, display_name, active) values (teen, 'age-u', 'age-u/cohort-a', 'Teen', false);
  raise notice 'ok  an inactive offer is nobody''s roster, so it may be kept';
  begin
    update public.peer_mentor_offers set active = true where user_id = teen;
    raise exception 'FAILED: a minor turned a peer mentor offer on';
  exception when insufficient_privilege then raise notice 'ok  but not turned on';
  end;
  insert into public.peer_mentor_offers (user_id, tenant_id, cohort_scope, display_name) values (adult, 'age-u', 'age-u/cohort-a', 'Adult');
  raise notice 'ok  an adult is still listed';

  -- ── Turning 18 ──────────────────────────────────────────────────────────
  update private.account_ages set minor_until = current_date where user_id = teen;
  perform pg_temp.become(teen);
  perform pg_temp.answered('on the day they turn 18 the rules lift', private.verified_student()::text, 'true');
  perform pg_temp.answered('and their standing reads adult', public.my_age_status(), 'adult');
  reset role;
  update private.account_ages set minor_until = current_date + 1 where user_id = teen;

  -- ── Stated once, for an account that never said ─────────────────────────
  unsaid := pg_temp.account('unsaid@age.example', null);
  -- Out in the world before anybody asked its age: listed as a mentor, open to
  -- employers, a classmate profile in a shared class, a study-match opt-in
  -- beside an adult's, and a connection and a mentor request not yet answered.
  -- Rows like these exist from before the age was asked; the triggers would
  -- refuse them today, so they are seeded with triggers off.
  set local session_replication_role = replica;
  insert into public.peer_mentor_offers (user_id, tenant_id, cohort_scope, display_name) values (unsaid, 'age-u', 'age-u/cohort-a', 'Unsaid');
  insert into public.alumni_mentor_offers (user_id, tenant_id) values (unsaid, 'age-u');
  insert into public.talent_profiles (user_id, opted_in) values (unsaid, true);
  insert into public.profiles (user_id, handle) values (unsaid, 'unsaid');
  insert into public.enrollments (user_id, term, code) values (unsaid, '2026FA', 'vanderbilt/MATH 1100'), (adult, '2026FA', 'vanderbilt/MATH 1100');
  insert into public.study_match_optins (user_id, tenant_id, course_code) values (unsaid, 'age-u', 'MATH 101'), (adult, 'age-u', 'MATH 101');
  insert into public.connections (requester, addressee) values (adult, unsaid);
  insert into public.mentor_requests (kind, tenant_id, requester, recipient, requester_name) values ('alumni', 'age-u', adult, unsaid, 'Adult');
  set local session_replication_role = origin;
  perform pg_temp.become(adult);
  select count(*) into n from public.profiles where user_id = unsaid;
  perform pg_temp.answered('a classmate does not see the profile of an account that never said', n::text, '0');
  reset role;

  -- The same account saying it is an adult is let back in.
  grown := pg_temp.account('grown@age.example', null);
  insert into public.profiles (user_id, handle) values (grown, 'grown');
  insert into public.enrollments (user_id, term, code) values (grown, '2026FA', 'vanderbilt/MATH 1100');
  perform pg_temp.become(grown);
  perform pg_temp.answered('an account that never said may say it is an adult', public.state_my_age((current_date - interval '25 years')::date), 'adult');
  perform pg_temp.answered('and is a verified student from then on', private.verified_student()::text, 'true');
  reset role;
  perform pg_temp.become(adult);
  select count(*) into n from public.profiles where user_id = grown;
  perform pg_temp.answered('and its classmates see its profile again', n::text, '1');
  reset role;

  perform pg_temp.become(unsaid);
  perform pg_temp.answered('an account that never said may state an age', public.state_my_age((current_date - interval '16 years')::date), 'minor');
  perform pg_temp.answered('and becomes a minor', private.verified_student()::text, 'false');
  reset role;
  select count(*) into n from public.peer_mentor_offers where user_id = unsaid and active;
  perform pg_temp.answered('saying so takes them off the peer mentor roster', n::text, '0');
  select count(*) into n from public.alumni_mentor_offers where user_id = unsaid and active;
  perform pg_temp.answered('and the alumni one', n::text, '0');
  select count(*) into n from public.talent_profiles where user_id = unsaid and opted_in;
  perform pg_temp.answered('and out of employer view', n::text, '0');
  select count(*) into n from public.study_match_optins where user_id = unsaid;
  perform pg_temp.answered('and out of study matching', n::text, '0');
  select count(*) into n from public.connections where (requester = unsaid or addressee = unsaid) and state = 'pending';
  perform pg_temp.answered('and the connection nobody answered is gone', n::text, '0');
  select status into o from public.mentor_requests where recipient = unsaid;
  perform pg_temp.answered('and the mentor request is declined', o, 'declined');
  perform pg_temp.become(adult);
  select count(*) into n from public.profiles where user_id = unsaid;
  perform pg_temp.answered('a classmate no longer sees the profile', n::text, '0');
  reset role;
  select count(*) into n from public.profiles where user_id = unsaid;
  perform pg_temp.answered('which is hidden, not deleted', n::text, '1');

  -- A request sent before an age was known cannot be accepted after one is,
  -- whichever way the account came to be a minor.
  flip := pg_temp.account('flip@age.example', null);
  set local session_replication_role = replica;
  insert into public.connections (requester, addressee) values (adult, flip);
  insert into public.mentor_requests (kind, tenant_id, requester, recipient, requester_name) values ('alumni', 'age-u', adult, flip, 'Adult');
  set local session_replication_role = origin;
  insert into public.student_context (user_id, is_minor) values (flip, true);
  begin
    update public.connections set state = 'accepted', responded_at = now() where requester = adult and addressee = flip;
    raise exception 'FAILED: a connection to a minor was accepted';
  exception when insufficient_privilege then raise notice 'ok  a connection sent before is not accepted after';
  end;
  begin
    update public.mentor_requests set status = 'accepted', decided_at = now() where requester = adult and recipient = flip;
    raise exception 'FAILED: a mentor request to a minor was accepted';
  exception when insufficient_privilege then raise notice 'ok  nor a mentor request';
  end;
  update public.mentor_requests set status = 'declined', decided_at = now() where requester = adult and recipient = flip;
  raise notice 'ok  but either may still be declined';
  perform pg_temp.become(unsaid);
  perform pg_temp.answered('but may not state it again', public.state_my_age((current_date - interval '30 years')::date), 'already_stated');
  perform pg_temp.answered('so it stays a minor', public.my_age_status(), 'minor');
  reset role;

  child_later := pg_temp.account('later@age.example', null);
  perform pg_temp.become(child_later);
  perform pg_temp.answered('under 13 stated later is recorded', public.state_my_age((current_date - interval '11 years')::date), 'under_minimum_age');
  perform pg_temp.answered('and shuts the social features', private.verified_student()::text, 'false');
  perform pg_temp.answered('and reads under the minimum', public.my_age_status(), 'under_minimum');
  reset role;

  -- ── The self-declared flag only makes it stricter ───────────────────────
  self_said := pg_temp.account('selfsaid@age.example', (current_date - interval '25 years')::date);
  insert into public.student_context (user_id, is_minor) values (self_said, true);
  perform pg_temp.become(self_said);
  perform pg_temp.answered('a self-declared minor is treated as one', private.verified_student()::text, 'false');
  reset role;
  insert into public.student_context (user_id, is_minor) values (teen, false)
  on conflict (user_id) do update set is_minor = false;
  perform pg_temp.become(teen);
  perform pg_temp.answered('and saying adult there changes nothing', private.verified_student()::text, 'false');
  reset role;

  -- ── Nobody reads the table; a visitor cannot state an age ───────────────
  perform pg_temp.answered('a signed-in account cannot read the ages',
    pg_temp.refused(adult, 'select count(*) from private.account_ages')::text, 'true');
  perform pg_temp.become_anon();
  begin
    perform public.state_my_age('2000-01-01');
    raise exception 'FAILED: a visitor stated an age';
  exception when insufficient_privilege then raise notice 'ok  a visitor cannot state an age';
  end;
  reset role;
end $$;

rollback;
