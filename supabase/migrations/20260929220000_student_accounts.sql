-- Student accounts (D-146): a school's financial record of what each student
-- owes and has paid, kept under the controls the brief of 29 September asks
-- for — an immutable account ledger, refunds, adjustments and reversals,
-- scholarships, discounts, waivers and sponsorships, financial holds,
-- reconciliation with the payment provider, role separation, approval
-- thresholds, an audit trail and a monthly close.
--
--   1. Nobody writes the ledger. Every charge, payment, refund, adjustment,
--      reversal, aid credit and chargeback is a request in
--      `student_account_requests`; when someone *other than its requester*
--      approves it, `private.student_account_request_guard` writes one signed
--      entry to `student_account_entries`.
--   2. Above the school's threshold (`student_account_settings`, $1,000 by
--      default) a refund, adjustment, reversal or aid credit needs an
--      approver holding `finance:approve_high`.
--   3. Whoever requested or approved a payment does not approve its refund,
--      reversal or chargeback. A refund or chargeback never returns more than
--      is left of the payment; an entry is reversed once, in full.
--   4. A month closes only when a reconciliation of it with the payment
--      provider has passed, nothing in it is still waiting, and the closer is
--      not the person who recorded that reconciliation. A closed month takes
--      nothing new: a correction goes in an open month.
--   5. The ledger's side of a reconciliation is computed by the database from
--      the ledger. Only the provider's side — read from its settlement file
--      in the browser — is the recorder's claim.
--   6. No money moves here and no card is stored. Payments are made through
--      the school's hosted payment provider and recorded by its reference;
--      a run of 13 to 19 digits is refused in every field a person types.
--
-- Two functions are security definer — the trigger that writes the ledger and
-- the one that stamps a reconciliation with the ledger's totals — and both
-- are in `private`, revoked from every client role, so nothing can call them.
-- The grants allowlist and the definer register are unchanged.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

-- ── 1. Capabilities ───────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('finance:request',      'Request a charge, payment, refund, adjustment, reversal, aid credit or chargeback on one school''s student accounts. Never approves it.'),
  ('finance:approve',      'Approve or reject a request on one school''s student accounts, never one they made, and never the refund of a payment they put on the ledger.'),
  ('finance:approve_high', 'Approve a refund, adjustment, reversal or aid credit at or above the school''s high-value threshold.'),
  ('finance:close',        'Record a reconciliation with the payment provider, close a month, and set the school''s thresholds.'),
  ('finance:read',         'Read one school''s student accounts and the requests made against them.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('student_accounts_officer', 'finance:request'),
  ('student_accounts_officer', 'finance:approve'),
  ('student_accounts_officer', 'finance:read'),
  ('financial_aid_officer',    'finance:request'),
  ('financial_aid_officer',    'finance:read'),
  ('business_admin',           'finance:approve'),
  ('business_admin',           'finance:approve_high'),
  ('business_admin',           'finance:close'),
  ('business_admin',           'finance:read')
on conflict (role, capability) do nothing;

-- ── 2. The tables ─────────────────────────────────────────────────────────

create table if not exists public.student_account_settings (
  tenant_id           text        primary key references public.schools(id) on delete cascade,
  high_value_cents    bigint      not null default 100000 check (high_value_cents > 0),
  hold_after_days     smallint    not null default 30 check (hold_after_days >= 1 and hold_after_days <= 365),
  hold_minimum_cents  bigint      not null default 10000 check (hold_minimum_cents >= 0),
  updated_by          uuid        default auth.uid() references auth.users(id) on delete set null,
  updated_at          timestamptz not null default now()
);
create index if not exists student_account_settings_by_updater on public.student_account_settings (updated_by);

create table if not exists public.student_account_requests (
  id                  uuid        primary key default gen_random_uuid(),
  tenant_id           text        not null references public.schools(id) on delete cascade,
  student_ref         text        not null check (student_ref ~ '^[A-Za-z0-9._-]{1,64}$'),
  kind                text        not null check (kind in (
                        'charge', 'payment', 'refund', 'adjustment_debit', 'adjustment_credit', 'aid_credit', 'reversal', 'chargeback')),
  category            text        not null check (category in (
                        'tuition', 'fees', 'housing', 'dining', 'books', 'other',
                        'scholarship', 'waiver', 'discount', 'sponsorship')),
  amount_cents        bigint      not null check (amount_cents > 0),
  description         text        not null check (length(trim(description)) >= 3 and length(description) <= 200),
  reference_entry_id  uuid,
  provider_ref        text        not null default '' check (length(provider_ref) <= 120),
  effective_on        date        not null,
  status              text        not null default 'proposed' check (status in ('proposed', 'approved', 'rejected', 'withdrawn')),
  requested_by        uuid        default auth.uid() references auth.users(id) on delete set null,
  requested_at        timestamptz not null default clock_timestamp(),
  decided_by          uuid        references auth.users(id) on delete set null,
  decided_at          timestamptz,
  decision_note       text        not null default '' check (length(decision_note) <= 2000),
  entry_id            uuid,
  -- No card number, anywhere a person types.
  constraint student_account_request_no_pan check (
    description !~ '[0-9]([ -]?[0-9]){12,18}' and provider_ref !~ '[0-9]([ -]?[0-9]){12,18}' and decision_note !~ '[0-9]([ -]?[0-9]){12,18}'),
  constraint student_account_request_provider check (
    (kind in ('payment', 'refund', 'chargeback')) = (length(trim(provider_ref)) > 0)),
  constraint student_account_request_reference check (
    (kind in ('refund', 'reversal', 'chargeback')) = (reference_entry_id is not null)),
  constraint student_account_request_aid check (
    kind = 'reversal' or (kind = 'aid_credit') = (category in ('scholarship', 'waiver', 'discount', 'sponsorship'))),
  constraint student_account_request_decided check ((status = 'proposed') = (decided_at is null)),
  constraint student_account_request_entry check ((status = 'approved') = (entry_id is not null))
);
create index if not exists student_account_requests_by_student on public.student_account_requests (tenant_id, student_ref, status);
create index if not exists student_account_requests_by_period on public.student_account_requests (tenant_id, status, effective_on);
create index if not exists student_account_requests_by_requester on public.student_account_requests (requested_by);
create index if not exists student_account_requests_by_decider on public.student_account_requests (decided_by);

create table if not exists public.student_account_entries (
  id                  uuid        primary key default gen_random_uuid(),
  tenant_id           text        not null references public.schools(id) on delete cascade,
  student_ref         text        not null,
  kind                text        not null,
  category            text        not null,
  -- Signed: positive adds to what the student owes.
  amount_cents        bigint      not null check (amount_cents <> 0),
  description         text        not null,
  reference_entry_id  uuid        references public.student_account_entries(id),
  provider_ref        text        not null,
  effective_on        date        not null,
  period              text        not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  request_id          uuid        not null unique references public.student_account_requests(id),
  requested_by        uuid        references auth.users(id) on delete set null,
  approved_by         uuid        references auth.users(id) on delete set null,
  high_value          boolean     not null,
  recorded_at         timestamptz not null default clock_timestamp()
);
create index if not exists student_account_entries_by_student on public.student_account_entries (tenant_id, student_ref, effective_on);
create index if not exists student_account_entries_by_period on public.student_account_entries (tenant_id, period, kind);
create index if not exists student_account_entries_by_reference on public.student_account_entries (reference_entry_id);
-- An entry is reversed once, whatever two approvers do at the same moment.
create unique index if not exists student_account_entries_one_reversal on public.student_account_entries (reference_entry_id)
  where kind = 'reversal';
create index if not exists student_account_entries_by_requester on public.student_account_entries (requested_by);
create index if not exists student_account_entries_by_approver on public.student_account_entries (approved_by);

alter table public.student_account_requests drop constraint if exists student_account_requests_reference_fk;
alter table public.student_account_requests
  add constraint student_account_requests_reference_fk foreign key (reference_entry_id) references public.student_account_entries(id);
alter table public.student_account_requests drop constraint if exists student_account_requests_entry_fk;
alter table public.student_account_requests
  add constraint student_account_requests_entry_fk foreign key (entry_id) references public.student_account_entries(id);
create index if not exists student_account_requests_by_reference on public.student_account_requests (reference_entry_id);
create index if not exists student_account_requests_by_entry on public.student_account_requests (entry_id);

create table if not exists public.student_account_reconciliations (
  id                    uuid        primary key default gen_random_uuid(),
  tenant_id             text        not null references public.schools(id) on delete cascade,
  period                text        not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  -- The recorder's claim, read from the provider's settlement file.
  provider_total_cents  bigint      not null,
  matched               integer     not null check (matched >= 0),
  missing               integer     not null check (missing >= 0),
  extra                 integer     not null check (extra >= 0),
  differing             integer     not null check (differing >= 0),
  settlement_sha256     text        not null check (settlement_sha256 ~ '^[0-9a-f]{64}$'),
  -- The database's own reading of the ledger, set by the trigger.
  ledger_total_cents    bigint      not null default 0,
  ledger_count          integer     not null default 0,
  passed                boolean     generated always as (
                          missing = 0 and extra = 0 and differing = 0 and provider_total_cents = ledger_total_cents) stored,
  recorded_by           uuid        default auth.uid() references auth.users(id) on delete set null,
  recorded_at           timestamptz not null default clock_timestamp()
);
create index if not exists student_account_reconciliations_by_period on public.student_account_reconciliations (tenant_id, period, recorded_at desc);
create index if not exists student_account_reconciliations_by_recorder on public.student_account_reconciliations (recorded_by);

create table if not exists public.student_account_closes (
  tenant_id          text        not null references public.schools(id) on delete cascade,
  period             text        not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  reconciliation_id  uuid        not null references public.student_account_reconciliations(id),
  closed_by          uuid        default auth.uid() references auth.users(id) on delete set null,
  closed_at          timestamptz not null default clock_timestamp(),
  note               text        not null default '' check (length(note) <= 2000 and note !~ '[0-9]([ -]?[0-9]){12,18}'),
  primary key (tenant_id, period)
);
create index if not exists student_account_closes_by_reconciliation on public.student_account_closes (reconciliation_id);
create index if not exists student_account_closes_by_closer on public.student_account_closes (closed_by);

-- ── 3. The rules ──────────────────────────────────────────────────────────

create or replace function private.student_account_period(d date)
returns text language sql immutable set search_path = '' as $$
  select to_char(d, 'YYYY-MM');
$$;
revoke all on function private.student_account_period(date) from public, anon, authenticated;

-- Requested as the caller, decided by someone else, and on approval written
-- to the ledger. Definer rights only so it can write the ledger, which no
-- client can; every rule about *who* is checked here, against the caller.
create or replace function private.student_account_request_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  ref public.student_account_entries;
  threshold bigint;
  high boolean;
  returned bigint;
  amount bigint;
  written uuid;
begin
  if tg_op = 'INSERT' then
    if caller is not null and not private.has_capability('finance:request', 'school', new.tenant_id) then
      raise exception 'Your account cannot make requests on this school''s student accounts.' using errcode = '42501';
    end if;
    new.status := 'proposed';
    new.requested_by := caller;
    new.requested_at := clock_timestamp();
    new.decided_by := null;
    new.decided_at := null;
    new.decision_note := '';
    new.entry_id := null;
    return new;
  end if;

  -- Account deletion clearing a person reference is not a change to the account.
  if (to_jsonb(new) - array['requested_by', 'decided_by']) = (to_jsonb(old) - array['requested_by', 'decided_by'])
     and (new.requested_by is null or new.requested_by = old.requested_by)
     and (new.decided_by is null or new.decided_by = old.decided_by) then
    return new;
  end if;

  if old.status <> 'proposed' then
    raise exception 'A decided request is part of the record and does not change; make a new one.' using errcode = '42501';
  end if;
  if (to_jsonb(new) - array['status', 'decided_by', 'decided_at', 'decision_note', 'entry_id'])
     <> (to_jsonb(old) - array['status', 'decided_by', 'decided_at', 'decision_note', 'entry_id']) then
    raise exception 'A request is not edited; withdraw it and make another.' using errcode = '42501';
  end if;

  if new.status = 'withdrawn' then
    if old.requested_by is distinct from caller then
      raise exception 'Only the person who made a request withdraws it.' using errcode = '42501';
    end if;
  elsif new.status in ('approved', 'rejected') then
    if not private.has_capability('finance:approve', 'school', old.tenant_id) then
      raise exception 'Your account cannot decide requests on this school''s student accounts.' using errcode = '42501';
    end if;
    if old.requested_by = caller then
      raise exception 'The person who made a request does not decide it.' using errcode = '42501';
    end if;
  else
    raise exception 'A request is approved, rejected or withdrawn.' using errcode = '23514';
  end if;

  new.decided_by := caller;
  new.decided_at := clock_timestamp();
  new.entry_id := null;
  if new.status <> 'approved' then
    return new;
  end if;

  -- One approval or close at a time per school and month, so a close cannot
  -- slip between an approval's check and its entry.
  perform pg_advisory_xact_lock(hashtextextended('student_account_period:' || old.tenant_id || ':' || private.student_account_period(old.effective_on), 0));
  if exists (select 1 from public.student_account_closes c
              where c.tenant_id = old.tenant_id and c.period = private.student_account_period(old.effective_on)) then
    raise exception '% is closed; record it in an open month.', private.student_account_period(old.effective_on) using errcode = '23514';
  end if;

  if old.reference_entry_id is not null then
    -- One answer to an entry at a time: two refunds approved together must not
    -- both read the same amount left, nor two reversals both find none. Read
    -- committed, so what is read after the lock includes the other's entry.
    perform pg_advisory_xact_lock(hashtextextended('student_account_entry:' || old.reference_entry_id::text, 0));
    select * into ref from public.student_account_entries e where e.id = old.reference_entry_id;
    if ref.id is null or ref.tenant_id <> old.tenant_id or ref.student_ref <> old.student_ref then
      raise exception 'The entry this answers is not on this student''s account.' using errcode = '23514';
    end if;
    if caller in (ref.requested_by, ref.approved_by) then
      raise exception 'Whoever put that entry on the ledger does not approve what answers it.' using errcode = '42501';
    end if;
    if old.kind in ('refund', 'chargeback') then
      if ref.kind <> 'payment' then
        raise exception 'A refund or chargeback answers a payment.' using errcode = '23514';
      end if;
      select coalesce(sum(e.amount_cents), 0) into returned from public.student_account_entries e
       where e.reference_entry_id = ref.id and e.kind in ('refund', 'chargeback');
      if old.amount_cents > -ref.amount_cents - returned then
        raise exception 'At most % cents of that payment is left to return.', -ref.amount_cents - returned using errcode = '23514';
      end if;
    elsif old.kind = 'reversal' then
      if ref.kind = 'reversal' then
        raise exception 'A reversal is not itself reversed; record a new entry.' using errcode = '23514';
      end if;
      if exists (select 1 from public.student_account_entries e where e.kind = 'reversal' and e.reference_entry_id = ref.id) then
        raise exception 'That entry has already been reversed.' using errcode = '23514';
      end if;
      if old.amount_cents <> abs(ref.amount_cents) then
        raise exception 'A reversal is for the whole entry, % cents.', abs(ref.amount_cents) using errcode = '23514';
      end if;
    end if;
  end if;

  select s.high_value_cents into threshold from public.student_account_settings s where s.tenant_id = old.tenant_id;
  high := old.kind in ('refund', 'adjustment_debit', 'adjustment_credit', 'aid_credit', 'reversal')
          and old.amount_cents >= coalesce(threshold, 100000);
  if high and not private.has_capability('finance:approve_high', 'school', old.tenant_id) then
    raise exception 'A % of this size needs a high-value approver.', replace(old.kind, '_', ' ') using errcode = '42501';
  end if;

  amount := case old.kind
    when 'charge' then old.amount_cents
    when 'payment' then -old.amount_cents
    when 'refund' then old.amount_cents
    when 'adjustment_debit' then old.amount_cents
    when 'adjustment_credit' then -old.amount_cents
    when 'aid_credit' then -old.amount_cents
    when 'chargeback' then old.amount_cents
    when 'reversal' then -ref.amount_cents
  end;

  insert into public.student_account_entries
    (tenant_id, student_ref, kind, category, amount_cents, description, reference_entry_id, provider_ref,
     effective_on, period, request_id, requested_by, approved_by, high_value)
  values
    (old.tenant_id, old.student_ref, old.kind, old.category, amount, old.description, old.reference_entry_id, old.provider_ref,
     old.effective_on, private.student_account_period(old.effective_on), old.id, old.requested_by, caller, high)
  returning id into written;
  new.entry_id := written;
  return new;
end $$;
revoke all on function private.student_account_request_guard() from public, anon, authenticated;
drop trigger if exists student_account_request_guard on public.student_account_requests;
create trigger student_account_request_guard before insert or update on public.student_account_requests
  for each row execute function private.student_account_request_guard();

-- The ledger's side of a reconciliation, read by the database: what moved
-- through the provider in that month, a payment positive.
create or replace function private.student_account_reconciliation_stamp()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not private.has_capability('finance:close', 'school', new.tenant_id) then
    raise exception 'Your account cannot reconcile this school''s student accounts.' using errcode = '42501';
  end if;
  select coalesce(-sum(e.amount_cents), 0), count(*) into new.ledger_total_cents, new.ledger_count
    from public.student_account_entries e
   where e.tenant_id = new.tenant_id and e.period = new.period and e.kind in ('payment', 'refund', 'chargeback');
  new.recorded_by := auth.uid();
  new.recorded_at := clock_timestamp();
  return new;
end $$;
revoke all on function private.student_account_reconciliation_stamp() from public, anon, authenticated;
drop trigger if exists student_account_reconciliation_stamp on public.student_account_reconciliations;
create trigger student_account_reconciliation_stamp before insert on public.student_account_reconciliations
  for each row execute function private.student_account_reconciliation_stamp();

-- A month closes on a passing reconciliation of it, recorded by someone else,
-- with nothing in it still waiting. Invoker rights: a closer reads all three.
create or replace function private.student_account_close_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  latest public.student_account_reconciliations;
begin
  perform pg_advisory_xact_lock(hashtextextended('student_account_period:' || new.tenant_id || ':' || new.period, 0));
  select * into latest from public.student_account_reconciliations r
   where r.tenant_id = new.tenant_id and r.period = new.period
   order by r.recorded_at desc, r.id desc limit 1;
  if latest.id is null or not latest.passed then
    raise exception '% has no passing reconciliation with the payment provider.', new.period using errcode = '23514';
  end if;
  if latest.recorded_by = auth.uid() then
    raise exception 'The person who reconciled a month does not close it.' using errcode = '42501';
  end if;
  -- The reconciliation must have seen every provider entry in the month: one
  -- approved after it leaves the month unreconciled.
  if exists (select 1 from public.student_account_entries e
              where e.tenant_id = new.tenant_id and e.period = new.period
                and e.kind in ('payment', 'refund', 'chargeback')
                and e.recorded_at > latest.recorded_at) then
    raise exception '% has provider entries recorded since its last reconciliation; reconcile it again.', new.period using errcode = '23514';
  end if;
  if exists (select 1 from public.student_account_requests q
              where q.tenant_id = new.tenant_id and q.status = 'proposed'
                and private.student_account_period(q.effective_on) = new.period) then
    raise exception '% still has requests waiting for a decision.', new.period using errcode = '23514';
  end if;
  new.reconciliation_id := latest.id;
  new.closed_by := auth.uid();
  new.closed_at := clock_timestamp();
  return new;
end $$;
revoke all on function private.student_account_close_guard() from public, anon, authenticated;
grant execute on function private.student_account_period(date) to authenticated;
drop trigger if exists student_account_close_guard on public.student_account_closes;
create trigger student_account_close_guard before insert on public.student_account_closes
  for each row execute function private.student_account_close_guard();

-- Entries, reconciliations and closes are the record: append-only for every
-- role, except the clearing of a person reference by account deletion and
-- the removal of a school.
create or replace function private.student_account_append_only()
returns trigger language plpgsql set search_path = '' as $$
declare
  people text[] := tg_argv::text[];
begin
  -- Only the clearing of a person reference: every other column the same,
  -- and each person column either unchanged or now empty. (`passed` is left
  -- out: a stored generated column is not yet computed in a BEFORE trigger.)
  if tg_op = 'UPDATE' and (to_jsonb(new) - people - 'passed') = (to_jsonb(old) - people - 'passed')
     and not exists (select 1 from unnest(people) c
                      where (to_jsonb(new) ->> c) is not null and (to_jsonb(new) ->> c) is distinct from (to_jsonb(old) ->> c)) then
    return new;
  end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.schools s where s.id = old.tenant_id) then
    return old;
  end if;
  raise exception '% is append-only; a correction is a new entry in an open month.', tg_table_name using errcode = '42501';
end $$;
revoke all on function private.student_account_append_only() from public, anon, authenticated;
drop trigger if exists student_account_entries_append_only on public.student_account_entries;
create trigger student_account_entries_append_only before update or delete on public.student_account_entries
  for each row execute function private.student_account_append_only('requested_by', 'approved_by');
drop trigger if exists student_account_reconciliations_append_only on public.student_account_reconciliations;
create trigger student_account_reconciliations_append_only before update or delete on public.student_account_reconciliations
  for each row execute function private.student_account_append_only('recorded_by');
drop trigger if exists student_account_closes_append_only on public.student_account_closes;
create trigger student_account_closes_append_only before update or delete on public.student_account_closes
  for each row execute function private.student_account_append_only('closed_by');

create or replace function private.student_account_settings_stamp()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.tenant_id is distinct from old.tenant_id then
    raise exception 'Settings stay with their school.' using errcode = '42501';
  end if;
  if auth.uid() is not null then
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end $$;
revoke all on function private.student_account_settings_stamp() from public, anon, authenticated;
drop trigger if exists student_account_settings_stamp on public.student_account_settings;
create trigger student_account_settings_stamp before insert or update on public.student_account_settings
  for each row execute function private.student_account_settings_stamp();

-- ── 4. Row-level security ─────────────────────────────────────────────────

alter table public.student_account_settings        enable row level security;
alter table public.student_account_requests        enable row level security;
alter table public.student_account_entries         enable row level security;
alter table public.student_account_reconciliations enable row level security;
alter table public.student_account_closes          enable row level security;

revoke all on table public.student_account_settings, public.student_account_requests, public.student_account_entries,
                    public.student_account_reconciliations, public.student_account_closes
  from anon, authenticated;
grant select, insert, update on table public.student_account_settings to authenticated;
grant select, insert, update on table public.student_account_requests to authenticated;
grant select on table public.student_account_entries to authenticated;
grant select, insert on table public.student_account_reconciliations to authenticated;
grant select, insert on table public.student_account_closes to authenticated;

-- Everyone who works a school's accounts reads its settings, reconciliations and
-- closes. A student linked to the school reads its settings too: the hold rule
-- they are held to is theirs to see, and the settings name no student.
drop policy if exists "finance staff read settings" on public.student_account_settings;
drop policy if exists "finance staff and linked students read settings" on public.student_account_settings;
create policy "finance staff and linked students read settings" on public.student_account_settings
  for select to authenticated
  using (private.has_capability('finance:read', 'school', tenant_id)
         or private.has_capability('finance:approve', 'school', tenant_id)
         or private.has_capability('finance:close', 'school', tenant_id)
         or exists (select 1 from public.academic_record_subjects s
                     where s.tenant_id = student_account_settings.tenant_id
                       and s.user_id = (select auth.uid())));
drop policy if exists "finance closers set the thresholds" on public.student_account_settings;
create policy "finance closers set the thresholds" on public.student_account_settings
  for insert to authenticated
  with check (private.has_capability('finance:close', 'school', tenant_id));
drop policy if exists "finance closers change the thresholds" on public.student_account_settings;
create policy "finance closers change the thresholds" on public.student_account_settings
  for update to authenticated
  using (private.has_capability('finance:close', 'school', tenant_id))
  with check (private.has_capability('finance:close', 'school', tenant_id));

drop policy if exists "finance staff and the requester read requests" on public.student_account_requests;
create policy "finance staff and the requester read requests" on public.student_account_requests
  for select to authenticated
  using (requested_by = (select auth.uid())
         or private.has_capability('finance:read', 'school', tenant_id)
         or private.has_capability('finance:approve', 'school', tenant_id));
drop policy if exists "finance requesters request" on public.student_account_requests;
create policy "finance requesters request" on public.student_account_requests
  for insert to authenticated
  with check (private.has_capability('finance:request', 'school', tenant_id));
drop policy if exists "finance approvers decide and requesters withdraw" on public.student_account_requests;
create policy "finance approvers decide and requesters withdraw" on public.student_account_requests
  for update to authenticated
  using (requested_by = (select auth.uid()) or private.has_capability('finance:approve', 'school', tenant_id))
  with check (requested_by = (select auth.uid()) or private.has_capability('finance:approve', 'school', tenant_id));

-- A student reads their own account through the link an approver made on the
-- academic record (academic_record_subjects): one link from the school's
-- identifier to the account, for both records.
drop policy if exists "finance staff and the student read the ledger" on public.student_account_entries;
create policy "finance staff and the student read the ledger" on public.student_account_entries
  for select to authenticated
  using (private.has_capability('finance:read', 'school', tenant_id)
         or private.has_capability('finance:approve', 'school', tenant_id)
         or private.has_capability('finance:close', 'school', tenant_id)
         or exists (select 1 from public.academic_record_subjects s
                     where s.tenant_id = student_account_entries.tenant_id
                       and s.student_ref = student_account_entries.student_ref
                       and s.user_id = (select auth.uid())));

drop policy if exists "finance staff read reconciliations" on public.student_account_reconciliations;
create policy "finance staff read reconciliations" on public.student_account_reconciliations
  for select to authenticated
  using (private.has_capability('finance:read', 'school', tenant_id)
         or private.has_capability('finance:approve', 'school', tenant_id)
         or private.has_capability('finance:close', 'school', tenant_id));
drop policy if exists "finance closers reconcile" on public.student_account_reconciliations;
create policy "finance closers reconcile" on public.student_account_reconciliations
  for insert to authenticated
  with check (private.has_capability('finance:close', 'school', tenant_id));

drop policy if exists "finance staff read closes" on public.student_account_closes;
create policy "finance staff read closes" on public.student_account_closes
  for select to authenticated
  using (private.has_capability('finance:read', 'school', tenant_id)
         or private.has_capability('finance:approve', 'school', tenant_id)
         or private.has_capability('finance:close', 'school', tenant_id)
         or private.has_capability('finance:request', 'school', tenant_id));
drop policy if exists "finance closers close a month" on public.student_account_closes;
create policy "finance closers close a month" on public.student_account_closes
  for insert to authenticated
  with check (private.has_capability('finance:close', 'school', tenant_id));

-- ── 5. Audit ──────────────────────────────────────────────────────────────
-- The ledger is its own audit trail. Requests, settings, reconciliations and
-- closes are audited, attributed to the grant that allowed them.

alter table public.tenant_policy_audit_event
  drop constraint if exists tenant_policy_audit_event_entity_type_check;
alter table public.tenant_policy_audit_event
  add constraint tenant_policy_audit_event_entity_type_check check (entity_type in (
    'tenant_feature_policy', 'ai_policy', 'approved_source', 'consent_record',
    'feature_kill_switch', 'data_classification_rules', 'integration_connections',
    'integration_scopes', 'integration_mappings', 'integration_dead_letter_events',
    'governance_policy_nodes', 'governance_steward_assignments', 'governance_config_requests',
    'gtm_campaigns', 'gtm_campaign_reviews', 'gtm_sponsor_policy', 'gtm_sponsor_placements',
    'migration_projects', 'migration_field_maps', 'migration_runs', 'migration_approvals',
    'academic_record_changes', 'academic_record_subjects',
    'student_account_requests', 'student_account_settings', 'student_account_reconciliations', 'student_account_closes'
  ));

create or replace function private.audit_student_account_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  before_row jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_row  jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  row_data   jsonb := coalesce(after_row, before_row);
  event_tenant text := row_data ->> 'tenant_id';
  caller uuid := auth.uid();
  grant_id uuid;
  people text[] := array['requested_by', 'decided_by', 'updated_by', 'recorded_by', 'closed_by', 'cancelled_by'];
begin
  if tg_op = 'UPDATE' and (before_row - people) = (after_row - people) then
    return new;
  end if;
  if not exists (select 1 from public.schools s where s.id = event_tenant) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select g.id into grant_id
    from public.role_grants g
    join public.role_capabilities rc on rc.role = g.role
   where g.subject = caller
     and g.scope_kind = 'school'
     and g.scope_id = event_tenant
     and rc.capability in ('finance:request', 'finance:approve', 'finance:approve_high', 'finance:close')
     and g.revoked_at is null
     and (g.expires_at is null or g.expires_at > now())
   order by g.granted_at desc
   limit 1;

  insert into public.tenant_policy_audit_event
    (tenant_id, entity_type, entity_id, action, old_data, new_data, actor_id, actor_grant_id)
  values
    (event_tenant, tg_table_name, coalesce(row_data ->> 'id', (row_data ->> 'period'), event_tenant), lower(tg_op),
     before_row, after_row, caller, grant_id);
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function private.audit_student_account_change() from public, anon, authenticated;

drop trigger if exists audit_student_account_requests on public.student_account_requests;
create trigger audit_student_account_requests after insert or update on public.student_account_requests
  for each row execute function private.audit_student_account_change();
drop trigger if exists audit_student_account_settings on public.student_account_settings;
create trigger audit_student_account_settings after insert or update on public.student_account_settings
  for each row execute function private.audit_student_account_change();
drop trigger if exists audit_student_account_reconciliations on public.student_account_reconciliations;
create trigger audit_student_account_reconciliations after insert on public.student_account_reconciliations
  for each row execute function private.audit_student_account_change();
drop trigger if exists audit_student_account_closes on public.student_account_closes;
create trigger audit_student_account_closes after insert on public.student_account_closes
  for each row execute function private.audit_student_account_change();

-- ── 6. Descriptions ───────────────────────────────────────────────────────

comment on table public.student_account_entries is
  'A school''s student-account ledger (D-146). Signed cents, positive owed. Append-only; written only by private.student_account_request_guard when a request is approved by someone other than its requester. No money moves here and no card is stored.';
comment on table public.student_account_requests is
  'Requests against a school''s student accounts. Approved, rejected or withdrawn once, then fixed. Refused: a card number in any typed field.';
comment on table public.student_account_reconciliations is
  'A month''s reconciliation with the payment provider. The provider side is the recorder''s claim from a settlement file read in their browser; the ledger side is read by the database.';
comment on table public.student_account_closes is
  'Closed months. A month closes on a passing reconciliation recorded by someone else, with nothing waiting, and then takes nothing new.';
