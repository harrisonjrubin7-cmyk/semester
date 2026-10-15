-- The common audit envelope (audit_event) and the rights-request queue
-- (data_subject_request). LOCAL/DISPOSABLE DATABASES ONLY; always rolled back.
--
-- What must hold:
--   * only trusted code writes an audit event: a signed-in client cannot insert
--     one, forge its own history, or reach the recorder function
--   * an event is stored with pseudonyms, and free text cannot ride in `detail`
--   * a school's auditor reads that school's events and no other school's; a
--     student and an outsider read none
--   * an event cannot be edited or deleted, except by the retention sweep and
--     only once it is past the period
--   * a person raises requests about themselves, in their starting state only;
--     reads only their own; and cannot answer, verify, extend or delete one
--   * a school's auditor sees that school's requests and no other's

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
  north_auditor uuid;
  south_auditor uuid;
  north_student uuid;
  other_student uuid;
  n bigint;
  made uuid;
  req uuid;
  req2 uuid;
  hash text;
begin
  insert into public.schools (id, name, email_domains) values
    ('north-aud', 'North Audit University', array['north-aud.example']),
    ('south-aud', 'South Audit College', array['south-aud.example']);
  north_auditor := pg_temp.newuser('auditor@north-aud.example', 'north-aud');
  south_auditor := pg_temp.newuser('auditor@south-aud.example', 'south-aud');
  north_student := pg_temp.newuser('student@north-aud.example', 'north-aud');
  other_student := pg_temp.newuser('student2@north-aud.example', 'north-aud');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (north_auditor, 'university_admin', 'school', 'north-aud', 'institution'),
    (south_auditor, 'university_admin', 'school', 'south-aud', 'institution');

  -- ── audit_event ──────────────────────────────────────────────────────────

  -- The control: the service role records events through the recorder.
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'service_role')::text, true);
  set local role service_role;
  made := private.record_audit('north-aud', 'share.create', 'plan', 'plan-123', 'allowed', 'corr-12345678',
                               '{"scope":"view"}'::jsonb);
  perform private.record_audit('south-aud', 'export.request', 'account', 'acct-9', 'denied');
  reset role;
  select count(*) into n from public.audit_event;
  perform pg_temp.counted('the recorder writes an event for each call', n, 2);

  select object_sha256 into hash from public.audit_event where id = made;
  perform pg_temp.counted('the object is stored as a pseudonym, not its id', (hash ~ '^[0-9a-f]{64}$' and hash <> 'plan-123')::int, 1);
  select count(*) into n from public.audit_event where id = made and actor_kind = 'service' and actor_sha256 is null;
  perform pg_temp.counted('a service-role event says so and names no person', n, 1);

  -- A signed-in client cannot write, or reach the recorder.
  perform pg_temp.become(north_student);
  if not pg_temp.refused($q$insert into public.audit_event (action, object_kind, outcome, actor_kind) values ('auth.sign_in', 'session', 'allowed', 'authenticated')$q$) then
    raise exception 'FAILED: a client inserted an audit event';
  end if;
  if not pg_temp.refused($q$select private.record_audit('north-aud', 'auth.sign_in', 'session', null, 'allowed')$q$) then
    raise exception 'FAILED: a client called the audit recorder';
  end if;
  reset role;
  raise notice 'ok  a client can neither insert an event nor call the recorder';

  -- Reads: own school's auditor only; students and outsiders see nothing.
  perform pg_temp.become(north_auditor);
  select count(*) into n from public.audit_event;
  perform pg_temp.counted('a school auditor reads that school''s events and no other''s', n, 1);
  reset role;
  perform pg_temp.become(south_auditor);
  select count(*) into n from public.audit_event where tenant_id = 'north-aud';
  perform pg_temp.counted('another school''s auditor cannot read them', n, 0);
  reset role;
  perform pg_temp.become(north_student);
  select count(*) into n from public.audit_event;
  perform pg_temp.counted('a student reads no audit events', n, 0);
  reset role;
  set local role anon;
  if not pg_temp.refused($q$select count(*) from public.audit_event$q$) then
    raise exception 'FAILED: anon could select from audit_event';
  end if;
  reset role;
  raise notice 'ok  anon cannot read audit events';

  -- The envelope stays narrow.
  if not pg_temp.refused($q$select private.record_audit('north-aud', 'Not A Verb', 'plan', null, 'allowed')$q$) then
    raise exception 'FAILED: a malformed action was accepted';
  end if;
  if not pg_temp.refused($q$select private.record_audit('north-aud', 'share.create', 'plan', null, 'maybe')$q$) then
    raise exception 'FAILED: an unknown outcome was accepted';
  end if;
  if not pg_temp.refused(format($q$select private.record_audit('north-aud', 'share.create', 'plan', null, 'allowed', null, jsonb_build_object('note', %L))$q$, repeat('x', 3000))) then
    raise exception 'FAILED: a large detail payload was accepted';
  end if;
  raise notice 'ok  the envelope refuses a malformed action, an unknown outcome and a bulky detail';

  -- Immutable, except for the sweep, and only past the period.
  if not pg_temp.refused($q$update public.audit_event set outcome = 'allowed'$q$) then
    raise exception 'FAILED: an audit event was edited';
  end if;
  if not pg_temp.refused($q$delete from public.audit_event$q$) then
    raise exception 'FAILED: a recent audit event was deleted';
  end if;
  raise notice 'ok  an audit event cannot be edited or deleted';

  alter table public.audit_event disable trigger keep_audit_event_immutable;
  update public.audit_event set occurred_at = now() - interval '4 years' where id = made;
  alter table public.audit_event enable trigger keep_audit_event_immutable;
  perform private.sweep_audit_retention();
  select count(*) into n from public.audit_event where id = made;
  perform pg_temp.counted('the sweep removes an event past three years', n, 0);
  select count(*) into n from public.audit_event;
  perform pg_temp.counted('and leaves a recent one', n, 1);

  -- ── data_subject_request ─────────────────────────────────────────────────

  perform pg_temp.become(north_student);
  insert into public.data_subject_request (subject, tenant_id, kind)
  values (north_student, 'north-aud', 'export') returning id into req;
  reset role;
  select count(*) into n from public.data_subject_request where id = req and status = 'received' and due_at > now() + interval '29 days';
  perform pg_temp.counted('a person raises a request about themselves, with a thirty-day clock', n, 1);

  -- The product uses one definer entry point so subject and tenant are facts
  -- from the session, not values a browser has to assert. Two rapid same-kind
  -- filings return the first request without resetting its clock.
  perform pg_temp.become(north_student);
  req2 := public.raise_my_data_subject_request('correction', 'My program is wrong.');
  made := public.raise_my_data_subject_request('correction', 'A second tap must not replace the first note.');
  reset role;
  perform pg_temp.counted('same-kind intake is idempotent', (req2 = made)::int, 1);
  select count(*) into n from public.data_subject_request
   where subject = north_student and kind = 'correction' and resolved_at is null
     and tenant_id = 'north-aud' and detail = 'My program is wrong.';
  perform pg_temp.counted('intake derives the subject and tenant and preserves the first request', n, 1);
  set local role anon;
  if not pg_temp.refused($q$select public.raise_my_data_subject_request('export', '')$q$) then
    raise exception 'FAILED: an unsigned visitor filed a rights request';
  end if;
  reset role;
  raise notice 'ok  unsigned intake is refused';

  -- Raising a request left an audit event, without content.
  select count(*) into n from public.audit_event
   where action = 'privacy.request_raised' and tenant_id = 'north-aud' and detail = '{"kind":"export","requested_by":"self"}'::jsonb;
  perform pg_temp.counted('raising a request writes one audit event, kind and requester only', n, 1);

  -- So does the export the Privacy page offers.
  perform pg_temp.become(north_student);
  perform public.export_my_data();
  reset role;
  select count(*) into n from public.audit_event where action = 'privacy.export_completed' and tenant_id = 'north-aud';
  perform pg_temp.counted('an export writes one audit event', n, 1);

  perform pg_temp.become(north_student);
  if not pg_temp.refused(format($q$insert into public.data_subject_request (subject, tenant_id, kind) values (%L, 'north-aud', 'erasure')$q$, other_student)) then
    raise exception 'FAILED: a request was raised about somebody else';
  end if;
  if not pg_temp.refused(format($q$insert into public.data_subject_request (subject, tenant_id, kind, status, resolved_at) values (%L, 'north-aud', 'export', 'completed', now())$q$, north_student)) then
    raise exception 'FAILED: a request was opened already completed';
  end if;
  if not pg_temp.refused(format($q$insert into public.data_subject_request (subject, tenant_id, kind, status) values (%L, 'north-aud', 'export', 'in_progress')$q$, north_student)) then
    raise exception 'FAILED: a request was opened already in progress';
  end if;
  if not pg_temp.refused(format($q$insert into public.data_subject_request (subject, tenant_id, kind, verified_at) values (%L, 'north-aud', 'export', now())$q$, north_student)) then
    raise exception 'FAILED: a request was opened already verified';
  end if;
  if not pg_temp.refused(format($q$insert into public.data_subject_request (subject, tenant_id, kind, requested_by) values (%L, 'north-aud', 'export', 'guardian')$q$, north_student)) then
    raise exception 'FAILED: a person raised a request as their own guardian';
  end if;
  if not pg_temp.refused(format($q$insert into public.data_subject_request (subject, tenant_id, kind) values (%L, 'south-aud', 'export')$q$, north_student)) then
    raise exception 'FAILED: a request named a school the person is not in';
  end if;
  raise notice 'ok  a request is only ever raised about oneself, as oneself, in its starting state, in one''s own school';

  if not pg_temp.refused($q$update public.data_subject_request set status = 'completed', resolved_at = now()$q$) then
    raise exception 'FAILED: a person answered their own request';
  end if;
  if not pg_temp.refused($q$delete from public.data_subject_request$q$) then
    raise exception 'FAILED: a person deleted a request';
  end if;
  reset role;
  raise notice 'ok  a person cannot answer, verify, extend or delete a request';

  perform pg_temp.become(other_student);
  select count(*) into n from public.data_subject_request;
  perform pg_temp.counted('another student sees none of it', n, 0);
  reset role;
  perform pg_temp.become(north_student);
  select count(*) into n from public.data_subject_request;
  perform pg_temp.counted('the person sees their own', n, 2);
  reset role;
  perform pg_temp.become(north_auditor);
  select count(*) into n from public.data_subject_request;
  perform pg_temp.counted('the school''s auditor sees that school''s requests', n, 2);
  reset role;
  perform pg_temp.become(south_auditor);
  select count(*) into n from public.data_subject_request;
  perform pg_temp.counted('another school''s auditor sees none', n, 0);
  reset role;

  -- Account erasure takes the request with the account.
  delete from auth.users where id = north_student;
  select count(*) into n from public.data_subject_request where subject = north_student;
  perform pg_temp.counted('deleting the account removes its requests', n, 0);
end $$;

rollback;
