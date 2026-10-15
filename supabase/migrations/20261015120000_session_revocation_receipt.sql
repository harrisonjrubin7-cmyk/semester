-- One idempotent self-service command for ending a remote auth session.
--
-- The command is deliberately narrower than account-wide sign-out: it accepts
-- one session id, derives the account from auth.uid(), refuses the caller's
-- current session, and makes a missing target indistinguishable from another
-- account's target. A request-key receipt makes an unknown client outcome safe
-- to retry without a second audit fact or event.
--
-- Successful source changes emit one minimized event in the same transaction.
-- Its first consumer is included here so the event is not orphaned, but the
-- service-only runner is dormant: this migration adds no scheduler, secret,
-- deployment, public read model, replay, or automatic recovery path.

create table if not exists private.session_revocation_command_receipt (
  account_sha256 text not null check (account_sha256 ~ '^[0-9a-f]{64}$'),
  target_sha256 text not null check (target_sha256 ~ '^[0-9a-f]{64}$'),
  request_key uuid not null,
  outcome text not null check (outcome in ('revoked', 'already_ended', 'refused')),
  event_id uuid,
  occurred_at timestamptz not null default now(),
  primary key (account_sha256, request_key),
  constraint session_revocation_receipt_event_shape
    check ((outcome = 'revoked') = (event_id is not null))
);

alter table private.session_revocation_command_receipt enable row level security;
revoke all on table private.session_revocation_command_receipt from public, anon, authenticated;
grant select, insert, update, delete on table private.session_revocation_command_receipt to service_role;

create table if not exists private.account_session_security_projection (
  account_sha256 text not null check (account_sha256 ~ '^[0-9a-f]{64}$'),
  target_sha256 text not null check (target_sha256 ~ '^[0-9a-f]{64}$'),
  source_event_id uuid not null unique,
  outcome text not null check (outcome = 'revoked'),
  source_occurred_at timestamptz not null,
  projected_at timestamptz not null default now(),
  primary key (account_sha256, target_sha256)
);

alter table private.account_session_security_projection enable row level security;
revoke all on table private.account_session_security_projection from public, anon, authenticated;
grant select, insert, update, delete on table private.account_session_security_projection to service_role;

create or replace function public.revoke_my_session(
  want uuid,
  request_key uuid
)
returns table (outcome text, occurred_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  here uuid;
  account_hash text;
  target_hash text;
  correlation text;
  affected bigint := 0;
  made_event uuid;
  receipt_row private.session_revocation_command_receipt%rowtype;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  if want is null or request_key is null then
    raise exception 'A session and request key are required.' using errcode = '22023';
  end if;

  account_hash := private.role_audit_sha256(me::text);
  target_hash := private.role_audit_sha256(want::text);
  correlation := 'session-revoke:' || request_key::text;

  -- Serialize retries of this account/request pair before reading its receipt.
  -- A different key remains independent, including for the same target.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(account_hash || ':' || request_key::text, 0)
  );

  select r.* into receipt_row
    from private.session_revocation_command_receipt r
   where r.account_sha256 = account_hash
     and r.request_key = revoke_my_session.request_key;
  if found then
    if receipt_row.target_sha256 <> target_hash then
      raise exception 'A request key cannot be reused for a different session.' using errcode = '23505';
    end if;
    return query select receipt_row.outcome, receipt_row.occurred_at;
    return;
  end if;

  begin
    here := nullif((select auth.jwt()) ->> 'session_id', '')::uuid;
  exception when invalid_text_representation then
    here := null;
  end;
  if here is null or want = here then
    perform private.record_audit(
      null, 'session.revoke', 'auth_session', want::text, 'denied', correlation,
      jsonb_build_object('outcome', 'refused')
    );
    insert into private.session_revocation_command_receipt
      (account_sha256, target_sha256, request_key, outcome)
    values (account_hash, target_hash, request_key, 'refused')
    returning * into receipt_row;
    return query select receipt_row.outcome, receipt_row.occurred_at;
    return;
  end if;

  if to_regclass('auth.sessions') is not null then
    execute 'delete from auth.sessions where id = $1 and user_id = $2'
      using want, me;
    get diagnostics affected = row_count;
  end if;

  if affected = 0 then
    perform private.record_audit(
      null, 'session.revoke', 'auth_session', want::text, 'allowed', correlation,
      jsonb_build_object('outcome', 'already_ended')
    );
    insert into private.session_revocation_command_receipt
      (account_sha256, target_sha256, request_key, outcome)
    values (account_hash, target_hash, request_key, 'already_ended')
    returning * into receipt_row;
  else
    perform private.record_audit(
      null, 'session.revoke', 'auth_session', want::text, 'allowed', correlation,
      jsonb_build_object('outcome', 'revoked')
    );
    made_event := private.emit_domain_event(
      'auth_session', target_hash, 'identity.session_revoked', 1,
      null, 'account_sessions', correlation, correlation,
      jsonb_build_object(
        'accountRef', account_hash,
        'outcome', 'revoked',
        'changedFields', jsonb_build_array('refresh_session')
      ),
      'internal', 'audit'
    );
    insert into private.session_revocation_command_receipt
      (account_sha256, target_sha256, request_key, outcome, event_id)
    values (account_hash, target_hash, request_key, 'revoked', made_event)
    returning * into receipt_row;
  end if;

  return query select receipt_row.outcome, receipt_row.occurred_at;
end
$$;

revoke all on function public.revoke_my_session(uuid, uuid) from public, anon, authenticated;
grant execute on function public.revoke_my_session(uuid, uuid) to authenticated;

create or replace function private.claim_session_revocation_events(
  want_limit integer default 25
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
  if want_limit is null or want_limit < 1 or want_limit > 25 then
    raise exception 'A projector batch limit is between 1 and 25.' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select e.id
      from private.domain_outbox_events e
     where e.event_type = 'identity.session_revoked'
       and e.event_version = 1
       and e.published_at is null
       and e.dead_lettered_at is null
       and coalesce(e.next_attempt_at, e.occurred_at) <= now()
       and (e.claim_id is null or e.claimed_at < now() - interval '5 minutes')
       and not exists (
         select 1 from private.domain_event_receipts r
          where r.consumer = 'account-security.session-revocations.v1'
            and r.event_id = e.id
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
  select c.* from claimed c
   order by coalesce(c.next_attempt_at, c.occurred_at), c.occurred_at, c.id;
end
$$;

create or replace function private.apply_session_revocation_event(
  want_event uuid,
  want_claim uuid
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  consumer_name constant text := 'account-security.session-revocations.v1';
  event_row private.domain_outbox_events%rowtype;
begin
  if exists (
    select 1 from private.domain_event_receipts r
     where r.consumer = consumer_name and r.event_id = want_event
       and r.outcome in ('processed', 'skipped')
  ) then
    return jsonb_build_object('event', want_event, 'applied', false, 'outcome', 'already_settled');
  end if;

  select e.* into event_row
    from private.domain_outbox_events e
   where e.id = want_event
     and e.claim_id = want_claim
     and e.published_at is null
     and e.dead_lettered_at is null
   for update;
  if not found then
    if exists (
      select 1 from private.domain_event_receipts r
       where r.consumer = consumer_name and r.event_id = want_event
         and r.outcome in ('processed', 'skipped')
    ) then
      return jsonb_build_object('event', want_event, 'applied', false, 'outcome', 'already_settled');
    end if;
    raise exception 'The session-revocation event is not held by this claim.' using errcode = '40001';
  end if;

  if event_row.aggregate_type <> 'auth_session'
     or event_row.aggregate_id !~ '^[0-9a-f]{64}$'
     or event_row.event_type <> 'identity.session_revoked'
     or event_row.event_version <> 1
     or event_row.tenant_id is not null
     or event_row.producer <> 'account_sessions'
     or event_row.data_classification <> 'internal'
     or event_row.retention_class <> 'audit'
     or coalesce(event_row.payload ->> 'accountRef', '') !~ '^[0-9a-f]{64}$'
     or event_row.payload ->> 'outcome' is distinct from 'revoked'
     or event_row.payload -> 'changedFields' is distinct from jsonb_build_array('refresh_session')
     or exists (
       select 1 from jsonb_object_keys(event_row.payload) as key(name)
        where key.name not in ('accountRef', 'outcome', 'changedFields')
     ) then
    raise exception 'The event does not match identity.session_revoked version 1.' using errcode = '22023';
  end if;

  -- Shape is necessary but not authority. Only the event made and retained by
  -- the caller-bound command may change this projection; another producer
  -- cannot forge a plausible accountRef/target pair into account security.
  if not exists (
    select 1
      from private.session_revocation_command_receipt r
     where r.event_id = event_row.id
       and r.account_sha256 = event_row.payload ->> 'accountRef'
       and r.target_sha256 = event_row.aggregate_id
       and r.outcome = 'revoked'
  ) then
    raise exception 'The event is not bound to its session-revocation receipt.' using errcode = '22023';
  end if;

  insert into private.account_session_security_projection (
    account_sha256, target_sha256, source_event_id, outcome,
    source_occurred_at, projected_at
  ) values (
    event_row.payload ->> 'accountRef', event_row.aggregate_id, event_row.id,
    'revoked', event_row.occurred_at, now()
  )
  on conflict (account_sha256, target_sha256) do update
    set source_event_id = excluded.source_event_id,
        outcome = excluded.outcome,
        source_occurred_at = excluded.source_occurred_at,
        projected_at = excluded.projected_at
    where (excluded.source_occurred_at, excluded.source_event_id)
        > (account_session_security_projection.source_occurred_at,
           account_session_security_projection.source_event_id);

  perform private.complete_domain_event(
    consumer_name, event_row.id, want_claim, 'processed'
  );

  return jsonb_build_object(
    'event', event_row.id, 'applied', true, 'outcome', 'processed'
  );
end
$$;

create or replace function public.run_account_security_projector(
  want_limit integer default 25
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  consumer_name constant text := 'account-security.session-revocations.v1';
  event_row private.domain_outbox_events%rowtype;
  applied jsonb;
  failed jsonb;
  failure_state text;
  claimed_count integer := 0;
  processed_count integer := 0;
  skipped_count integer := 0;
  retrying_count integer := 0;
  dead_lettered_count integer := 0;
begin
  if want_limit is null or want_limit < 1 or want_limit > 25 then
    raise exception 'A projector batch limit is between 1 and 25.' using errcode = '22023';
  end if;

  for event_row in
    select * from private.claim_session_revocation_events(want_limit)
  loop
    claimed_count := claimed_count + 1;
    begin
      applied := private.apply_session_revocation_event(event_row.id, event_row.claim_id);
      if applied ->> 'outcome' = 'processed' then
        processed_count := processed_count + 1;
      elsif applied ->> 'outcome' in ('skipped', 'already_settled') then
        skipped_count := skipped_count + 1;
      else
        raise exception 'The session-revocation projector returned an unsupported outcome.' using errcode = '22023';
      end if;
    exception when others then
      get stacked diagnostics failure_state = returned_sqlstate;
      failed := private.fail_domain_event(
        consumer_name,
        event_row.id,
        event_row.claim_id,
        case when failure_state in ('22023', '23514')
          then 'invalid identity.session_revoked version 1 event'
          else 'account security projector transaction failed'
        end,
        failure_state not in ('22023', '23514')
      );
      if failed ->> 'state' = 'dead_letter' then
        dead_lettered_count := dead_lettered_count + 1;
      else
        retrying_count := retrying_count + 1;
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'claimed', claimed_count,
    'processed', processed_count,
    'skipped', skipped_count,
    'retrying', retrying_count,
    'deadLettered', dead_lettered_count
  );
end
$$;

revoke all on function private.claim_session_revocation_events(integer)
  from public, anon, authenticated;
revoke all on function private.apply_session_revocation_event(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.run_account_security_projector(integer)
  from public, anon, authenticated;
grant execute on function private.claim_session_revocation_events(integer) to service_role;
grant execute on function private.apply_session_revocation_event(uuid, uuid) to service_role;
grant execute on function public.run_account_security_projector(integer) to service_role;

comment on table private.session_revocation_command_receipt is
  'Pseudonymous idempotency receipts for one caller-owned remote auth-session revoke; client roles cannot read them.';
comment on table private.account_session_security_projection is
  'Private pseudonymous projection of settled identity.session_revoked v1 events.';
comment on function public.revoke_my_session(uuid, uuid) is
  'Ends one caller-owned remote auth session with a stable request receipt; missing and cross-account targets are indistinguishable.';
comment on function public.run_account_security_projector(integer) is
  'Runs one bounded service-only identity.session_revoked batch; it does not schedule or activate the worker.';
