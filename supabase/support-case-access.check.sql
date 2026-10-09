-- Identity-free support-case metadata and consent-bound aggregate reads.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.become_mfa(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object(
      'sub', who::text,
      'role', 'authenticated',
      'aal', 'aal2',
      'amr', jsonb_build_array(jsonb_build_object(
        'method', 'totp', 'timestamp', extract(epoch from now())
      ))
    )::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.become_aal1(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at
  ) values (
    who, '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', address, now(), now(), now()
  );
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

create or replace function pg_temp.refused(who uuid, statement text, with_mfa boolean default false)
returns boolean language plpgsql as $$
begin
  if with_mfa then
    perform pg_temp.become_mfa(who);
  else
    perform pg_temp.become(who);
  end if;
  execute statement;
  execute 'reset role';
  return false;
exception when others then
  execute 'reset role';
  return true;
end $$;

create or replace function pg_temp.must_refuse(
  what text, who uuid, statement text, with_mfa boolean default false
)
returns void language plpgsql as $$
begin
  if not pg_temp.refused(who, statement, with_mfa) then
    raise exception 'FAILED: % — it was allowed', what;
  end if;
  raise notice 'ok  %', what;
end $$;

do $$
declare
  student uuid;
  other_student uuid;
  dual_agent uuid;
  ticket_only_agent uuid;
  reader_only uuid;
  wrong_tenant_agent uuid;
  active_ticket uuid := gen_random_uuid();
  closed_ticket uuid := gen_random_uuid();
  resolved_ticket uuid := gen_random_uuid();
  other_ticket uuid := gen_random_uuid();
  unlinked_ticket uuid := gen_random_uuid();
  second_ticket uuid := gen_random_uuid();
  case_grant_id uuid;
  evidence uuid;
  n bigint;
  state text;
  linked uuid;
  close_grant uuid;
  last_read timestamptz;
begin
  insert into public.schools (id, name, email_domains) values
    ('case-check', 'Case Check University', array['case-check.example']),
    ('case-check-other', 'Other Case University', array['case-check-other.example']);

  student := pg_temp.newuser('student@case-check.example', 'case-check');
  other_student := pg_temp.newuser('other-student@case-check.example', 'case-check');
  dual_agent := pg_temp.newuser('dual-agent@case-check.example', 'case-check');
  ticket_only_agent := pg_temp.newuser('ticket-agent@case-check.example', 'case-check');
  reader_only := pg_temp.newuser('reader@case-check.example', 'case-check');
  wrong_tenant_agent := pg_temp.newuser(
    'wrong-agent@case-check-other.example', 'case-check-other'
  );

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (dual_agent, 'support_agent', 'platform', '', 'platform'),
    (dual_agent, 'university_staff', 'school', 'case-check', 'institution'),
    (ticket_only_agent, 'support_agent', 'platform', '', 'platform'),
    (reader_only, 'university_staff', 'school', 'case-check', 'institution'),
    (wrong_tenant_agent, 'support_agent', 'platform', '', 'platform'),
    (wrong_tenant_agent, 'university_staff', 'school', 'case-check-other', 'institution');

  insert into public.support_tickets (
    id, student_id, category, subject, body, context, priority, status,
    first_response_due
  ) values
    (active_ticket, student, 'bug', 'Active case', 'Please help.', '{}', 'normal', 'open', now() + interval '3 days'),
    (closed_ticket, student, 'bug', 'Closed case', 'Already closed.', '{}', 'normal', 'closed', now() + interval '3 days'),
    (resolved_ticket, student, 'bug', 'Resolved case', 'Awaiting closure.', '{}', 'normal', 'resolved', now() + interval '3 days'),
    (other_ticket, other_student, 'bug', 'Other student', 'Private.', '{}', 'normal', 'open', now() + interval '3 days'),
    (unlinked_ticket, student, 'how_to', 'No access', 'Metadata only.', '{}', 'normal', 'open', now() + interval '3 days');
  insert into public.support_tickets (
    id, student_id, category, subject, body, context, priority, status, first_response_due
  ) values (
    second_ticket, student, 'bug', 'Second active case', 'Separate case.', '{}', 'normal', 'open', now() + interval '3 days'
  );

  perform pg_temp.become(student);
  select count(*) into n
    from public.available_case_supporters();
  reset role;
  perform pg_temp.counted(
    'the case picker offers only a same-school dual-role case agent', n, 1
  );

  perform pg_temp.must_refuse(
    'a support reader without case duty cannot receive case-bound access',
    student,
    format(
      'select public.create_support_access(%L, %L, 1, %L)',
      reader_only, 'Reader without case duty.', active_ticket
    )
  );

  perform pg_temp.must_refuse(
    'a student cannot bind access to another student ticket',
    student,
    format(
      'select public.create_support_access(%L, %L, 1, %L)',
      dual_agent, 'Wrong student case.', other_ticket
    )
  );
  perform pg_temp.must_refuse(
    'a student cannot bind access to a closed ticket',
    student,
    format(
      'select public.create_support_access(%L, %L, 1, %L)',
      dual_agent, 'Closed case.', closed_ticket
    )
  );
  perform pg_temp.must_refuse(
    'a student cannot bind access to a resolved ticket outside the active queue',
    student,
    format(
      'select public.create_support_access(%L, %L, 1, %L)',
      dual_agent, 'Resolved case.', resolved_ticket
    )
  );

  perform pg_temp.become(student);
  select public.create_support_access(
    dual_agent, 'Diagnose the aggregate learning pattern for this case.', 1,
    active_ticket
  ) into case_grant_id;
  reset role;

  select count(*) into n
    from public.support_access_grant g
    join public.consent_record c on c.id = g.consent_id
   where g.id = case_grant_id
     and g.ticket_id = active_ticket
     and c.metadata ->> 'ticket_id' = active_ticket::text
     and g.scopes = array['learning-progress']::text[];
  perform pg_temp.counted(
    'case, scope and consent are structurally linked to the grant', n, 1
  );

  perform pg_temp.become_aal1(dual_agent);
  select count(*) into n from public.support_access_windows() w where w.grant_id = case_grant_id;
  reset role;
  perform pg_temp.counted('aal1 hides supporter window metadata from a privileged agent', n, 0);

  perform pg_temp.become(dual_agent);
  select count(*) into n from public.support_access_windows() w where w.grant_id = case_grant_id;
  reset role;
  perform pg_temp.counted('current case duty exposes the supporter window', n, 1);

  update public.role_grants
     set revoked_at = now()
   where subject = dual_agent and role = 'support_agent' and scope_kind = 'platform' and scope_id = '';
  perform pg_temp.become(dual_agent);
  select count(*) into n from public.support_access_windows() w where w.grant_id = case_grant_id;
  reset role;
  perform pg_temp.counted('losing case duty hides the case-bound supporter window', n, 0);
  update public.role_grants
     set revoked_at = null
   where subject = dual_agent and role = 'support_agent' and scope_kind = 'platform' and scope_id = '';

  perform pg_temp.become(student);
  select public.create_support_access(
    dual_agent, 'A separate active case needs separate consent.', 1, second_ticket
  ) into linked;
  perform public.revoke_support_access(linked);
  reset role;
  raise notice 'ok  an existing case grant does not block consent for a different case';

  perform pg_temp.become(dual_agent);
  select a.grant_id, a.consent_state, a.last_sensitive_read_at
    into linked, state, last_read
    from public.support_case_access(active_ticket) a;
  reset role;
  if linked <> case_grant_id or state <> 'active' or last_read is not null then
    raise exception 'FAILED: active metadata was incomplete (%, %, %)', linked, state, last_read;
  end if;
  raise notice 'ok  the named dual-role agent sees active access metadata before any sensitive read';

  perform pg_temp.become(ticket_only_agent);
  select count(*) into n
    from public.support_case_access(active_ticket) a
   where a.ticket_id = active_ticket
     and a.grant_id is null
     and a.consent_state = 'not_granted'
     and not a.active;
  reset role;
  perform pg_temp.counted(
    'a ticket-only agent sees metadata-first not-granted state without another recipient grant', n, 1
  );

  perform pg_temp.must_refuse(
    'a support reader without ticket duty cannot inspect case metadata',
    reader_only,
    format('select count(*) from public.support_case_access(%L)', active_ticket)
  );
  perform pg_temp.must_refuse(
    'a wrong-tenant agent cannot use the case grant',
    wrong_tenant_agent,
    format('select count(*) from public.read_support_case_signals(%L)', active_ticket),
    true
  );
  perform pg_temp.must_refuse(
    'a guessed other ticket cannot use this case grant',
    dual_agent,
    format('select count(*) from public.read_support_case_signals(%L)', other_ticket),
    true
  );
  perform pg_temp.must_refuse(
    'a case signal read requires fresh MFA',
    dual_agent,
    format('select count(*) from public.read_support_case_signals(%L)', active_ticket)
  );
  perform pg_temp.must_refuse(
    'the legacy aggregate RPC cannot bypass fresh MFA for a case grant',
    dual_agent,
    format('select count(*) from public.read_support_signals(%L)', case_grant_id)
  );

  insert into public.evidence_reference (
    tenant_id, person_id, course_id, title, origin, authority, locator, created_by
  ) values (
    'case-check', student, 'econ', 'Practice result', 'student',
    'confirmed', 'case-check:1', student
  ) returning id into evidence;
  insert into public.concept_evidence (
    tenant_id, person_id, evidence_id, course_id, concept_id, kind, score
  ) values (
    'case-check', student, evidence, 'econ', 'elasticity', 'practice', 0.75
  );
  insert into public.mistake_evidence (
    tenant_id, person_id, evidence_id, course_id, concept_id, classification, detail
  ) values (
    'case-check', student, evidence, 'econ', 'elasticity', 'concept',
    'Private mistake detail that the case route must never return.'
  );

  perform pg_temp.become_mfa(dual_agent);
  select count(*) into n
    from public.read_support_case_signals(active_ticket) s
   where s.course_id = 'econ'
     and s.evidence_count = 1
     and s.average_score = 0.75
     and s.mistake_count = 1;
  reset role;
  perform pg_temp.counted(
    'fresh MFA and exact active consent return one aggregate signal', n, 1
  );

  select count(*) into n
    from public.support_access_event e
   where e.grant_id = case_grant_id and e.action = 'signals_viewed';
  perform pg_temp.counted('the sensitive case read records exactly one immutable event', n, 1);

  perform pg_temp.become(dual_agent);
  select a.last_sensitive_read_at into last_read
    from public.support_case_access(active_ticket) a;
  select count(*) into n
    from public.mistake_evidence m where m.person_id = student;
  reset role;
  if last_read is null then
    raise exception 'FAILED: active-grant metadata did not show the sensitive read';
  end if;
  raise notice 'ok  active-grant metadata shows the last sensitive read';
  perform pg_temp.counted('the agent still cannot browse raw mistake content', n, 0);

  select count(*) into n
    from unnest(regexp_split_to_array(
      pg_get_function_result('public.support_case_access(uuid)'::regprocedure),
      ',\\s*'
    )) as col
   where col ~* '(student|tenant|user|email|account|name|handle|body|content)';
  perform pg_temp.counted(
    'case metadata has no identity, tenant or private-content result column', n, 0
  );

  perform pg_temp.must_refuse(
    'the only supported scope cannot be widened',
    student,
    format(
      'update public.support_access_grant set scopes = array[''learning-progress'', ''notes''] where id = %L',
      case_grant_id
    )
  );

  update public.consent_record c
     set expires_at = now() - interval '1 minute'
   where c.id = (select g.consent_id from public.support_access_grant g where g.id = case_grant_id);
  perform pg_temp.must_refuse(
    'expired consent fails closed at the next case read',
    dual_agent,
    format('select count(*) from public.read_support_case_signals(%L)', active_ticket),
    true
  );

  perform pg_temp.become(dual_agent);
  select a.consent_state into state
    from public.support_case_access(active_ticket) a;
  reset role;
  if state <> 'expired' then
    raise exception 'FAILED: expired consent was reported as %', state;
  end if;
  raise notice 'ok  expired consent remains visible as inactive metadata';

  perform pg_temp.become(student);
  select public.create_support_access(
    dual_agent, 'General access must not authorize a case read.', 1, null
  ) into linked;
  reset role;
  perform pg_temp.must_refuse(
    'a general support window cannot authorize an unlinked case',
    dual_agent,
    format('select count(*) from public.read_support_case_signals(%L)', unlinked_ticket),
    true
  );

  perform pg_temp.become(student);
  perform public.revoke_support_access(linked);
  select public.create_support_access(
    dual_agent, 'This active case grant must close with its case.', 1,
    active_ticket
  ) into close_grant;
  perform public.close_my_ticket(active_ticket);
  reset role;
  select count(*) into n
    from public.support_access_grant g
   where g.id = close_grant and g.revoked_at is not null;
  perform pg_temp.counted('closing a case revokes its case-bound access', n, 1);

  select count(*) into n
    from pg_catalog.pg_proc p
   where p.oid = 'public.read_support_case_signals(uuid)'::regprocedure
     and position('private.assert_fresh_mfa()' in p.prosrc) > 0
     and position('public.read_support_signals(linked_grant)' in p.prosrc) > 0;
  perform pg_temp.counted(
    'the case reader enforces server MFA and delegates to the audited aggregate reader', n, 1
  );

  select count(*) into n
    from pg_catalog.pg_proc p
   where p.oid = 'public.read_support_signals(uuid)'::regprocedure
     and position('grant_row.ticket_id is not null' in p.prosrc) > 0
     and position('private.assert_fresh_mfa()' in p.prosrc) > 0
     and position('private.support_agent()' in p.prosrc) > 0;
  perform pg_temp.counted(
    'the legacy aggregate reader independently protects every case-linked grant', n, 1
  );

  raise notice 'support case access: every check passed';
end $$;

rollback;
