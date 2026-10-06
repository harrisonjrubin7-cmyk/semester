-- The payment-rail registry and the verified-event inbox
-- (docs/finance/NATIVE_FINANCIAL_PLATFORM.md section 14, actions 6 and 7; D-1319).
--
-- Two new tables and one trigger function. **Nothing reads or writes them yet**: no
-- Edge Function, no policy, no scheduler job. They are the place the next steps
-- (parking an invoice event that arrives before its subscription, a dead-letter,
-- a replay) will stand, and they are proved here, alone, before anything depends
-- on them. Nothing existing changes: no column, constraint, grant or function of
-- the commercial tables is touched.
--
-- Both are service-only, the same posture as `site_leads` and `payment_events`:
-- row level security on, no policy, and every privilege revoked from `public`,
-- `anon` and `authenticated` (`client-privileges.check.sql` fails until the
-- migration that creates a table says so). `service_role` bypasses RLS and is
-- held server-side.
--
-- ## payment_rails
--
-- A rail is a provider in one mode (`stripe` live, `stripe` test, ...), with the
-- capabilities Semester has *wired* for it. **It holds no credential, ever.**
-- Rail credentials are Edge Function secrets; the only free-form column is
-- `capabilities`, and a check limits its keys to the names the adapter interface
-- defines, so a secret cannot be stored there under any other name.
--
-- ## provider_event_inbox
--
-- One row per provider event whose signature, age and environment have been
-- verified, by `adapter.verifyWebhook` (supabase/functions/_shared/payments), and
-- therefore never a row for a forged or stale request. It keeps a hash and a
-- **minimized projection** (ids, amounts, currency, statuses, timestamps), never
-- the payload: `payment_events` keeps only a hash today, so a failed event cannot
-- be replayed; the projection plus the provider's own object, fetched by id, is
-- what replay will use. No name, email, address or card number is stored, and the
-- projection is refused if it holds a run of 13 to 19 digits (the pattern the
-- school ledger applies to every typed field).
--
-- Identity columns never change after insert. `status` moves along a short list
-- of allowed steps, `attempts` only goes up, and `applied` is final: that row is never touched again. Rows are
-- never deleted: how long a verified-event record is kept is a retention decision
-- nobody has made (D-132 sets seven years for the financial records themselves),
-- so the safe default is to keep it and say so.
--
-- Rollback: a forward migration that drops both tables and the function. Nothing
-- depends on them.

-- ── payment_rails ───────────────────────────────────────────────────────

create table if not exists public.payment_rails (
  id            text primary key check (id ~ '^[a-z][a-z0-9_-]{1,40}$'),
  -- The same identifier check payment_events.provider and checkout_sessions.provider carry.
  provider      text not null check (provider ~ '^[a-z][a-z0-9_]{1,29}$'),
  mode          text not null check (mode in ('live', 'test')),
  status        text not null default 'draft' check (status in ('draft', 'enabled', 'paused', 'retired')),
  kinds         text[] not null default '{}'
                check (kinds <@ array['card', 'ach', 'bank_transfer', 'wire', 'wallet', 'invoice_terms', 'campus_card', 'financial_aid']),
  -- Lowercase ISO 4217, as every currency column in the commercial tables.
  currencies    text[] not null default array['usd']
                check (cardinality(currencies) > 0 and array_to_string(currencies, ',') ~ '^[a-z]{3}(,[a-z]{3})*$'),
  -- What Semester has wired for this rail, not what the provider can do. Keys are
  -- the adapter interface's capability names and nothing else: no credential can
  -- be stored under another name.
  capabilities  jsonb not null default '{}'
                check (jsonb_typeof(capabilities) = 'object'
                       and (capabilities - array['hostedCollection', 'authorize', 'capture', 'refund', 'partialRefund',
                                                 'recurring', 'offSessionCharge', 'installments', 'tax', 'disputes',
                                                 'disputeEvidenceApi', 'settlementReport', 'webhookSigning']) = '{}'::jsonb),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.payment_rails enable row level security;
revoke all on public.payment_rails from public, anon, authenticated;

-- ── provider_event_inbox ────────────────────────────────────────────────

create table if not exists public.provider_event_inbox (
  id                 uuid primary key default gen_random_uuid(),
  provider           text not null check (provider ~ '^[a-z][a-z0-9_]{1,29}$'),
  -- The provider's own event id: the idempotency key, once per provider.
  provider_event_id  text not null check (length(provider_event_id) between 1 and 200),
  event_type         text not null check (length(event_type) between 1 and 200),
  occurred_at        timestamptz not null,
  received_at        timestamptz not null default now(),
  -- A row exists only for an event that was verified; this says when.
  verified_at        timestamptz not null default now(),
  livemode           boolean not null,
  payload_sha256     text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  -- Ids, amounts, currency, statuses, timestamps. Bounded, an object, no card number.
  projection         jsonb not null default '{}'
                     check (jsonb_typeof(projection) = 'object'
                            and pg_column_size(projection) <= 8192
                            and projection::text !~ '[0-9]([ -]?[0-9]){12,18}'),
  status             text not null default 'received'
                     check (status in ('received', 'applied', 'parked', 'failed', 'dead_letter')),
  attempts           integer not null default 0 check (attempts >= 0),
  -- A parked event is retried after this; null otherwise.
  next_attempt_at    timestamptz,
  -- A code, never a message: nothing a request or a response said can be stored here.
  last_error_code    text check (last_error_code is null or last_error_code ~ '^[a-z][a-z_]{0,39}$'),
  applied_at         timestamptz,
  constraint provider_event_inbox_once unique (provider, provider_event_id),
  constraint provider_event_inbox_applied_has_time check ((status = 'applied') = (applied_at is not null)),
  constraint provider_event_inbox_parked_has_retry check (status <> 'parked' or next_attempt_at is not null)
);

create index if not exists provider_event_inbox_work on public.provider_event_inbox (status, next_attempt_at)
  where status in ('received', 'parked', 'failed');

alter table public.provider_event_inbox enable row level security;
revoke all on public.provider_event_inbox from public, anon, authenticated;

-- ── What a row may become ───────────────────────────────────────────────

create or replace function private.provider_event_inbox_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'provider_event_inbox is not deleted from: how long a verified-event record is kept is a retention decision not yet made.';
  end if;

  -- Once applied, a row is finished: nothing about it changes.
  if old.status = 'applied' then
    raise exception 'An applied provider event is final.';
  end if;

  -- A verified event stays exactly what it was verified as.
  if new.provider is distinct from old.provider
     or new.provider_event_id is distinct from old.provider_event_id
     or new.event_type is distinct from old.event_type
     or new.occurred_at is distinct from old.occurred_at
     or new.received_at is distinct from old.received_at
     or new.verified_at is distinct from old.verified_at
     or new.livemode is distinct from old.livemode
     or new.payload_sha256 is distinct from old.payload_sha256
     or new.projection is distinct from old.projection then
    raise exception 'A verified provider event cannot be rewritten.';
  end if;

  if new.attempts < old.attempts then
    raise exception 'Attempts only go up.';
  end if;

  -- received → applied | parked | failed        parked → applied | parked | dead_letter
  -- failed   → applied | failed | dead_letter    dead_letter → received (a replay)
  -- applied is terminal.
  if new.status <> old.status or old.status in ('parked', 'failed') then
    if not (
         (old.status = 'received'    and new.status in ('applied', 'parked', 'failed'))
      or (old.status = 'parked'      and new.status in ('applied', 'parked', 'dead_letter'))
      or (old.status = 'failed'      and new.status in ('applied', 'failed', 'dead_letter'))
      or (old.status = 'dead_letter' and new.status = 'received')
    ) then
      raise exception 'A provider event cannot move from % to %.', old.status, new.status;
    end if;
  end if;

  return new;
end $$;
revoke all on function private.provider_event_inbox_guard() from public, anon, authenticated;

drop trigger if exists provider_event_inbox_guard on public.provider_event_inbox;
create trigger provider_event_inbox_guard before update or delete on public.provider_event_inbox
  for each row execute function private.provider_event_inbox_guard();

comment on table public.payment_rails is
  'A payment provider in one mode, with the capabilities Semester has wired for it. Holds no credential: those are Edge Function secrets. Service-only; nothing reads it yet (docs/finance/PAYMENT_PROVIDER_ADAPTER_ARCHITECTURE.md).';
comment on table public.provider_event_inbox is
  'One row per signature-verified provider event: its id, a hash and a minimized projection (no payload, no personal data, no card number), and where it is in being applied. Service-only; nothing reads or writes it yet (D-1319).';
