-- Course rooms limited to one university at a time (full-beta G-03).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- What must hold:
--   * DEFAULT OFF: with no school enforced, a room behaves exactly as before,
--     across schools (the control: nothing moved for anyone).
--   * a school is switched on only by the platform operator, only once the
--     number of people it would lock out has been stated, and never for a
--     school that publishes no address
--   * once enforced, an account that is not a member of that school cannot join
--     its rooms, read them, post to them, be listed as a classmate, or hear the
--     live channel — and a member of ANOTHER enforced school is no better off
--   * enforcing one school changes nothing about another
--   * membership is proved by the confirmed address (claim) or by a person at
--     the school approving a request; a request alone grants nothing
--   * a school administrator decides only their own school's requests, cannot
--     approve their own, and cannot flip enforcement
--   * misclaims recover: a person can leave, an administrator can remove them,
--     a person can withdraw a waiting request
--   * every one of those acts leaves an audit event without a name in it

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, split_part(address, '@', 1), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then raise exception 'FAILED: % — expected %, got %', what, want, got; end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.refused(statement text)
returns boolean language plpgsql as $$
begin
  execute statement;
  return false;
exception when others then
  return true;
end $$;

do $$
declare
  n_member uuid; n_unclaimed uuid; s_member uuid; g_gmail uuid;
  n_admin uuid; s_admin uuid; operator uuid;
  n bigint; req uuid; ready jsonb; msg uuid;
begin
  insert into public.schools (id, name, email_domains) values
    ('north-mem', 'North Membership University', array['north-mem.example']),
    ('south-mem', 'South Membership College', array['south-mem.example']),
    ('bare-mem',  'Bare Membership Institute', '{}');

  -- Two claimed members, one unclaimed same-domain account, one outsider.
  n_member    := pg_temp.newuser('nm@north-mem.example', 'north-mem');
  n_unclaimed := pg_temp.newuser('nu@north-mem.example', null);
  s_member    := pg_temp.newuser('sm@south-mem.example', 'south-mem');
  g_gmail     := pg_temp.newuser('gm@gmail.example', null);
  n_admin     := pg_temp.newuser('na@north-mem.example', 'north-mem');
  s_admin     := pg_temp.newuser('sa@south-mem.example', 'south-mem');
  operator    := pg_temp.newuser('op@ops.example', null);
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (n_admin, 'university_admin', 'school', 'north-mem', 'institution'),
    (s_admin, 'university_admin', 'school', 'south-mem', 'institution');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (operator, 'platform_admin', 'platform', '', 'platform');

  -- ── DEFAULT OFF: the control ─────────────────────────────────────────────
  -- Everyone joins north's room, whatever school they are at, as they always could.
  perform pg_temp.become(n_member);
  insert into public.enrollments (user_id, term, code) values (n_member, '2026FA', 'north-mem/ECON 1020');
  insert into public.messages (user_id, term, code, body) values (n_member, '2026FA', 'north-mem/ECON 1020', 'hello from north');
  reset role;
  foreach msg in array array[s_member, g_gmail, n_unclaimed] loop
    perform pg_temp.become(msg);
    insert into public.enrollments (user_id, term, code) values (msg, '2026FA', 'north-mem/ECON 1020');
    reset role;
  end loop;
  perform pg_temp.become(s_member);
  insert into public.messages (user_id, term, code, body) values (s_member, '2026FA', 'north-mem/ECON 1020', 'hello from south, before the switch');
  select count(*) into n from public.messages where code = 'north-mem/ECON 1020';
  reset role;
  perform pg_temp.counted('CONTROL: with nothing enforced, another school''s student reads the room as before', n, 2);
  perform pg_temp.become(s_member);
  select count(*) into n from public.enrollments where code = 'north-mem/ECON 1020';
  reset role;
  perform pg_temp.counted('CONTROL: and sees everyone enrolled', n, 4);

  -- ── Who can switch it, and on what terms ─────────────────────────────────
  perform pg_temp.become(n_admin);
  if not pg_temp.refused($q$select public.set_school_enforcement('north-mem', true, 0)$q$) then
    raise exception 'FAILED: a school administrator switched enforcement on';
  end if;
  ready := public.school_enforcement_readiness('north-mem');
  reset role;
  perform pg_temp.counted('a school administrator reads their school''s readiness: 3 outsiders enrolled would be locked out', (ready->>'locked_out')::bigint, 3);
  perform pg_temp.become(n_admin);
  if not pg_temp.refused($q$select public.school_enforcement_readiness('south-mem')$q$) then
    raise exception 'FAILED: an administrator read another school''s readiness';
  end if;
  reset role;
  perform pg_temp.become(n_member);
  if not pg_temp.refused($q$select public.school_enforcement_readiness('north-mem')$q$) then
    raise exception 'FAILED: a student read readiness';
  end if;
  -- Refused by privilege, or filtered to no rows by policy: either way the
  -- value must not have moved.
  begin
    update public.schools set enforce_membership = true where id = 'north-mem';
  exception when others then null;
  end;
  reset role;
  select count(*) into n from public.schools where enforce_membership;
  perform pg_temp.counted('a student writing the switch directly moves nothing', n, 0);
  raise notice 'ok  only the operator switches it; readiness is a school administrator''s to read, and nobody else''s';

  -- Even the platform operator cannot skip the count by writing the column.
  set local role postgres;
  if not pg_temp.refused($q$update public.schools set enforce_membership = true where id = 'north-mem'$q$) then
    raise exception 'FAILED: the switch was written directly, skipping the readiness count';
  end if;
  reset role;
  perform pg_temp.become(operator);
  if not pg_temp.refused($q$select public.set_school_enforcement('north-mem', true)$q$) then
    raise exception 'FAILED: switched on without stating the number locked out';
  end if;
  if not pg_temp.refused($q$select public.set_school_enforcement('north-mem', true, 2)$q$) then
    raise exception 'FAILED: switched on with the wrong number';
  end if;
  if not pg_temp.refused($q$select public.set_school_enforcement('bare-mem', true, 0)$q$) then
    raise exception 'FAILED: switched on for a school that publishes no address';
  end if;
  reset role;
  raise notice 'ok  switching on needs the exact locked-out count and a school that publishes an address';

  -- The cross-school rooms are still open: nothing has been switched on yet.
  select count(*) into n from public.schools where enforce_membership;
  perform pg_temp.counted('nothing is enforced after the refusals', n, 0);

  -- ── Switch north on ──────────────────────────────────────────────────────
  perform pg_temp.become(operator);
  perform public.set_school_enforcement('north-mem', true, 3);
  reset role;
  select count(*) into n from public.schools where enforce_membership and id = 'north-mem';
  perform pg_temp.counted('the operator switches north on with the count acknowledged', n, 1);
  select count(*) into n from public.schools where enforce_membership and id <> 'north-mem';
  perform pg_temp.counted('and no other school changes', n, 0);

  -- Negative cross-school: every route into north's room, for outsiders.
  perform pg_temp.become(s_member);
  select count(*) into n from public.messages where code = 'north-mem/ECON 1020';
  perform pg_temp.counted('an enforced room: a member of ANOTHER school reads nothing', n, 0);
  select count(*) into n from public.enrollments where code = 'north-mem/ECON 1020' and user_id <> s_member;
  perform pg_temp.counted('and sees nobody enrolled in it', n, 0);
  if not pg_temp.refused($q$insert into public.messages (user_id, term, code, body) values (auth.uid(), '2026FA', 'north-mem/ECON 1020', 'let me in')$q$) then
    raise exception 'FAILED: another school''s student posted to an enforced room';
  end if;
  if not pg_temp.refused($q$insert into public.enrollments (user_id, term, code) values (auth.uid(), '2026FA', 'north-mem/BUS 1600')$q$) then
    raise exception 'FAILED: another school''s student joined an enforced room';
  end if;
  select count(*) into n from public.profiles where user_id = n_member;
  perform pg_temp.counted('and cannot see a member of it as a classmate', n, 0);
  reset role;

  foreach msg in array array[n_unclaimed, g_gmail] loop
    perform pg_temp.become(msg);
    select count(*) into n from public.messages where code = 'north-mem/ECON 1020';
    perform pg_temp.counted('an account that has proved no school reads nothing in the enforced room', n, 0);
    if not pg_temp.refused(format($q$insert into public.messages (user_id, term, code, body) values (%L, '2026FA', 'north-mem/ECON 1020', 'x')$q$, msg)) then
      raise exception 'FAILED: an unproved account posted to an enforced room';
    end if;
    reset role;
  end loop;

  -- The live channel asks the same question.
  perform pg_temp.become(s_member);
  perform set_config('realtime.topic', 'here:2026FA:north-mem/ECON 1020', true);
  select count(*) into n from (select private.in_class('2026FA', 'north-mem/ECON 1020') as ok) t where ok;
  reset role;
  perform pg_temp.counted('the presence channel''s membership test says no to an outsider', n, 0);

  -- Members are unaffected, and no longer see outsiders' words or profiles.
  perform pg_temp.become(n_member);
  select count(*) into n from public.messages where code = 'north-mem/ECON 1020';
  perform pg_temp.counted('a member still reads their own school''s room, and not the outsider''s earlier words', n, 1);
  insert into public.messages (user_id, term, code, body) values (n_member, '2026FA', 'north-mem/ECON 1020', 'members only now');
  select count(*) into n from public.enrollments where code = 'north-mem/ECON 1020' and user_id <> n_member;
  perform pg_temp.counted('and no longer lists the outsiders who were enrolled', n, 0);
  reset role;

  -- Another school's rooms are untouched by north's switch.
  perform pg_temp.become(n_member);
  insert into public.enrollments (user_id, term, code) values (n_member, '2026FA', 'south-mem/BUS 1600');
  select count(*) into n from public.enrollments where code = 'south-mem/BUS 1600';
  reset role;
  perform pg_temp.counted('a room of a school that is NOT enforced still takes anyone', n, 1);
  raise notice 'ok  rooms of other schools are unchanged';

  -- ── Getting in: a request grants nothing until a person at the school says so
  perform pg_temp.become(g_gmail);
  req := public.request_school_membership('north-mem', 'I am a visiting student');
  select count(*) into n from public.messages where code = 'north-mem/ECON 1020';
  reset role;
  perform pg_temp.counted('a waiting request lets nobody in', n, 0);
  perform pg_temp.become(g_gmail);
  if not pg_temp.refused($q$select public.request_school_membership('north-mem', 'again')$q$) then
    raise exception 'FAILED: a second identical request was accepted';
  end if;
  if not pg_temp.refused($q$update public.school_membership_requests set status = 'approved'$q$) then
    raise exception 'FAILED: a person approved their own request';
  end if;
  reset role;
  perform pg_temp.become(g_gmail);
  if not pg_temp.refused(format($q$select public.decide_school_request(%L, true)$q$, req)) then
    raise exception 'FAILED: the requester decided their own request';
  end if;
  reset role;
  perform pg_temp.become(g_gmail);
  if not pg_temp.refused($q$select * from public.school_requests_for_admin('north-mem')$q$) then
    raise exception 'FAILED: a student listed the waiting requests';
  end if;
  reset role;
  perform pg_temp.become(s_admin);
  if not pg_temp.refused(format($q$select public.decide_school_request(%L, true)$q$, req)) then
    raise exception 'FAILED: another school''s administrator decided north''s request';
  end if;
  select count(*) into n from public.school_membership_requests;
  reset role;
  perform pg_temp.counted('and cannot even see it', n, 0);

  perform pg_temp.become(n_admin);
  select count(*) into n from public.school_membership_requests where school_id = 'north-mem';
  perform pg_temp.counted('north''s administrator sees north''s waiting request', n, 1);
  select count(*) into n from public.school_requests_for_admin('north-mem') where handle = 'gm' and note = 'I am a visiting student';
  perform pg_temp.counted('with the handle and the sentence, so they can decide', n, 1);
  if not pg_temp.refused($q$select * from public.school_requests_for_admin('south-mem')$q$) then
    raise exception 'FAILED: an administrator listed another school''s requests';
  end if;
  perform public.decide_school_request(req, true, 'confirmed with the registrar');
  reset role;
  perform pg_temp.become(g_gmail);
  select count(*) into n from public.messages where code = 'north-mem/ECON 1020';
  reset role;
  perform pg_temp.counted('approved: the visiting student is in, and reads the members'' words', n, 2);

  -- An address the school publishes cannot use the request route; it claims.
  perform pg_temp.become(n_unclaimed);
  if not pg_temp.refused($q$select public.request_school_membership('north-mem')$q$) then
    raise exception 'FAILED: a published address used the request route';
  end if;
  if not pg_temp.refused($q$select public.claim_school('south-mem')$q$) then
    raise exception 'FAILED: claimed a school whose address the account does not have';
  end if;
  perform public.claim_school('north-mem');
  select count(*) into n from public.messages where code = 'north-mem/ECON 1020';
  reset role;
  perform pg_temp.counted('a verified address claims and is in at once', n, 2);
  perform pg_temp.become(n_unclaimed);
  if not pg_temp.refused($q$update public.profiles set school_id = 'south-mem' where user_id = auth.uid()$q$) then
    raise exception 'FAILED: school_id written directly';
  end if;
  reset role;

  -- ── Recovery ─────────────────────────────────────────────────────────────
  perform pg_temp.become(s_admin);
  reset role;
  perform pg_temp.become(operator);
  if not pg_temp.refused($q$select public.leave_school()$q$) then
    raise exception 'FAILED: leaving a university you are not at was answered as done';
  end if;
  reset role;
  perform pg_temp.become(g_gmail);
  perform public.leave_school();
  select count(*) into n from public.messages where code = 'north-mem/ECON 1020';
  reset role;
  perform pg_temp.counted('a person who leaves is out of the enforced room again', n, 0);

  perform pg_temp.become(s_admin);
  if not pg_temp.refused(format($q$select public.revoke_school_membership(%L)$q$, n_unclaimed)) then
    raise exception 'FAILED: another school''s administrator removed a north member';
  end if;
  reset role;
  perform pg_temp.become(n_admin);
  perform public.revoke_school_membership(n_unclaimed, 'shared address');
  reset role;
  perform pg_temp.become(n_unclaimed);
  select count(*) into n from public.messages where code = 'north-mem/ECON 1020';
  reset role;
  perform pg_temp.counted('an administrator removes a misclaimed member from their own school', n, 0);

  perform pg_temp.become(g_gmail);
  req := public.request_school_membership('north-mem', 'again');
  perform public.withdraw_school_request(req);
  if not pg_temp.refused(format($q$select public.withdraw_school_request(%L)$q$, req)) then
    raise exception 'FAILED: a withdrawn request was withdrawn twice';
  end if;
  reset role;
  raise notice 'ok  leave, remove and withdraw all recover a wrong membership';

  -- ── Switching back off restores the old behaviour ────────────────────────
  perform pg_temp.become(operator);
  perform public.set_school_enforcement('north-mem', false);
  reset role;
  perform pg_temp.become(s_member);
  select count(*) into n from public.messages where code = 'north-mem/ECON 1020';
  reset role;
  perform pg_temp.counted('switched off, the room is open as it was, outsiders'' earlier words back', n, 3);

  -- ── The record: who did what, and nothing that names anybody ─────────────
  set local role service_role;
  select count(*) into n from public.audit_event where action like 'school.%' and tenant_id = 'north-mem';
  reset role;
  if n < 8 then raise exception 'FAILED: expected the membership acts on the record, got %', n; end if;
  raise notice 'ok  the acts are on the audit record (%)', n;
  select count(*) into n from public.audit_event
   where action like 'school.%' and (detail::text ~* '@' or detail::text ~* 'gmail|north-mem\.example');
  perform pg_temp.counted('and no event carries an address', n, 0);
  select count(*) into n from public.audit_event where action = 'school.enforcement_on' and (detail->>'locked_out')::int = 3;
  perform pg_temp.counted('switching on recorded how many people it locked out', n, 1);
end $$;

rollback;
