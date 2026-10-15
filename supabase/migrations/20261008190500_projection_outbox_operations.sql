-- Projection outbox operations (CQRS backlog P1-03).
--
-- This migration adds the service-only state transitions around the existing
-- outbox and receipt tables. It does not add a worker, scheduler, producer,
-- projection or read model. Claim and settle calls remain private and are
-- executable only by the service role. A dead-letter replay is the one human
-- operation: it requires console:operate, fresh MFA and a two-person approval
-- whose target names this exact event and whose detail names its consumer.

-- Existing databases already applied the original console seed. Repeat only
-- the new policy row here; the original seed is also extended so a database
-- built from scratch and the TypeScript policy register remain row-for-row.
insert into public.console_duty (id, action, requester, approvers, two_person, evidence)
values (
  'projection-replay',
  'Replay one dead-lettered domain event',
  'engineering',
  array['data', 'security'],
  true,
  'The failed event, the repaired cause, the consumer and projector version, the replay scope, and the rollback plan'
)
on conflict (id) do update
  set action = excluded.action,
      requester = excluded.requester,
      approvers = excluded.approvers,
      two_person = excluded.two_person,
      evidence = excluded.evidence;

-- Refuse an approval whose human-readable target and machine-readable detail
-- do not bind the same existing dead letter and consumer. Approvers should
-- never be asked to approve an ambiguous replay request.
create or replace function private.check_projection_replay_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_id uuid;
begin
  if new.duty_id <> 'projection-replay' then
    return new;
  end if;
  if new.target is null or new.target !~ '^domain-event:[0-9a-f-]{36}$'
     or coalesce(new.detail ->> 'event_id', '') !~ '^[0-9a-f-]{36}$'
     or new.target is distinct from 'domain-event:' || (new.detail ->> 'event_id')
     or coalesce(new.detail ->> 'consumer', '') !~ '^[a-z][a-z0-9_.:-]{2,99}$'
     or coalesce(length(trim(new.detail ->> 'projector_version')), 0) = 0
     or coalesce(length(trim(new.detail ->> 'rollback_plan')), 0) = 0 then
    raise exception 'A projection replay must bind one event, consumer, projector version and rollback plan.'
      using errcode = '22023';
  end if;
  event_id := (new.detail ->> 'event_id')::uuid;
  if not exists (
    select 1 from private.domain_outbox_events e
     where e.id = event_id
       and e.dead_lettered_at is not null
       and e.tenant_id is not distinct from new.tenant_id
  ) then
    raise exception 'The projection replay target is not a dead letter in this tenant.'
      using errcode = '23514';
  end if;
  return new;
end
$$;

revoke all on function private.check_projection_replay_request() from public, anon, authenticated;
drop trigger if exists projection_replay_request_boundary on public.approval_request;
create trigger projection_replay_request_boundary
  before insert on public.approval_request
  for each row execute function private.check_projection_replay_request();

-- Claim at most 100 due events. One UUID identifies the batch while every row
-- still carries its own claim pair. A five-minute lease lets a later worker
-- recover rows after a process dies. A terminal receipt for this consumer is
-- excluded even if an operator repaired an inconsistent published_at value.
create or replace function private.claim_domain_events(
  want_consumer text,
  want_limit integer default 50
)
returns setof private.domain_outbox_events
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  batch uuid := gen_random_uuid();
begin
  if want_consumer is null or want_consumer !~ '^[a-z][a-z0-9_.:-]{2,99}$' then
    raise exception 'A consumer is a stable lower-case identifier.' using errcode = '22023';
  end if;
  if want_limit is null or want_limit < 1 or want_limit > 100 then
    raise exception 'A claim limit is between 1 and 100.' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select e.id
      from private.domain_outbox_events e
     where e.published_at is null
       and e.dead_lettered_at is null
       and coalesce(e.next_attempt_at, e.occurred_at) <= now()
       and (e.claim_id is null or e.claimed_at < now() - interval '5 minutes')
       and not exists (
         select 1 from private.domain_event_receipts r
          where r.consumer = want_consumer and r.event_id = e.id
            and r.outcome in ('processed', 'skipped')
       )
     order by coalesce(e.next_attempt_at, e.occurred_at), e.occurred_at, e.id
     for update skip locked
     limit want_limit
  ), claimed as (
    update private.domain_outbox_events e
       set claim_id = batch,
           claimed_at = now()
      from candidates c
     where e.id = c.id
     returning e.*
  )
  select c.* from claimed c order by coalesce(c.next_attempt_at, c.occurred_at), c.occurred_at, c.id;
end
$$;

-- Completing a claim and writing its receipt are one transaction. Repeating a
-- successful call returns false and changes nothing; a replay may turn the
-- same receipt from failed to processed without creating a second receipt.
create or replace function private.complete_domain_event(
  want_consumer text,
  want_event uuid,
  want_claim uuid,
  want_outcome text default 'processed'
)
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if want_consumer is null or want_consumer !~ '^[a-z][a-z0-9_.:-]{2,99}$' then
    raise exception 'A consumer is a stable lower-case identifier.' using errcode = '22023';
  end if;
  if want_outcome not in ('processed', 'skipped') then
    raise exception 'A completed event is processed or skipped.' using errcode = '22023';
  end if;

  if exists (
    select 1 from private.domain_event_receipts r
     where r.consumer = want_consumer and r.event_id = want_event
       and r.outcome in ('processed', 'skipped')
  ) then
    return false;
  end if;

  update private.domain_outbox_events e
     set published_at = now(),
         claim_id = null,
         claimed_at = null,
         next_attempt_at = null,
         last_error = null
   where e.id = want_event
     and e.claim_id = want_claim
     and e.published_at is null
     and e.dead_lettered_at is null;
  if not found then
    raise exception 'The event is not held by this claim.' using errcode = '40001';
  end if;

  insert into private.domain_event_receipts (consumer, event_id, outcome, last_error, processed_at)
  values (want_consumer, want_event, want_outcome, null, now())
  on conflict (consumer, event_id) do update
    set outcome = excluded.outcome,
        last_error = null,
        processed_at = excluded.processed_at;
  return true;
end
$$;

-- A failure releases the lease. Retryable failures use deterministic jitter
-- below a fifteen-minute cap; attempt eight and non-retryable failures park
-- the event and write one failed receipt. The worker receives the resulting
-- state without needing to infer it from a timestamp.
create or replace function private.fail_domain_event(
  want_consumer text,
  want_event uuid,
  want_claim uuid,
  want_error text,
  want_retryable boolean default true
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  attempts integer;
  terminal boolean;
  retry_at timestamptz;
  clean_error text := left(nullif(trim(want_error), ''), 500);
begin
  if want_consumer is null or want_consumer !~ '^[a-z][a-z0-9_.:-]{2,99}$' then
    raise exception 'A consumer is a stable lower-case identifier.' using errcode = '22023';
  end if;
  if clean_error is null then
    raise exception 'A failure needs a sanitized error.' using errcode = '22023';
  end if;

  select e.publish_attempts + 1 into attempts
    from private.domain_outbox_events e
   where e.id = want_event
     and e.claim_id = want_claim
     and e.published_at is null
     and e.dead_lettered_at is null
   for update;
  if not found then
    raise exception 'The event is not held by this claim.' using errcode = '40001';
  end if;

  terminal := not coalesce(want_retryable, true) or attempts >= 8;
  if not terminal then
    retry_at := now()
      + least(interval '15 minutes', power(2::numeric, attempts)::double precision * interval '1 second')
      + (('x' || substr(md5(want_event::text || ':' || attempts::text), 1, 8))::bit(32)::bigint % 1000)
        * interval '1 millisecond';
  end if;

  update private.domain_outbox_events
     set publish_attempts = attempts,
         last_error = clean_error,
         dead_lettered_at = case when terminal then now() else null end,
         next_attempt_at = case when terminal then null else retry_at end,
         claim_id = null,
         claimed_at = null
   where id = want_event;

  if terminal then
    insert into private.domain_event_receipts (consumer, event_id, outcome, last_error, processed_at)
    values (want_consumer, want_event, 'failed', clean_error, now())
    on conflict (consumer, event_id) do update
      set outcome = 'failed', last_error = excluded.last_error, processed_at = excluded.processed_at;
  end if;

  return jsonb_build_object(
    'event', want_event,
    'attempts', attempts,
    'state', case when terminal then 'dead_letter' else 'retry' end,
    'nextAttemptAt', retry_at
  );
end
$$;

-- One approved replay resets one event for one consumer. The approval target
-- and detail are part of the authorization decision, not advisory metadata.
-- The audit append happens before the reset and is not caught: if audit is
-- unavailable, the replay does not happen.
create or replace function public.replay_domain_event(
  want_event uuid,
  want_consumer text,
  want_approval uuid,
  want_correlation text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  req public.approval_request%rowtype;
  event_row private.domain_outbox_events%rowtype;
  seq bigint;
begin
  if me is null or not private.has_capability('console:operate') then
    raise exception 'console:operate is required.' using errcode = '42501';
  end if;
  perform private.assert_fresh_mfa();
  if want_consumer is null or want_consumer !~ '^[a-z][a-z0-9_.:-]{2,99}$' then
    raise exception 'A consumer is a stable lower-case identifier.' using errcode = '22023';
  end if;

  select * into req from public.approval_request r where r.id = want_approval for update;
  if not found or req.duty_id <> 'projection-replay' then
    raise exception 'An approved projection-replay request is required.' using errcode = '42501';
  end if;
  if req.target is distinct from 'domain-event:' || want_event::text
     or req.detail ->> 'event_id' is distinct from want_event::text
     or req.detail ->> 'consumer' is distinct from want_consumer then
    raise exception 'The approval does not bind this event and consumer.' using errcode = '42501';
  end if;
  if req.status = 'executed' then
    return jsonb_build_object('event', want_event, 'consumer', want_consumer, 'replayed', false,
                              'approval', req.id, 'status', 'already_executed');
  end if;
  if req.status <> 'approved' or req.expires_at <= now() then
    raise exception 'The projection replay request is not approved and current.' using errcode = '42501';
  end if;
  if req.requester <> me and not exists (
    select 1 from public.approval_decision d
     where d.request_id = req.id and d.approver = me and d.decision = 'approve'
  ) then
    raise exception 'Only the requester or an approver may execute this replay.' using errcode = '42501';
  end if;

  select * into event_row from private.domain_outbox_events e where e.id = want_event for update;
  if not found or event_row.dead_lettered_at is null then
    raise exception 'The approved event is not dead-lettered.' using errcode = '23514';
  end if;

  seq := private.console_audit_write(
    me,
    'authenticated',
    event_row.tenant_id,
    'projection.replayed',
    want_event::text,
    jsonb_build_object('approval', req.id, 'consumer', want_consumer,
                       'attempts', event_row.publish_attempts, 'ticket', req.ticket),
    coalesce(want_correlation, req.correlation_id)
  );

  update private.domain_outbox_events
     set published_at = null,
         publish_attempts = 0,
         last_error = null,
         dead_lettered_at = null,
         claim_id = null,
         claimed_at = null,
         next_attempt_at = now()
   where id = want_event;

  update public.approval_request
     set status = 'executed', executed_at = now()
   where id = req.id;

  return jsonb_build_object('event', want_event, 'consumer', want_consumer, 'replayed', true,
                            'approval', req.id, 'status', 'pending', 'auditSeq', seq);
end
$$;

revoke all on function private.claim_domain_events(text, integer) from public, anon, authenticated;
revoke all on function private.complete_domain_event(text, uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.fail_domain_event(text, uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function private.claim_domain_events(text, integer) to service_role;
grant execute on function private.complete_domain_event(text, uuid, uuid, text) to service_role;
grant execute on function private.fail_domain_event(text, uuid, uuid, text, boolean) to service_role;

revoke all on function public.replay_domain_event(uuid, text, uuid, text) from public, anon;
grant execute on function public.replay_domain_event(uuid, text, uuid, text) to authenticated;

comment on function private.claim_domain_events(text, integer) is
  'P1-03 service-only due-event claim with a five-minute recoverable lease and a 100-row bound.';
comment on function private.complete_domain_event(text, uuid, uuid, text) is
  'P1-03 service-only atomic settle and idempotent per-consumer receipt.';
comment on function private.fail_domain_event(text, uuid, uuid, text, boolean) is
  'P1-03 service-only bounded retry and terminal dead-letter transition.';
comment on function public.replay_domain_event(uuid, text, uuid, text) is
  'P1-03 approval-bound, capability-checked and fail-closed-audited replay of one dead-lettered event.';
