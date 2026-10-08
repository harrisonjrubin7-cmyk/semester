-- The access saga's durable store (packages/institution/src/access-saga.ts, `Store`).
--
-- Three tables and five functions. **Nothing calls them**: no Edge Function, no
-- route, no scheduler job, and the saga runner has no adapter yet. They are here,
-- proved alone, so the adapter that comes next has something real to stand on.
-- Nothing existing changes.
--
-- All three tables are service-only, as `provider_event_inbox` is: row level
-- security on, no policy, every privilege revoked from `public`, `anon` and
-- `authenticated`. The functions are `security definer`, execute for
-- `service_role` only.
--
-- What the Store contract asks for, and where it is held here:
--
--   claim          an exclusive lease with a random fencing token and an expiry
--   save           ONE transaction that checks the lease and the revision, writes
--                  the saga, and appends the audit/outbox event; a stale lease or a
--                  moved revision raises SQLSTATE SC409 and writes nothing
--   flagRecovery   records a recovery code; never marks cleanup complete
--   release        clears the lease if the token still matches
--   wake           authenticated by being service-only; deduplicated by
--                  (saga, event id) inside the same transaction as its effect
--
-- The edge list below is a second copy of ACCESS_SAGA's. `access-saga-store.test.ts`
-- fails when the two disagree, so neither can be edited alone.
--
-- Rollback: a forward migration that drops the functions and the three tables.
-- Nothing depends on them.

-- ── The saga ────────────────────────────────────────────────────────────

create table if not exists public.access_sagas (
  id                     text primary key check (length(id) between 1 and 200),
  tenant_id              text not null check (length(tenant_id) between 1 and 200),
  subject_id             text not null check (length(subject_id) between 1 and 200),
  intent_resource_id     text not null check (length(intent_resource_id) between 1 and 200),
  intent_action          text not null
                         check (intent_action in ('registration.readiness.view', 'registration.override.request', 'registration.override.approve')),
  request_digest         text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  definition_version     text not null check (length(definition_version) between 1 and 40),
  state                  text not null default 'RECEIVED'
                         check (state in ('RECEIVED', 'VALIDATING', 'EVALUATING', 'WAITING_STEP_UP', 'WAITING_APPROVAL', 'PREPARING',
                                          'INSTALLING', 'VERIFYING', 'RECONCILING', 'ACTIVE', 'DENIED', 'EXPIRED', 'REVOKING',
                                          'RECOVERY_REQUIRED', 'REVOKED')),
  -- Every saved move is revision + 1: the compare-and-swap token.
  revision               integer not null default 0 check (revision >= 0),
  generation             integer not null default 0 check (generation >= 0),
  attempts               integer not null default 0 check (attempts >= 0),
  -- Epoch milliseconds, as the runner's clock counts them.
  deadline_at            bigint not null,
  next_attempt_at        bigint not null,
  decision_id            text,
  grant_id               text,
  grant_expires_at       bigint,
  stale_grant_possible   boolean not null default false,
  pa_revoked             boolean not null default false,
  pep_removed            boolean not null default false,
  -- A code, never a message: nothing a participant said can be stored here.
  last_error             text check (last_error is null or last_error ~ '^[A-Za-z][A-Za-z0-9_:. -]{0,119}$'),
  recovery_code          text check (recovery_code is null or recovery_code ~ '^[a-z][a-z_]{0,39}$'),
  lease_token            text,
  lease_expires_at       timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint access_sagas_lease_pair check ((lease_token is null) = (lease_expires_at is null)),
  constraint access_sagas_revoked_is_clean check (state <> 'REVOKED' or (pa_revoked and pep_removed))
);

create index if not exists access_sagas_work on public.access_sagas (next_attempt_at)
  where state not in ('DENIED', 'EXPIRED', 'REVOKED');

alter table public.access_sagas enable row level security;
revoke all on public.access_sagas from public, anon, authenticated;

-- ── The audit trail and the outbox, one table ───────────────────────────

create table if not exists public.access_saga_events (
  event_id      text primary key check (length(event_id) between 1 and 200),
  saga_id       text not null references public.access_sagas (id),
  tenant_id     text not null,
  revision      integer not null,
  type          text not null check (type = 'access.state.changed'),
  occurred_at   timestamptz not null,
  reason_code   text check (reason_code is null or reason_code ~ '^[A-Za-z][A-Za-z0-9_:. -]{0,119}$'),
  -- A relay marks this when it has published the event; nothing else changes.
  published_at  timestamptz,
  constraint access_saga_events_one_per_revision unique (saga_id, revision)
);

create index if not exists access_saga_events_unpublished on public.access_saga_events (occurred_at) where published_at is null;

alter table public.access_saga_events enable row level security;
revoke all on public.access_saga_events from public, anon, authenticated;

-- ── Signals already seen ────────────────────────────────────────────────

create table if not exists public.access_saga_signals (
  saga_id      text not null references public.access_sagas (id),
  event_id     text not null check (length(event_id) between 1 and 200),
  kind         text not null check (kind in ('requirements_changed', 'revoke', 'recover')),
  received_at  timestamptz not null default now(),
  primary key (saga_id, event_id)
);

alter table public.access_saga_signals enable row level security;
revoke all on public.access_saga_signals from public, anon, authenticated;

-- ── What a saga row may become ──────────────────────────────────────────

create or replace function private.access_saga_edge_ok(p_from text, p_to text)
returns boolean language sql immutable set search_path = '' as $$
  select p_from = p_to or (p_from, p_to) in (values
    ('RECEIVED', 'VALIDATING'), ('RECEIVED', 'EXPIRED'),
    ('VALIDATING', 'EVALUATING'), ('VALIDATING', 'DENIED'), ('VALIDATING', 'EXPIRED'), ('VALIDATING', 'REVOKING'),
    ('EVALUATING', 'WAITING_STEP_UP'), ('EVALUATING', 'WAITING_APPROVAL'), ('EVALUATING', 'PREPARING'),
    ('EVALUATING', 'DENIED'), ('EVALUATING', 'EXPIRED'), ('EVALUATING', 'REVOKING'),
    ('WAITING_STEP_UP', 'VALIDATING'), ('WAITING_STEP_UP', 'EXPIRED'), ('WAITING_STEP_UP', 'REVOKING'),
    ('WAITING_APPROVAL', 'VALIDATING'), ('WAITING_APPROVAL', 'EXPIRED'), ('WAITING_APPROVAL', 'REVOKING'),
    ('PREPARING', 'INSTALLING'), ('PREPARING', 'DENIED'), ('PREPARING', 'EXPIRED'), ('PREPARING', 'REVOKING'),
    ('INSTALLING', 'VERIFYING'), ('INSTALLING', 'RECONCILING'), ('INSTALLING', 'REVOKING'),
    ('VERIFYING', 'ACTIVE'), ('VERIFYING', 'RECONCILING'), ('VERIFYING', 'REVOKING'),
    ('RECONCILING', 'VERIFYING'), ('RECONCILING', 'EVALUATING'), ('RECONCILING', 'REVOKING'),
    ('ACTIVE', 'REVOKING'),
    ('REVOKING', 'REVOKED'), ('REVOKING', 'RECOVERY_REQUIRED'),
    ('RECOVERY_REQUIRED', 'REVOKING')
  );
$$;

create or replace function private.access_sagas_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'access_sagas is not deleted from: how long an access record is kept is a retention decision not yet made.';
  end if;

  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.subject_id is distinct from old.subject_id
     or new.intent_resource_id is distinct from old.intent_resource_id
     or new.intent_action is distinct from old.intent_action
     or new.request_digest is distinct from old.request_digest
     or new.definition_version is distinct from old.definition_version
     or new.created_at is distinct from old.created_at then
    raise exception 'An access saga keeps the identity it was created with.';
  end if;

  -- A lease, a recovery flag and a bookkeeping touch change no revision.
  if new.revision = old.revision then
    if new.state is distinct from old.state or new.generation is distinct from old.generation
       or new.attempts is distinct from old.attempts or new.deadline_at is distinct from old.deadline_at
       or new.next_attempt_at is distinct from old.next_attempt_at or new.decision_id is distinct from old.decision_id
       or new.grant_id is distinct from old.grant_id or new.grant_expires_at is distinct from old.grant_expires_at
       or new.stale_grant_possible is distinct from old.stale_grant_possible
       or new.pa_revoked is distinct from old.pa_revoked or new.pep_removed is distinct from old.pep_removed
       or new.last_error is distinct from old.last_error then
      raise exception 'An access saga changes only by a saved revision.';
    end if;
    return new;
  end if;

  if new.revision <> old.revision + 1 then
    raise exception 'An access saga moves one revision at a time.';
  end if;
  if old.state in ('DENIED', 'EXPIRED', 'REVOKED') then
    raise exception 'A finished access saga is final.';
  end if;
  if not private.access_saga_edge_ok(old.state, new.state) then
    raise exception 'An access saga cannot move from % to %.', old.state, new.state;
  end if;
  -- A new evaluation (after reconciliation) or a resumed validation (after a wait) is a new generation.
  if (old.state = 'RECONCILING' and new.state = 'EVALUATING')
     or (old.state in ('WAITING_STEP_UP', 'WAITING_APPROVAL') and new.state = 'VALIDATING') then
    if new.generation <> old.generation + 1 then raise exception 'A new evaluation starts a new generation.'; end if;
  elsif new.generation <> old.generation then
    raise exception 'Generation changes only when a new evaluation starts.';
  end if;
  if new.state = 'REVOKED' and not (new.pa_revoked and new.pep_removed) then
    raise exception 'REVOKED needs both sides of the cleanup confirmed.';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists access_sagas_guard on public.access_sagas;
create trigger access_sagas_guard before update or delete on public.access_sagas
  for each row execute function private.access_sagas_guard();

create or replace function private.access_saga_events_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'access_saga_events is append-only.'; end if;
  if new.event_id is distinct from old.event_id or new.saga_id is distinct from old.saga_id
     or new.tenant_id is distinct from old.tenant_id or new.revision is distinct from old.revision
     or new.type is distinct from old.type or new.occurred_at is distinct from old.occurred_at
     or new.reason_code is distinct from old.reason_code or old.published_at is not null then
    raise exception 'An access saga event is append-only; only its publication is recorded.';
  end if;
  return new;
end $$;

drop trigger if exists access_saga_events_guard on public.access_saga_events;
create trigger access_saga_events_guard before update or delete on public.access_saga_events
  for each row execute function private.access_saga_events_guard();

-- ── The Store ───────────────────────────────────────────────────────────

-- Takes the lease, or returns null: finished, or held and not yet expired.
create or replace function public.access_saga_claim(p_id text, p_lease_ms integer)
returns table (lease_token text, saga jsonb)
language plpgsql security definer set search_path = '' as $$
declare
  r public.access_sagas;
  tok text := gen_random_uuid()::text;
begin
  if p_lease_ms is null or p_lease_ms < 1 or p_lease_ms > 600000 then
    raise exception 'A lease is between 1 ms and 10 minutes.';
  end if;
  update public.access_sagas s
     set lease_token = tok, lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_ms / 1000.0)
   where s.id = p_id
     and s.state not in ('DENIED', 'EXPIRED', 'REVOKED')
     and (s.lease_token is null or s.lease_expires_at <= clock_timestamp())
  returning s.* into r;
  if not found then return; end if;
  return query select tok, to_jsonb(r) - 'lease_token' - 'lease_expires_at';
end $$;

-- One transaction: the lease, the revision, the saga and its event, or nothing.
create or replace function public.access_saga_save(p_id text, p_lease_token text, p_expected_revision integer, p_next jsonb, p_event jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  cur public.access_sagas;
begin
  select * into cur from public.access_sagas where id = p_id for update;
  if not found then raise exception 'No such access saga.' using errcode = 'SC404'; end if;
  if cur.lease_token is distinct from p_lease_token or cur.lease_expires_at is null or cur.lease_expires_at <= clock_timestamp() then
    raise exception 'The lease is not held.' using errcode = 'SC409';
  end if;
  if cur.revision <> p_expected_revision then
    raise exception 'The saga moved: expected revision %, found %.', p_expected_revision, cur.revision using errcode = 'SC409';
  end if;

  update public.access_sagas set
    state = p_next->>'state',
    revision = p_expected_revision + 1,
    generation = (p_next->>'generation')::integer,
    attempts = (p_next->>'attempts')::integer,
    deadline_at = (p_next->>'deadlineAt')::bigint,
    next_attempt_at = (p_next->>'nextAttemptAt')::bigint,
    decision_id = p_next->>'decisionId',
    grant_id = p_next->>'grantId',
    grant_expires_at = (p_next->>'grantExpiresAt')::bigint,
    stale_grant_possible = coalesce((p_next->>'staleGrantPossible')::boolean, false),
    pa_revoked = coalesce((p_next->'compensation'->>'paRevoked')::boolean, false),
    pep_removed = coalesce((p_next->'compensation'->>'pepRemoved')::boolean, false),
    last_error = p_next->>'lastError'
  where id = p_id;

  insert into public.access_saga_events (event_id, saga_id, tenant_id, revision, type, occurred_at, reason_code)
  values (p_event->>'eventId', p_id, cur.tenant_id, p_expected_revision + 1, p_event->>'type',
          (p_event->>'occurredAt')::timestamptz, p_event->>'reasonCode');
end $$;

create or replace function public.access_saga_flag_recovery(p_id text, p_lease_token text, p_code text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.access_sagas set recovery_code = p_code
   where id = p_id and lease_token = p_lease_token and lease_expires_at > clock_timestamp();
  if not found then raise exception 'The lease is not held.' using errcode = 'SC409'; end if;
end $$;

create or replace function public.access_saga_release(p_id text, p_lease_token text)
returns void language sql security definer set search_path = '' as $$
  update public.access_sagas set lease_token = null, lease_expires_at = null where id = p_id and lease_token = p_lease_token;
$$;

-- A signal, once. It carries no claim that anyone is approved or authenticated:
-- it only lets a waiting saga look again, or starts a revocation. A seen event id,
-- or a saga it does not apply to, changes nothing. It bumps the revision, so a
-- runner holding a lease on the old one meets SC409 and stands down.
create or replace function public.access_saga_wake(p_id text, p_event_id text, p_kind text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  cur public.access_sagas;
  to_state text;
  seen int;
begin
  select * into cur from public.access_sagas where id = p_id for update;
  if not found then raise exception 'No such access saga.' using errcode = 'SC404'; end if;
  insert into public.access_saga_signals (saga_id, event_id, kind) values (p_id, p_event_id, p_kind) on conflict do nothing;
  get diagnostics seen = row_count;
  if seen = 0 then return; end if;

  to_state := case
    when p_kind = 'requirements_changed' and cur.state in ('WAITING_STEP_UP', 'WAITING_APPROVAL') then 'VALIDATING'
    when p_kind = 'revoke' and cur.state not in ('RECEIVED', 'DENIED', 'EXPIRED', 'REVOKING', 'RECOVERY_REQUIRED', 'REVOKED') then 'REVOKING'
    when p_kind = 'recover' and cur.state = 'RECOVERY_REQUIRED' then 'REVOKING'
  end;
  if to_state is null then return; end if;

  update public.access_sagas set
    state = to_state,
    revision = cur.revision + 1,
    generation = case when to_state = 'VALIDATING' then cur.generation + 1 else cur.generation end,
    attempts = 0,
    next_attempt_at = (extract(epoch from clock_timestamp()) * 1000)::bigint
  where id = p_id;
  insert into public.access_saga_events (event_id, saga_id, tenant_id, revision, type, occurred_at, reason_code)
  values ('wake:' || p_id || ':' || p_event_id, p_id, cur.tenant_id, cur.revision + 1, 'access.state.changed', clock_timestamp(), 'signal_' || p_kind);
end $$;

revoke all on function public.access_saga_claim(text, integer) from public, anon, authenticated;
revoke all on function public.access_saga_save(text, text, integer, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.access_saga_flag_recovery(text, text, text) from public, anon, authenticated;
revoke all on function public.access_saga_release(text, text) from public, anon, authenticated;
revoke all on function public.access_saga_wake(text, text, text) from public, anon, authenticated;
revoke all on function private.access_saga_edge_ok(text, text) from public, anon, authenticated;
grant execute on function public.access_saga_claim(text, integer) to service_role;
grant execute on function public.access_saga_save(text, text, integer, jsonb, jsonb) to service_role;
grant execute on function public.access_saga_flag_recovery(text, text, text) to service_role;
grant execute on function public.access_saga_release(text, text) to service_role;
grant execute on function public.access_saga_wake(text, text, text) to service_role;
