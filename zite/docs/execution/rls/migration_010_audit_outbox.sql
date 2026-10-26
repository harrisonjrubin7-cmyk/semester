-- 010: append-only, hash-chained audit and a transactional outbox (remediation plan: "Audit log is
-- editable"; registrar brief §3.4 and §7). Registration now writes request, enrollment, audit and outbox
-- in one transaction.
\set ON_ERROR_STOP on
begin;
create schema platform authorization semester_owner;
revoke all on schema platform from public;
set local role semester_owner;

create table platform.audit_events (
  seq bigint generated always as identity primary key,
  tenant_id uuid not null,
  actor_user_id uuid,
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  target text not null,
  occurred_at timestamptz not null default clock_timestamp(),
  prev_hash bytea,
  hash bytea not null
);
create table platform.outbox_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  event_type text not null,
  aggregate_id uuid not null,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz
);

-- Append-only, for every role that is subject to triggers (including the table owner).
create function platform.refuse_audit_change() returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  raise exception 'AUDIT_APPEND_ONLY' using errcode = '42501';
end;
$$;
create trigger audit_no_update before update or delete on platform.audit_events
  for each row execute function platform.refuse_audit_change();
create trigger audit_no_truncate before truncate on platform.audit_events
  for each statement execute function platform.refuse_audit_change();

create function platform.audit_row_digest(p_prev bytea, p_tenant uuid, p_actor uuid, p_action text, p_target text, p_at timestamptz)
returns bytea language sql immutable set search_path = pg_catalog as $$
  select sha256(coalesce(p_prev, '\x'::bytea) || convert_to(
    concat_ws('|', p_tenant::text, coalesce(p_actor::text, '-'), p_action, p_target,
              to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')), 'UTF8'))
$$;

-- One writer at a time (transaction-scoped advisory lock), so the chain is a single line, never a fork.
create function platform.append_audit(p_tenant uuid, p_actor uuid, p_action text, p_target text)
returns bigint language plpgsql security definer set search_path = pg_catalog as $$
declare v_prev bytea; v_at timestamptz := clock_timestamp(); v_seq bigint;
begin
  perform pg_advisory_xact_lock(hashtext('platform.audit_events'));
  select hash into v_prev from platform.audit_events order by seq desc limit 1;
  insert into platform.audit_events (tenant_id, actor_user_id, action, target, occurred_at, prev_hash, hash)
    values (p_tenant, p_actor, p_action, p_target, v_at, v_prev,
            platform.audit_row_digest(v_prev, p_tenant, p_actor, p_action, p_target, v_at))
    returning seq into v_seq;
  return v_seq;
end;
$$;

-- Returns the first sequence number whose content or link does not match, or null if intact.
create function platform.verify_audit_chain() returns bigint language plpgsql set search_path = pg_catalog as $$
declare r record; v_prev bytea := null;
begin
  for r in select * from platform.audit_events order by seq loop
    if r.prev_hash is distinct from v_prev
       or r.hash <> platform.audit_row_digest(r.prev_hash, r.tenant_id, r.actor_user_id, r.action, r.target, r.occurred_at) then
      return r.seq;
    end if;
    v_prev := r.hash;
  end loop;
  return null;
end;
$$;
commit;

begin;
-- The registration command (migration 007) owns these writes; nothing else in the runtime can make them.
grant usage on schema platform to semester_cmd;
grant insert on platform.outbox_events to semester_cmd;
grant execute on function platform.append_audit(uuid, uuid, text, text) to semester_cmd;
alter function platform.append_audit(uuid, uuid, text, text) owner to semester_owner;
commit;

begin;
-- Registration command now writes audit and outbox atomically with the request.
create or replace function app.submit_registration(p_section uuid, p_key text)
returns table (request_id uuid, state text, result text)
language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_user uuid := iam.current_user_id();
  v_tenant uuid := iam.current_tenant_id();
  v_ws uuid;
  v_req app.registration_requests%rowtype;
  v_sec app.course_sections%rowtype;
  v_result text;
begin
  if v_user is null or v_tenant is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  -- Authorization is evaluated as the caller's context, not as the function owner.
  select s.workspace_id into v_ws from app.course_sections s where s.id = p_section and s.tenant_id = v_tenant;
  if v_ws is null then
    raise exception 'ACCESS_DENIED' using errcode = '42501';  -- other tenant's or unknown section: same answer
  end if;
  if not iam.has_capability(v_tenant, v_ws, 'registration.submit_own') then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  -- Retry with the same key returns the original outcome; no second operation.
  select * into v_req from app.registration_requests r
    where r.tenant_id = v_tenant and r.student_user_id = v_user and r.idempotency_key = p_key;
  if found then
    if v_req.section_id <> p_section then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;
    return query select v_req.id, v_req.state, v_req.result; return;
  end if;

  -- Serialize on the section row. Everything below sees a stable seat count.
  select * into v_sec from app.course_sections s where s.id = p_section for update;

  -- Two concurrent first-time calls with the same key: the loser waits on the lock above,
  -- then finds the winner's request here.
  select * into v_req from app.registration_requests r
    where r.tenant_id = v_tenant and r.student_user_id = v_user and r.idempotency_key = p_key;
  if found then return query select v_req.id, v_req.state, v_req.result; return; end if;

  if exists (select 1 from app.enrollment_records e where e.tenant_id = v_tenant and e.section_id = p_section
             and e.student_user_id = v_user and e.state = 'enrolled') then
    v_result := 'already_enrolled';
  elsif v_sec.state <> 'open' then
    v_result := 'section_closed';
  elsif v_sec.enrolled_count >= v_sec.capacity then
    v_result := 'capacity_unavailable';
  else
    v_result := 'enrolled';
  end if;

  insert into app.registration_requests (tenant_id, student_user_id, section_id, idempotency_key, state, result)
    values (v_tenant, v_user, p_section, p_key, case when v_result = 'enrolled' then 'committed' else 'rejected' end, v_result)
    returning * into v_req;
  if v_result = 'enrolled' then
    update app.course_sections set enrolled_count = enrolled_count + 1 where id = p_section;
    insert into app.enrollment_records (tenant_id, student_user_id, section_id, request_id)
      values (v_tenant, v_user, p_section, v_req.id);
  end if;
  -- Same transaction: if either write fails, the request and enrollment roll back with it.
  perform platform.append_audit(v_tenant, v_user, 'registration.submitted', 'request:' || v_req.id || ':' || v_result);
  if v_result = 'enrolled' then
    insert into platform.outbox_events (tenant_id, event_type, aggregate_id) values (v_tenant, 'enrollment.created', v_req.id);
  end if;
  return query select v_req.id, v_req.state, v_req.result;
end;
$$;
commit;
