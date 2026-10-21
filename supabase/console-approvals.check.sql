-- The operations console's writes: approvals, the fail-closed action,
-- break-glass, and the commercial core (20260929110000).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- The one check here that matters more than the rest is the fail-closed one.
-- `console_act` is the console's high-risk write, and the register's row 6
-- says it fails closed when the mandatory audit event cannot be written. That
-- is only true if it has been watched failing: so this suite takes the
-- writer role's INSERT away inside a savepoint, has an approved request acted
-- on, and asserts that the call raised *and* that nothing changed — no role
-- grant, no action record, the request still `approved`, the chain no
-- longer. Then it puts the privilege back and watches the same call succeed,
-- and checks the order: the audit row's seq sits below the one the effect
-- wrote.
--
-- The rest walks the register's rows 7, 8 and 11: self-approval refused, an
-- approver who holds no approver party refused, a two-person duty still
-- pending after one approval and approved after a second distinct approver,
-- a decision without fresh MFA refused, break-glass expiry held to four
-- hours by the table as well as the function, an unreviewed overdue
-- break-glass grant blocking the holder's next one, demo-tenant rows absent
-- from every default read, and customers scoped to their tenant.
--
--   How to run it: supabase/check.sh console-approvals

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
end $$;

-- The same session with a second factor completed just now: what
-- `private.assert_fresh_mfa()` reads off the JWT.
create or replace function pg_temp.become_mfa(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated', 'aal', 'aal2',
      'amr', json_build_array(json_build_object('method', 'totp',
               'timestamp', floor(extract(epoch from now()))::bigint)))::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.nobody()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
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
  values (who, split_part(address, '@', 1), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

-- Runs one statement as `who`, with or without fresh MFA, and returns the
-- error message it drew — or null when it went through. A refusal is
-- asserted on its message, not on the fact of an exception, because "it
-- raised" is also what a typo in the statement looks like.
create or replace function pg_temp.attempt(who uuid, mfa boolean, statement text)
returns text language plpgsql as $$
begin
  if mfa then perform pg_temp.become_mfa(who); else perform pg_temp.become(who); end if;
  execute statement;
  perform pg_temp.nobody();
  return null;
exception when others then
  perform pg_temp.nobody();
  return sqlerrm;
end $$;

create or replace function pg_temp.refused_with(what text, got text, expected text)
returns void language plpgsql as $$
begin
  if got is null then
    raise exception 'FAILED: % — it went through', what;
  end if;
  if got not ilike '%' || expected || '%' then
    raise exception 'FAILED: % — refused, but for another reason: %', what, got;
  end if;
  raise notice 'ok  % ("%")', what, got;
end $$;

create or replace function pg_temp.went_through(what text, got text)
returns void language plpgsql as $$
begin
  if got is not null then
    raise exception 'FAILED: % — refused: %', what, got;
  end if;
  raise notice 'ok  %', what;
end $$;

create temp table ids (k text primary key, v text not null);
create or replace function pg_temp.remember(k text, v text) returns void language sql as
  $$ insert into ids values (k, v) on conflict (k) do update set v = excluded.v $$;
create or replace function pg_temp.who(k text) returns uuid language sql stable as
  $$ select v::uuid from ids where ids.k = who.k $$;
create or replace function pg_temp.what(k text) returns text language sql stable as
  $$ select v from ids where ids.k = what.k $$;

-- ── The people, the seats, the tenants ────────────────────────────────────

do $$
declare
  operator uuid; uadmin uuid; otheradmin uuid; sec uuid; fnd uuid; eng uuid;
  stranger uuid; newperson uuid;
begin
  insert into public.schools (id, name, email_domains, is_demo) values
    ('console-b-check', 'Console Check University', array['console-b-check.example'], false),
    ('console-b-other', 'Other Console University', array['console-b-other.example'], false),
    ('console-b-demo',  'Demo Console University',  array['console-b-demo.example'],  true);

  operator   := pg_temp.newuser('operator@console-b-check.example', 'console-b-check');
  uadmin     := pg_temp.newuser('uadmin@console-b-check.example', 'console-b-check');
  otheradmin := pg_temp.newuser('uadmin@console-b-other.example', 'console-b-other');
  sec        := pg_temp.newuser('security@console-b-check.example', 'console-b-check');
  fnd        := pg_temp.newuser('founder@console-b-check.example', 'console-b-check');
  eng        := pg_temp.newuser('engineering@console-b-check.example', 'console-b-check');
  stranger   := pg_temp.newuser('stranger@console-b-check.example', 'console-b-check');
  newperson  := pg_temp.newuser('newperson@console-b-check.example', 'console-b-check');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    -- Operators: `console:operate`, `breakglass:request`, and the requester
    -- party of `tenant-suspension` (`role:platform_admin`).
    (operator,   'platform_admin',   'platform', '',                'platform'),
    (sec,        'platform_admin',   'platform', '',                'platform'),
    (eng,        'platform_admin',   'platform', '',                'platform'),
    -- Requester party of `role-grant` (`role:university_admin`), and
    -- `tenant:configure` over one school each.
    (uadmin,     'university_admin', 'school',   'console-b-check', 'institution'),
    (otheradmin, 'university_admin', 'school',   'console-b-other', 'institution'),
    -- So that the security seat can also *request* a role grant, for the
    -- self-approval check.
    (sec,        'university_admin', 'school',   'console-b-check', 'institution');

  insert into public.council_seat_holder (seat, subject) values
    ('security', sec), ('founder', fnd), ('engineering', eng);

  insert into public.tenant_plan (tenant_id, tier, status) values ('console-b-check', 'campus', 'active');

  perform pg_temp.remember('operator', operator::text);
  perform pg_temp.remember('uadmin', uadmin::text);
  perform pg_temp.remember('otheradmin', otheradmin::text);
  perform pg_temp.remember('sec', sec::text);
  perform pg_temp.remember('fnd', fnd::text);
  perform pg_temp.remember('eng', eng::text);
  perform pg_temp.remember('stranger', stranger::text);
  perform pg_temp.remember('newperson', newperson::text);
  raise notice 'ok  three tenants (one demo), eight accounts, three seats, one plan';
end $$;

-- ── Requesting ────────────────────────────────────────────────────────────

do $$
declare
  uadmin uuid := pg_temp.who('uadmin'); stranger uuid := pg_temp.who('stranger');
  sec uuid := pg_temp.who('sec'); newperson uuid := pg_temp.who('newperson');
  req uuid; n bigint;
  detail text := format('{"subject": "%s", "role": "university_staff", "scope_kind": "school", "scope_id": "console-b-check"}', newperson);
begin
  perform pg_temp.refused_with('an account holding no requester party cannot request a role grant',
    pg_temp.attempt(stranger, false, format(
      'select public.request_approval(%L, %L, %L, %L::jsonb, %L, %L)',
      'role-grant', 'console-b-check', 'newperson → university_staff', detail,
      'Access request AR-1', 'ACC-1001')),
    'do not hold the party');

  perform pg_temp.refused_with('a request with no evidence is refused',
    pg_temp.attempt(uadmin, false, format(
      'select public.request_approval(%L, %L, %L, %L::jsonb, %L, %L)',
      'role-grant', 'console-b-check', 'newperson → university_staff', detail, '   ', 'ACC-1001')),
    'Evidence is required');

  perform pg_temp.become(uadmin);
  req := public.request_approval('role-grant', 'console-b-check', 'newperson → university_staff',
                                 detail::jsonb, 'Access request AR-1, naming the person, the role, the tenant and the reason',
                                 'ACC-1001', 'corr-role-grant-0001');
  perform pg_temp.nobody();
  perform pg_temp.remember('req1', req::text);

  select count(*) into n from public.approval_request where id = req and status = 'pending' and requester = uadmin;
  perform pg_temp.counted('the university admin''s role-grant request is pending', n, 1);
  select count(*) into n from private.console_audit_event
   where action = 'approval.requested' and target = req::text and actor = uadmin
     and correlation_id = 'corr-role-grant-0001';
  perform pg_temp.counted('and its audit event was written, with the correlation id', n, 1);

  perform pg_temp.refused_with('nobody inserts a request directly',
    pg_temp.attempt(uadmin, false, format(
      'insert into public.approval_request (duty_id, requester, evidence, ticket) values (%L, %L, %L, %L)',
      'role-grant', uadmin, 'Direct', 'ACC-1002')),
    'permission denied');

  -- A second request, by the security seat holder wearing their
  -- university-admin hat, for the self-approval check below.
  perform pg_temp.become(sec);
  req := public.request_approval('role-grant', 'console-b-check', 'newperson → university_staff',
                                 detail::jsonb, 'Access request AR-2', 'ACC-1002');
  perform pg_temp.nobody();
  perform pg_temp.remember('req_self', req::text);
  raise notice 'ok  the security seat, also a university admin, requested a role grant of their own';
end $$;

-- ── Deciding ──────────────────────────────────────────────────────────────

do $$
declare
  uadmin uuid := pg_temp.who('uadmin'); stranger uuid := pg_temp.who('stranger');
  sec uuid := pg_temp.who('sec'); operator uuid := pg_temp.who('operator');
  req1 uuid := pg_temp.who('req1'); req_self uuid := pg_temp.who('req_self');
  n bigint; became text;
begin
  perform pg_temp.refused_with('self-approval is refused on the server',
    pg_temp.attempt(sec, true, format('select public.decide_approval(%L, %L)', req_self, 'approve')),
    'Self-approval is refused');

  perform pg_temp.refused_with('an approver who holds none of the duty''s approver parties is refused',
    pg_temp.attempt(stranger, true, format('select public.decide_approval(%L, %L)', req1, 'approve')),
    'hold none of the parties');

  perform pg_temp.refused_with('a platform admin without the security seat cannot approve a role grant',
    pg_temp.attempt(operator, true, format('select public.decide_approval(%L, %L)', req1, 'approve')),
    'hold none of the parties');

  perform pg_temp.refused_with('the security seat cannot approve without fresh MFA',
    pg_temp.attempt(sec, false, format('select public.decide_approval(%L, %L)', req1, 'approve')),
    'Fresh MFA required');

  select count(*) into n from public.approval_decision where request_id = req1;
  perform pg_temp.counted('none of those refusals left a decision behind', n, 0);
  select count(*) into n from private.console_audit_event where action = 'approval.decided';
  perform pg_temp.counted('nor an audit event', n, 0);

  perform pg_temp.become_mfa(sec);
  became := public.decide_approval(req1, 'approve');
  perform pg_temp.nobody();
  if became <> 'approved' then
    raise exception 'FAILED: a one-person duty after one approval is %', became;
  end if;
  raise notice 'ok  the security seat approved the role grant with fresh MFA, and the request is approved';

  select count(*) into n from public.approval_decision
   where request_id = req1 and approver = sec and decision = 'approve' and as_party = 'security';
  perform pg_temp.counted('the decision records the party it was made as', n, 1);
  select count(*) into n from private.console_audit_event
   where action = 'approval.decided' and target = req1::text and actor = sec
     and detail ->> 'as_party' = 'security';
  perform pg_temp.counted('and the decision was audited', n, 1);

  perform pg_temp.refused_with('the same approver cannot decide the same request twice',
    pg_temp.attempt(sec, true, format('select public.decide_approval(%L, %L)', req1, 'approve')),
    'already approved');
end $$;

-- ── Who may act ───────────────────────────────────────────────────────────

do $$
declare
  uadmin uuid := pg_temp.who('uadmin'); operator uuid := pg_temp.who('operator');
  sec uuid := pg_temp.who('sec'); req1 uuid := pg_temp.who('req1');
begin
  perform pg_temp.refused_with('an operator who is neither requester nor approver cannot act',
    pg_temp.attempt(operator, true, format('select public.console_act(%L)', req1)),
    'Only the requester or an approver');
  perform pg_temp.refused_with('the requester cannot act without console:operate',
    pg_temp.attempt(uadmin, true, format('select public.console_act(%L)', req1)),
    'not open to you');
  perform pg_temp.refused_with('the approver cannot act without fresh MFA',
    pg_temp.attempt(sec, false, format('select public.console_act(%L)', req1)),
    'Fresh MFA required');
end $$;

-- ── Fail closed ───────────────────────────────────────────────────────────
--
-- The writer role's INSERT is revoked inside a sub-block, the approver acts,
-- and the call must raise from the audit write with nothing else done. The
-- sub-block ends in a deliberate raise so the revoke is rolled back; the
-- privilege is then read back to prove the restoration, and the same call
-- goes through.

do $$
declare
  sec uuid := pg_temp.who('sec'); uadmin uuid := pg_temp.who('uadmin');
  newperson uuid := pg_temp.who('newperson'); req1 uuid := pg_temp.who('req1');
  before_seq bigint; n bigint; msg text; result jsonb; act_seq bigint;
begin
  perform pg_temp.nobody();
  select coalesce(max(seq), 0) into before_seq from private.console_audit_event;

  begin
    revoke insert on table private.console_audit_event from semester_audit_writer;
    if has_table_privilege('semester_audit_writer', 'private.console_audit_event', 'insert') then
      raise exception 'FAILED: the writer still holds INSERT after the revoke; the probe is not doing anything';
    end if;

    msg := pg_temp.attempt(sec, true, format('select public.console_act(%L)', req1));
    perform pg_temp.refused_with('with the audit writer unable to insert, console_act raises',
                                 msg, 'permission denied');

    select count(*) into n from public.role_grants where subject = newperson;
    perform pg_temp.counted('and no role grant was made', n, 0);
    select count(*) into n from public.console_action_record where request_id = req1;
    perform pg_temp.counted('and no action record was written', n, 0);
    select count(*) into n from public.approval_request where id = req1 and status = 'approved' and executed_at is null;
    perform pg_temp.counted('and the request is still approved, not executed', n, 1);
    select count(*) into n from private.console_audit_event where seq > before_seq;
    perform pg_temp.counted('and the audit chain did not grow', n, 0);

    raise exception using errcode = 'P0001', message = 'control:restore';
  exception when raise_exception then
    if sqlerrm <> 'control:restore' then raise; end if;
  end;

  if not has_table_privilege('semester_audit_writer', 'private.console_audit_event', 'insert') then
    raise exception 'FAILED: the writer''s INSERT did not come back with the rollback';
  end if;
  raise notice 'ok  the writer''s INSERT is restored';

  perform pg_temp.become_mfa(sec);
  result := public.console_act(req1);
  perform pg_temp.nobody();
  act_seq := (result ->> 'audit_seq')::bigint;
  if result ->> 'status' <> 'executed' or act_seq is null then
    raise exception 'FAILED: console_act returned %', result;
  end if;
  raise notice 'ok  with the writer restored, the approver acted (audit seq %)', act_seq;

  select count(*) into n from private.console_audit_event
   where seq = act_seq and action = 'console.act' and actor = sec and target = req1::text
     and seq > before_seq;
  perform pg_temp.counted('the console.act audit event is the one the call names, and is new', n, 1);
  select count(*) into n from public.role_grants
   where subject = newperson and role = 'university_staff' and scope_kind = 'school'
     and scope_id = 'console-b-check' and provenance = 'platform' and granted_by = uadmin
     and revoked_at is null;
  perform pg_temp.counted('the effect: one platform-provenance grant, granted by the requester', n, 1);
  select count(*) into n from public.role_grant_audit_event e
   join public.role_grants g on g.id = e.grant_id
   where g.subject = newperson and e.action = 'insert';
  perform pg_temp.counted('and the role-grant audit saw it', n, 1);
  select count(*) into n from public.approval_request where id = req1 and status = 'executed' and executed_at is not null;
  perform pg_temp.counted('and the request is executed', n, 1);

  perform pg_temp.refused_with('an executed request cannot be acted on again',
    pg_temp.attempt(sec, true, format('select public.console_act(%L)', req1)),
    'executed, not approved');
end $$;

-- ── Two-person ────────────────────────────────────────────────────────────

do $$
declare
  operator uuid := pg_temp.who('operator'); sec uuid := pg_temp.who('sec'); fnd uuid := pg_temp.who('fnd');
  req uuid; became text; n bigint; result jsonb;
begin
  perform pg_temp.become(operator);
  req := public.request_approval('tenant-suspension', 'console-b-check', 'console-b-check', '{}'::jsonb,
                                 'Change ticket CH-77 and the customer communication', 'CH-77');
  perform pg_temp.nobody();
  perform pg_temp.remember('req2', req::text);

  perform pg_temp.become_mfa(sec);
  became := public.decide_approval(req, 'approve');
  perform pg_temp.nobody();
  if became <> 'pending' then
    raise exception 'FAILED: a two-person duty after one approval is %', became;
  end if;
  select count(*) into n from public.approval_request where id = req and status = 'pending' and decided_at is null;
  perform pg_temp.counted('a two-person duty is still pending after one approval', n, 1);

  perform pg_temp.become_mfa(fnd);
  became := public.decide_approval(req, 'approve');
  perform pg_temp.nobody();
  if became <> 'approved' then
    raise exception 'FAILED: a two-person duty after a second distinct approver is %', became;
  end if;
  select count(distinct approver) into n from public.approval_decision where request_id = req and decision = 'approve';
  perform pg_temp.counted('and approved after a second, distinct approver', n, 2);

  perform pg_temp.become_mfa(operator);
  result := public.console_act(req);
  perform pg_temp.nobody();
  select count(*) into n from public.tenant_plan where tenant_id = 'console-b-check' and status = 'suspended' and updated_by = operator;
  perform pg_temp.counted('the requester acted: the tenant plan is suspended', n, 1);
  select count(*) into n from public.tenant_plan_history where tenant_id = 'console-b-check' and status = 'suspended';
  perform pg_temp.counted('and the plan history recorded the change', n, 1);
end $$;

-- ── Break-glass ───────────────────────────────────────────────────────────

do $$
declare
  eng uuid := pg_temp.who('eng'); sec uuid := pg_temp.who('sec'); fnd uuid := pg_temp.who('fnd');
  stranger uuid := pg_temp.who('stranger'); operator uuid := pg_temp.who('operator');
  req uuid; result jsonb; grant_id uuid; act_seq bigint; open_seq bigint; n bigint; became text;
begin
  perform pg_temp.refused_with('a break-glass request expiring in five hours is refused',
    pg_temp.attempt(eng, false, format(
      'select public.request_approval(%L, %L, %L, %L::jsonb, %L, %L)',
      'break-glass', 'console-b-check', 'tenant console-b-check, read-only',
      format('{"expires_at": "%s", "scope": "tenant:configure integration:view"}', (now() + interval '5 hours')::text),
      'Incident INC-42, fresh MFA, expiry at the incident close, review booked', 'INC-42')),
    'more than four hours');

  perform pg_temp.refused_with('a founder cannot request break-glass without the engineering seat',
    pg_temp.attempt(fnd, false, format(
      'select public.request_approval(%L, %L, %L, %L::jsonb, %L, %L)',
      'break-glass', 'console-b-check', 'x',
      format('{"expires_at": "%s"}', (now() + interval '3 hours')::text), 'Incident INC-42', 'INC-42')),
    'do not hold the party');

  perform pg_temp.become(eng);
  req := public.request_approval('break-glass', 'console-b-check', 'tenant console-b-check, read-only',
           format('{"expires_at": "%s", "scope": "tenant:configure integration:view"}', (now() + interval '3 hours')::text)::jsonb,
           'Incident INC-42, fresh MFA, expiry at the incident close, review booked', 'INC-42');
  perform pg_temp.nobody();
  perform pg_temp.remember('req3', req::text);

  perform pg_temp.become_mfa(sec);
  became := public.decide_approval(req, 'approve');
  perform pg_temp.nobody();
  if became <> 'pending' then raise exception 'FAILED: break-glass after one seat is %', became; end if;
  perform pg_temp.become_mfa(fnd);
  became := public.decide_approval(req, 'approve');
  perform pg_temp.nobody();
  if became <> 'approved' then raise exception 'FAILED: break-glass after two seats is %', became; end if;
  raise notice 'ok  break-glass needed the security seat and the founder seat';

  perform pg_temp.become_mfa(eng);
  result := public.console_act(req);
  perform pg_temp.nobody();
  grant_id := (result -> 'effect' ->> 'break_glass_grant')::uuid;
  act_seq := (result ->> 'audit_seq')::bigint;
  perform pg_temp.remember('bg1', grant_id::text);

  select count(*) into n from public.break_glass_grant
   where id = grant_id and subject = eng and tenant_id = 'console-b-check' and ticket = 'INC-42'
     and closed_at is null and expires_at <= opened_at + interval '4 hours' and review_due >= expires_at;
  perform pg_temp.counted('the engineer acted: one open break-glass grant within four hours', n, 1);
  perform pg_temp.counted('private.break_glass_active says so',
    (private.break_glass_active(eng, 'console-b-check'))::int, 1);

  -- The grant is heard where every tenant policy asks: has_capability. The
  -- engineer holds no role over the tenant, so before this each answer was
  -- false; now the two scoped capabilities are true, one outside the scope
  -- stays false, and the platform scope stays false whatever the grant says.
  perform pg_temp.become(eng);
  perform pg_temp.counted('under break-glass the engineer holds tenant:configure over the tenant',
    (private.has_capability('tenant:configure', 'school', 'console-b-check'))::int, 1);
  perform pg_temp.counted('and integration:view, the other capability the approvers read',
    (private.has_capability('integration:view', 'school', 'console-b-check'))::int, 1);
  perform pg_temp.counted('but not audit:read, which the scope does not name',
    (private.has_capability('audit:read', 'school', 'console-b-check'))::int, 0);
  perform pg_temp.counted('nor anything over another tenant',
    (private.has_capability('tenant:configure', 'school', 'console-b-demo'))::int, 0);
  perform pg_temp.counted('nor at platform scope',
    (private.has_capability('tenant:configure'))::int, 0);
  perform pg_temp.nobody();
  perform pg_temp.become(stranger);
  perform pg_temp.counted('and the grant is the engineer''s alone',
    (private.has_capability('tenant:configure', 'school', 'console-b-check'))::int, 0);
  perform pg_temp.nobody();

  -- A scope that is not a capability list, or names a capability that does
  -- not exist, is refused at request time.
  perform pg_temp.refused_with('a break-glass scope that is prose is refused',
    pg_temp.attempt(eng, false, format(
      'select public.request_approval(%L, %L, %L, %L::jsonb, %L, %L)',
      'break-glass', 'console-b-check', 'x',
      format('{"expires_at": "%s", "scope": "tenant console-b-check, read-only"}', (now() + interval '3 hours')::text),
      'Incident INC-43', 'INC-43')),
    'needs a scope');
  perform pg_temp.refused_with('a break-glass scope naming a capability that does not exist is refused',
    pg_temp.attempt(eng, false, format(
      'select public.request_approval(%L, %L, %L, %L::jsonb, %L, %L)',
      'break-glass', 'console-b-check', 'x',
      format('{"expires_at": "%s", "scope": "tenant:configure everything:always"}', (now() + interval '3 hours')::text),
      'Incident INC-43', 'INC-43')),
    'do not exist');

  select seq into open_seq from private.console_audit_event
   where action = 'breakglass.opened' and target = grant_id::text;
  if open_seq is null or open_seq <= act_seq then
    raise exception 'FAILED: console.act seq % is not below breakglass.opened seq %', act_seq, open_seq;
  end if;
  raise notice 'ok  the console.act audit event (seq %) was written before the effect''s own (seq %)', act_seq, open_seq;

  -- The table holds the four hours on its own, whatever a function does.
  perform pg_temp.nobody();
  begin
    insert into public.break_glass_grant (request_id, subject, tenant_id, ticket, scope, expires_at, review_due)
    values (req, eng, 'console-b-check', 'INC-42', 'tenant:configure', now() + interval '5 hours', now() + interval '6 hours');
    raise exception 'FAILED: the table accepted a five-hour break-glass grant';
  exception when check_violation then
    raise notice 'ok  the table itself refuses a break-glass grant longer than four hours';
  end;

  perform pg_temp.refused_with('a review before the access has ended is refused',
    pg_temp.attempt(fnd, false, format('select public.review_break_glass(%L, %L)', grant_id, 'Looked fine')),
    'still open');
  perform pg_temp.refused_with('somebody else cannot close the engineer''s grant',
    pg_temp.attempt(stranger, false, format('select public.close_break_glass(%L)', grant_id)),
    'No break-glass grant of yours');
  perform pg_temp.went_through('the engineer closes their own grant',
    pg_temp.attempt(eng, false, format('select public.close_break_glass(%L)', grant_id)));
  perform pg_temp.counted('and it is no longer active',
    (private.break_glass_active(eng, 'console-b-check'))::int, 0);
  perform pg_temp.become(eng);
  perform pg_temp.counted('and has_capability no longer hears it',
    (private.has_capability('tenant:configure', 'school', 'console-b-check'))::int, 0);
  perform pg_temp.nobody();
  select count(*) into n from private.console_audit_event where action = 'breakglass.closed' and target = grant_id::text;
  perform pg_temp.counted('the close was audited', n, 1);

  perform pg_temp.refused_with('the subject cannot review their own use',
    pg_temp.attempt(eng, false, format('select public.review_break_glass(%L, %L)', grant_id, 'I was careful')),
    'cannot review your own');
  perform pg_temp.refused_with('an operator without the security or founder seat cannot review',
    pg_temp.attempt(operator, false, format('select public.review_break_glass(%L, %L)', grant_id, 'Fine')),
    'security or founder seat');
  perform pg_temp.went_through('the founder reviews it',
    pg_temp.attempt(fnd, false, format('select public.review_break_glass(%L, %L)', grant_id, 'Scope respected; nothing exported.')));
  select count(*) into n from public.break_glass_grant where id = grant_id and reviewed_by = fnd and reviewed_at is not null;
  perform pg_temp.counted('the review is recorded', n, 1);
  select count(*) into n from private.console_audit_event where action = 'breakglass.reviewed' and target = grant_id::text and actor = fnd;
  perform pg_temp.counted('and audited', n, 1);
end $$;

-- ── An unreviewed overdue grant blocks the next ───────────────────────────

do $$
declare
  eng uuid := pg_temp.who('eng'); sec uuid := pg_temp.who('sec'); fnd uuid := pg_temp.who('fnd');
  req3 uuid := pg_temp.who('req3'); overdue uuid; req uuid; became text;
begin
  perform pg_temp.nobody();
  -- A grant from three days ago whose review was due yesterday and never
  -- happened; written as operations would, not through the function.
  insert into public.break_glass_grant (request_id, subject, tenant_id, ticket, scope, opened_at, expires_at, review_due)
  values (req3, eng, 'console-b-check', 'INC-41', 'tenant:configure',
          now() - interval '3 days', now() - interval '3 days' + interval '4 hours', now() - interval '1 day')
  returning id into overdue;

  perform pg_temp.become(eng);
  req := public.request_approval('break-glass', 'console-b-check', 'tenant console-b-check',
           format('{"expires_at": "%s", "scope": "tenant:configure"}', (now() + interval '2 hours')::text)::jsonb,
           'Incident INC-43', 'INC-43');
  perform pg_temp.nobody();
  perform pg_temp.remember('req4', req::text);

  perform pg_temp.refused_with('while a break-glass review is overdue, the next request cannot be approved',
    pg_temp.attempt(sec, true, format('select public.decide_approval(%L, %L)', req, 'approve')),
    'review is overdue');

  perform pg_temp.went_through('the founder reviews the overdue grant',
    pg_temp.attempt(fnd, false, format('select public.review_break_glass(%L, %L)', overdue, 'Late review; access was in scope.')));

  perform pg_temp.become_mfa(sec);
  became := public.decide_approval(req, 'approve');
  perform pg_temp.nobody();
  if became <> 'pending' then raise exception 'FAILED: after the review, the approval came back %', became; end if;
  raise notice 'ok  once reviewed, the next break-glass request can be approved again';
end $$;

-- ── Expiry ────────────────────────────────────────────────────────────────

do $$
declare
  uadmin uuid := pg_temp.who('uadmin'); sec uuid := pg_temp.who('sec'); req uuid;
begin
  perform pg_temp.nobody();
  insert into public.approval_request (duty_id, requester, tenant_id, evidence, ticket, expires_at)
  values ('role-grant', uadmin, 'console-b-check', 'Old request', 'ACC-0900', now() - interval '1 second')
  returning id into req;
  perform pg_temp.refused_with('an expired request cannot be decided',
    pg_temp.attempt(sec, true, format('select public.decide_approval(%L, %L)', req, 'approve')),
    'expired');
end $$;

-- ── The commercial core, and the demo tenant ──────────────────────────────

do $$
declare
  operator uuid := pg_temp.who('operator'); uadmin uuid := pg_temp.who('uadmin');
  otheradmin uuid := pg_temp.who('otheradmin'); stranger uuid := pg_temp.who('stranger');
  eng uuid := pg_temp.who('eng');
  c_check uuid; c_other uuid; c_demo uuid; req uuid; stale uuid; n bigint; got text;
begin
  perform pg_temp.nobody();
  set local role service_role;
  insert into public.customer (tenant_id, legal_name, status, owner_seat) values
    ('console-b-check', 'Console Check University Inc.', 'active', 'success') returning id into c_check;
  insert into public.customer (tenant_id, legal_name, status, owner_seat) values
    ('console-b-other', 'Other Console University', 'pilot', 'success') returning id into c_other;
  insert into public.customer (tenant_id, legal_name, status, owner_seat) values
    ('console-b-demo', 'Demo University (synthetic)', 'active', 'product') returning id into c_demo;
  insert into public.customer_commitment (customer_id, commitment_id, status, due_on) values
    (c_check, 'CMT-001', 'promised', current_date + 60);
  insert into public.customer_contract (customer_id, kind, signed_on, starts_on, ends_on) values
    (c_check, 'pilot-agreement', current_date - 30, current_date - 30, current_date + 30),
    (c_other, 'nda', current_date - 10, current_date - 10, null),
    (c_demo, 'order-form', current_date - 30, current_date - 30, current_date + 45);
  reset role;
  raise notice 'ok  the service role recorded three customers, a commitment and three contracts';

  perform pg_temp.become(operator);
  select count(*) into n from public.console_customers();
  perform pg_temp.counted('the operator''s default customer read leaves the demo tenant out', n, 2);
  select count(*) into n from public.console_customers() where is_demo;
  perform pg_temp.counted('with no demo row among them', n, 0);
  select count(*) into n from public.console_customers(true);
  perform pg_temp.counted('and include_demo := true shows all three', n, 3);
  select count(*) into n from public.console_customers()
   where tenant_id = 'console-b-check'
     and jsonb_array_length(commitments) = 1 and jsonb_array_length(contracts) = 1;
  perform pg_temp.counted('a customer carries its commitments and contracts', n, 1);
  perform pg_temp.nobody();

  perform pg_temp.become(operator);
  req := public.request_approval('tenant-suspension', 'console-b-demo', 'console-b-demo', '{}'::jsonb,
                                 'Demo change ticket', 'CH-DEMO-1');
  perform pg_temp.nobody();
  perform pg_temp.remember('req_demo', req::text);
  insert into public.break_glass_grant (request_id, subject, tenant_id, ticket, scope, expires_at, review_due)
  values (req, eng, 'console-b-demo', 'INC-DEMO', 'tenant:configure', now() + interval '1 hour', now() + interval '1 day');

  perform pg_temp.become(operator);
  select count(*) into n from public.console_approvals() where id = req;
  perform pg_temp.counted('the demo tenant''s approval request is absent from the default read', n, 0);
  select count(*) into n from public.console_approvals(true) where id = req and is_demo;
  perform pg_temp.counted('and present, marked demo, when asked for', n, 1);
  -- Nothing rewrites a stored status when its window closes, so the reader
  -- derives it: a pending request whose expiry has passed reads `expired`,
  -- and the console offers nothing on it.
  -- The expiry is pinned once written, so the elapsed request is made as
  -- one whose window has already closed, still `pending` in the row.
  perform pg_temp.nobody();
  insert into public.approval_request (duty_id, requester, tenant_id, target, evidence, ticket, expires_at)
  values ('tenant-suspension', operator, 'console-b-demo', 'console-b-demo', 'Stale change ticket', 'CH-DEMO-OLD', now() - interval '1 minute')
  returning id into stale;
  select status into got from public.approval_request where id = stale;
  if got <> 'pending' then raise exception 'FAILED: the stale row is stored as %', got; end if;
  perform pg_temp.become(operator);
  select status into got from public.console_approvals(true) where id = stale;
  if got <> 'expired' then raise exception 'FAILED: an elapsed pending request reads as %', got; end if;
  raise notice 'ok  an elapsed pending request reads as expired, whatever the row still says';
  select count(*) into n from public.console_approvals(true) where id = stale and can_decide;
  perform pg_temp.counted('and cannot be decided', n, 0);
  perform pg_temp.nobody();
  select count(*) into n from public.console_break_glass() where tenant_id = 'console-b-demo';
  perform pg_temp.counted('the demo tenant''s break-glass grant is absent from the default read', n, 0);
  select count(*) into n from public.console_break_glass(true) where tenant_id = 'console-b-demo' and active;
  perform pg_temp.counted('and present when asked for', n, 1);
  perform pg_temp.nobody();

  -- Tenant scoping on the tables themselves.
  perform pg_temp.become(uadmin);
  select count(*) into n from public.customer;
  perform pg_temp.counted('a university admin sees only their own school''s customer row', n, 1);
  select string_agg(tenant_id, ',') into got from public.customer;
  if got <> 'console-b-check' then raise exception 'FAILED: the university admin saw %', got; end if;
  select count(*) into n from public.customer_commitment;
  perform pg_temp.counted('and its commitments', n, 1);
  select count(*) into n from public.customer_contract;
  perform pg_temp.counted('and its contracts', n, 1);
  select count(*) into n from public.console_customers();
  perform pg_temp.counted('the reader agrees', n, 1);
  perform pg_temp.nobody();

  perform pg_temp.become(otheradmin);
  select string_agg(tenant_id, ',') into got from public.customer;
  if got <> 'console-b-other' then raise exception 'FAILED: the other school''s admin saw %', got; end if;
  select count(*) into n from public.customer_commitment;
  perform pg_temp.counted('the other school''s admin sees their own customer and none of the first''s commitments', n, 0);
  perform pg_temp.nobody();

  perform pg_temp.become(stranger);
  select count(*) into n from public.customer;
  perform pg_temp.counted('an account with no grant sees no customer at all', n, 0);
  select count(*) into n from public.approval_request;
  perform pg_temp.counted('nor any approval request', n, 0);
  select count(*) into n from public.break_glass_grant;
  perform pg_temp.counted('nor any break-glass grant', n, 0);
  perform pg_temp.nobody();

  perform pg_temp.refused_with('a university admin cannot write their own customer row',
    pg_temp.attempt(uadmin, false, format(
      'update public.customer set status = %L where tenant_id = %L', 'active', 'console-b-check')),
    'permission denied');
  perform pg_temp.refused_with('nor can an operator through the browser',
    pg_temp.attempt(operator, false, format(
      'insert into public.customer (tenant_id, status) values (%L, %L)', 'console-b-other', 'active')),
    'permission denied');
  perform pg_temp.refused_with('nor add a contract',
    pg_temp.attempt(operator, false, format(
      'insert into public.customer_contract (customer_id, kind) values (%L, %L)', c_check, 'sla')),
    'permission denied');
end $$;

-- ── Figures ───────────────────────────────────────────────────────────────

do $$
declare
  operator uuid := pg_temp.who('operator'); stranger uuid := pg_temp.who('stranger');
  n bigint; got text;
begin
  perform pg_temp.become(operator);
  select count(*) into n from public.console_figures()
   where figure in ('approvals-open', 'break-glass-active', 'customers-active', 'contracts-expiring-90d');
  perform pg_temp.counted('the four figures this file adds are present', n, 4);
  select count(*) into n from public.console_figures()
   where source is null or time_window is null or owner_seat is null or refreshed_at is null
      or evidence is null or limitation is null;
  perform pg_temp.counted('and every figure carries every provenance field', n, 0);
  select count(*) into n from public.console_figures()
   where owner_seat not in ('founder', 'product', 'engineering', 'security', 'privacy',
                            'accessibility', 'success', 'trust', 'data', 'champion');
  perform pg_temp.counted('every owner is one of the ten seats', n, 0);

  -- Pending and unexpired, demo excluded: the security seat's own request
  -- (req_self) and the second break-glass request (req4, one approval of two).
  select value into got from public.console_figures() where figure = 'approvals-open';
  perform pg_temp.counted('approvals-open counts the two pending non-demo requests', got::bigint, 2);
  select value into got from public.console_figures(true) where figure = 'approvals-open';
  perform pg_temp.counted('and three with the demo tenant''s', got::bigint, 3);
  select value into got from public.console_figures() where figure = 'break-glass-active';
  perform pg_temp.counted('break-glass-active is zero: the real grant is closed, the demo one excluded', got::bigint, 0);
  select value into got from public.console_figures(true) where figure = 'break-glass-active';
  perform pg_temp.counted('and one with the demo tenant''s', got::bigint, 1);
  select value into got from public.console_figures() where figure = 'customers-active';
  perform pg_temp.counted('customers-active is one', got::bigint, 1);
  select value into got from public.console_figures() where figure = 'contracts-expiring-90d';
  perform pg_temp.counted('contracts-expiring-90d is one', got::bigint, 1);
  select value into got from public.console_figures(true) where figure = 'contracts-expiring-90d';
  perform pg_temp.counted('and two with the demo tenant''s', got::bigint, 2);
  select count(*) into n from public.console_figures() where figure = 'billing' and value = 'not applicable';
  perform pg_temp.counted('the control plane''s billing row survived the replacement', n, 1);
  perform pg_temp.nobody();

  -- Whether the control plane's function raises for a non-operator or
  -- returns nothing, the answer is the same: no figure reaches them.
  begin
    perform pg_temp.become(stranger);
    select count(*) into n from public.console_figures();
    perform pg_temp.nobody();
    if n > 0 then
      raise exception 'FAILED: an account without console:operate read % figures', n;
    end if;
  exception when insufficient_privilege then
    perform pg_temp.nobody();
  end;
  raise notice 'ok  an account without console:operate gets no figures';
end $$;

-- ── The helpers stay out of reach ─────────────────────────────────────────

do $$
begin
  if has_function_privilege('authenticated', 'private.break_glass_active(uuid, text)', 'execute')
     or has_function_privilege('anon', 'private.break_glass_active(uuid, text)', 'execute')
     or has_function_privilege('authenticated', 'private.break_glass_review_overdue(uuid)', 'execute') then
    raise exception 'FAILED: a client role can execute a break-glass predicate directly';
  end if;
  if has_function_privilege('anon', 'public.console_act(uuid, text)', 'execute')
     or has_function_privilege('anon', 'public.request_approval(text, text, text, jsonb, text, text, text)', 'execute')
     or has_function_privilege('anon', 'public.decide_approval(uuid, text)', 'execute') then
    raise exception 'FAILED: anon can execute a console writer';
  end if;
  raise notice 'ok  the break-glass predicates are private and no console writer is open to anon';
end $$;

rollback;
