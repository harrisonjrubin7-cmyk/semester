-- Answering a rights request: who may, which moves are legal, and what is left
-- behind. LOCAL/DISPOSABLE DATABASES ONLY; always rolled back.
--
-- `data_subject_request` could be raised and never answered: `authenticated`
-- has select and insert, nothing updates a row, `verified_at` has no setter,
-- and a status change leaves no event (privacy findings C1, C2, C3).
--
-- What must hold:
--   * a holder of `data_request:handle` (the `data_steward` role) moves a
--     request through its statuses and records its verification, and nobody
--     else can: not the subject, not a school administrator, not a visitor
--   * the operator is not the requester, even if they hold the role
--   * only the legal moves are made: received -> verifying | refused,
--     verifying -> in_progress | refused, in_progress -> completed | refused;
--     a resolved request does not move again; nothing is acted on before it is
--     verified; a refusal says why
--   * every status change and every verification writes one audit event whose
--     detail is structure only: no resolution text, no detail text, no names
--   * the event is written by the table, so a change made some other way is
--     recorded too
--   * a refused attempt leaves no event and no change
--
-- Every refusal below is matched on its error code, not on "something failed":
-- a function that does not exist also fails, and must not read as a refusal.
--
-- The response clock and who may answer are counsel's (privacy queue P-03,
-- [COUNSEL REQUIRED]). Nothing here reads or sets `due_at`.

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

-- True only when the statement fails with this exact SQLSTATE. A missing
-- function is 42883 and never matches 42501 or 23514.
create or replace function pg_temp.refused_as(statement text, code text)
returns boolean language plpgsql as $$
begin
  execute statement;
  return false;
exception when others then
  if sqlstate = code then return true; end if;
  raise notice 'refused with % (%), wanted %', sqlstate, sqlerrm, code;
  return false;
end $$;

do $$
declare
  steward uuid;
  admin_user uuid;
  student uuid;
  other_student uuid;
  req uuid;
  req2 uuid;
  req3 uuid;
  steward_req uuid;
  events_before bigint;
  n bigint;
  hash text;
begin
  insert into public.schools (id, name, email_domains) values
    ('north-ans', 'North Answer University', array['north-ans.example']);
  steward       := pg_temp.newuser('steward@semester-ans.example', null);
  admin_user    := pg_temp.newuser('admin@north-ans.example', 'north-ans');
  student       := pg_temp.newuser('student@north-ans.example', 'north-ans');
  other_student := pg_temp.newuser('student2@north-ans.example', 'north-ans');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (steward,    'data_steward',     'platform', '',          'platform'),
    (admin_user, 'university_admin', 'school',   'north-ans', 'institution');

  -- Requests raised the way a person raises them.
  perform pg_temp.become(student);
  req  := public.raise_my_data_subject_request('export', 'SECRET-DETAIL-TEXT please');
  req2 := public.raise_my_data_subject_request('erasure', '');
  reset role;
  perform pg_temp.become(other_student);
  req3 := public.raise_my_data_subject_request('correction', '');
  reset role;
  -- The steward's own request, raised by the steward.
  perform pg_temp.become(steward);
  steward_req := public.raise_my_data_subject_request('export', '');
  reset role;

  -- ── The control: the operator can answer, so the refusals below mean something

  perform pg_temp.become(steward);
  perform public.verify_data_subject_request(req, 'V0');
  reset role;
  select count(*) into n from public.data_subject_request
   where id = req and verified_at is not null and verified_rung = 'V0';
  perform pg_temp.counted('control: the data steward records a verification, with the rung', n, 1);
  select count(*) into n from public.data_subject_request
   where id = req and verified_by is null and verification_basis is null and verification_evidence is null;
  perform pg_temp.counted('the pseudonymous verification stores no account id or evidence text', n, 1);

  select verified_by_sha256 into hash from public.data_subject_request where id = req;
  perform pg_temp.counted('who verified is a pseudonym, not the operator''s id',
    (hash ~ '^[0-9a-f]{64}$' and hash <> steward::text)::int, 1);

  select count(*) into n from public.audit_event
   where action = 'privacy.request_verified' and tenant_id = 'north-ans'
     and detail = '{"kind":"export","rung":"V0"}'::jsonb;
  perform pg_temp.counted('a verification writes one event: kind and rung only', n, 1);

  -- ── Status: the legal path ───────────────────────────────────────────────

  perform pg_temp.become(steward);
  perform public.answer_data_subject_request(req, 'verifying');
  perform public.answer_data_subject_request(req, 'in_progress');
  perform public.answer_data_subject_request(req, 'completed', 'SECRET-RESOLUTION-TEXT done');
  reset role;

  select count(*) into n from public.data_subject_request
   where id = req and status = 'completed' and resolved_at is not null
     and resolution = 'SECRET-RESOLUTION-TEXT done';
  perform pg_temp.counted('a request moves received to completed and keeps the answer on its row', n, 1);

  select count(*) into n from public.audit_event where action = 'privacy.request_status_changed';
  perform pg_temp.counted('three moves write three events', n, 3);
  select count(*) into n from public.audit_event
   where action = 'privacy.request_status_changed'
     and detail in ('{"kind":"export","from":"received","to":"verifying"}'::jsonb,
                    '{"kind":"export","from":"verifying","to":"in_progress"}'::jsonb,
                    '{"kind":"export","from":"in_progress","to":"completed"}'::jsonb);
  perform pg_temp.counted('each event names the kind and the two statuses and nothing else', n, 3);
  select count(*) into n from public.audit_event
   where detail::text ilike '%SECRET%' or object_kind ilike '%SECRET%' or action ilike '%SECRET%';
  perform pg_temp.counted('no free text, from the request or the answer, reaches an audit event', n, 0);

  -- The person sees the outcome, as before, through their own select.
  perform pg_temp.become(student);
  select count(*) into n from public.data_subject_request where id = req and status = 'completed';
  perform pg_temp.counted('the person reads the outcome of their own request', n, 1);
  reset role;

  -- A refusal needs its reason; it is then a legal end.
  perform pg_temp.become(steward);
  if not pg_temp.refused_as(format($q$select public.answer_data_subject_request(%L, 'refused', '')$q$, req2), '23514') then
    raise exception 'FAILED: a request was refused with no reason given';
  end if;
  if not pg_temp.refused_as(format($q$select public.answer_data_subject_request(%L, 'refused', '   ')$q$, req2), '23514') then
    raise exception 'FAILED: a request was refused with a blank reason';
  end if;
  perform public.answer_data_subject_request(req2, 'refused', 'Reason and how to appeal.');
  reset role;
  select count(*) into n from public.data_subject_request
   where id = req2 and status = 'refused' and resolved_at is not null and verified_at is null;
  perform pg_temp.counted('a request is refused with a reason, without needing verification', n, 1);

  -- ── Illegal moves ────────────────────────────────────────────────────────

  select count(*) into events_before from public.audit_event;
  perform pg_temp.become(steward);
  if not pg_temp.refused_as(format($q$select public.answer_data_subject_request(%L, 'in_progress')$q$, req), '23514') then
    raise exception 'FAILED: a completed request moved again';
  end if;
  if not pg_temp.refused_as(format($q$select public.answer_data_subject_request(%L, 'received')$q$, req), '23514') then
    raise exception 'FAILED: a completed request went back to received';
  end if;
  if not pg_temp.refused_as(format($q$select public.answer_data_subject_request(%L, 'completed', 'x')$q$, req2), '23514') then
    raise exception 'FAILED: a refused request was completed';
  end if;
  -- req3 is received and unverified: it may not skip ahead.
  if not pg_temp.refused_as(format($q$select public.answer_data_subject_request(%L, 'completed', 'x')$q$, req3), '23514') then
    raise exception 'FAILED: a received request was completed without being worked';
  end if;
  if not pg_temp.refused_as(format($q$select public.answer_data_subject_request(%L, 'in_progress')$q$, req3), '23514') then
    raise exception 'FAILED: a request was acted on before it was verified';
  end if;
  if not pg_temp.refused_as(format($q$select public.answer_data_subject_request(%L, 'received')$q$, req3), '23514') then
    raise exception 'FAILED: a request was moved to the state it is already in';
  end if;
  if not pg_temp.refused_as(format($q$select public.answer_data_subject_request(%L, 'archived')$q$, req3), '23514') then
    raise exception 'FAILED: a request was moved to a status that does not exist';
  end if;
  if not pg_temp.refused_as(format($q$select public.answer_data_subject_request(%L, null)$q$, req3), '23514') then
    raise exception 'FAILED: a request was moved to no status';
  end if;
  if not pg_temp.refused_as(format($q$select public.answer_data_subject_request(%L, 'refused', %L)$q$, req3, repeat('x', 1001)), '23514') then
    raise exception 'FAILED: an over-long resolution was accepted';
  end if;
  if not pg_temp.refused_as(format($q$select public.verify_data_subject_request(%L, 'V0')$q$, req), '23514') then
    raise exception 'FAILED: a resolved request was verified';
  end if;
  if not pg_temp.refused_as(format($q$select public.verify_data_subject_request(%L, 'V9')$q$, req3), '23514') then
    raise exception 'FAILED: a verification named a rung that does not exist';
  end if;
  if not pg_temp.refused_as(format($q$select public.answer_data_subject_request(%L, 'verifying')$q$, gen_random_uuid()), 'P0002') then
    raise exception 'FAILED: a request that does not exist was answered';
  end if;
  reset role;
  select count(*) into n from public.audit_event;
  perform pg_temp.counted('refused attempts leave no event', n, events_before);
  select count(*) into n from public.data_subject_request where id = req3 and status = 'received' and verified_at is null;
  perform pg_temp.counted('refused attempts change nothing', n, 1);

  -- Verifying twice is not a second verification.
  perform pg_temp.become(steward);
  -- Moving to verifying is legal while unverified; working it from there is not.
  perform public.answer_data_subject_request(req3, 'verifying');
  if not pg_temp.refused_as(format($q$select public.answer_data_subject_request(%L, 'in_progress')$q$, req3), '23514') then
    raise exception 'FAILED: a request in verifying was worked without being verified';
  end if;
  perform public.verify_data_subject_request(req3, 'V1');
  if not pg_temp.refused_as(format($q$select public.verify_data_subject_request(%L, 'V2')$q$, req3), '23514') then
    raise exception 'FAILED: a verification was overwritten';
  end if;
  -- Now verified, it may be worked, in order.
  perform public.answer_data_subject_request(req3, 'in_progress');
  reset role;
  select count(*) into n from public.data_subject_request where id = req3 and verified_rung = 'V1' and status = 'in_progress';
  perform pg_temp.counted('a verified request is worked in order, and keeps its first rung', n, 1);

  -- ── Who may not ──────────────────────────────────────────────────────────

  select count(*) into events_before from public.audit_event;

  -- The operator is not the requester, even holding the role.
  perform pg_temp.become(steward);
  if not pg_temp.refused_as(format($q$select public.answer_data_subject_request(%L, 'verifying')$q$, steward_req), '42501') then
    raise exception 'FAILED: an operator answered their own request';
  end if;
  if not pg_temp.refused_as(format($q$select public.verify_data_subject_request(%L, 'V0')$q$, steward_req), '42501') then
    raise exception 'FAILED: an operator verified their own request';
  end if;
  reset role;

  -- The subject cannot answer their own request, through the function or around it.
  perform pg_temp.become(other_student);
  if not pg_temp.refused_as(format($q$select public.answer_data_subject_request(%L, 'verifying')$q$, req3), '42501') then
    raise exception 'FAILED: a stranger answered somebody else''s request';
  end if;
  reset role;
  perform pg_temp.become(student);
  if not pg_temp.refused_as(format($q$select public.answer_data_subject_request(%L, 'verifying')$q$, req2), '42501') then
    raise exception 'FAILED: a person answered their own request through the function';
  end if;
  if not pg_temp.refused_as(format($q$select public.verify_data_subject_request(%L, 'V0')$q$, req2), '42501') then
    raise exception 'FAILED: a person verified their own request';
  end if;
  if not pg_temp.refused_as($q$update public.data_subject_request set status = 'completed', resolved_at = now()$q$, '42501') then
    raise exception 'FAILED: a person updated a request directly';
  end if;
  reset role;

  -- A school administrator holds audit:read, not data_request:handle.
  perform pg_temp.become(admin_user);
  if not pg_temp.refused_as(format($q$select public.answer_data_subject_request(%L, 'verifying')$q$, req3), '42501') then
    raise exception 'FAILED: a school administrator answered a rights request';
  end if;
  if not pg_temp.refused_as(format($q$select public.verify_data_subject_request(%L, 'V0')$q$, req3), '42501') then
    raise exception 'FAILED: a school administrator verified a rights request';
  end if;
  reset role;

  -- A visitor with no account.
  set local role anon;
  if not pg_temp.refused_as(format($q$select public.answer_data_subject_request(%L, 'verifying')$q$, req3), '42501') then
    raise exception 'FAILED: anon answered a rights request';
  end if;
  reset role;

  select count(*) into n from public.audit_event;
  perform pg_temp.counted('refusals of who leave no event', n, events_before);

  -- ── The table writes the event, so a change made some other way is recorded ─

  select count(*) into events_before from public.audit_event where action = 'privacy.request_status_changed';
  update public.data_subject_request set status = 'completed', resolved_at = now() where id = req3;
  select count(*) into n from public.audit_event where action = 'privacy.request_status_changed';
  perform pg_temp.counted('a status change made in plain SQL is audited too', n, events_before + 1);
  select count(*) into events_before from public.audit_event;
  update public.data_subject_request set resolution = 'edited note' where id = req3;
  select count(*) into n from public.audit_event;
  perform pg_temp.counted('an edit that changes no status writes no status event', n, events_before);

  -- ── Intake is untouched ──────────────────────────────────────────────────

  select count(*) into n from public.audit_event
   where action = 'privacy.request_raised' and detail in ('{"kind":"export","requested_by":"self"}'::jsonb,
                                                          '{"kind":"erasure","requested_by":"self"}'::jsonb,
                                                          '{"kind":"correction","requested_by":"self"}'::jsonb);
  perform pg_temp.counted('raising a request still writes its event (four were raised)', n, 4);
  select count(*) into n from public.data_subject_request where id = req and due_at > now() + interval '29 days';
  perform pg_temp.counted('the due date column is as raised; answering did not touch it', n, 1);
end $$;

rollback;
