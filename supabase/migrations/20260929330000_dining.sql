-- Semester — dining and the campus card.
--
-- The database half of `app/src/lib/dining/`: dining locations with their
-- hours and menus, meal plans, an append-only card ledger, mobile orders, and
-- a shared-swipe pool for the school's basic-needs work. Behind the tenant
-- flag `module.dining` (lib/flags.ts: off by default, high-risk because it
-- moves money), and behind the school's card-office connection: nothing here
-- charges anybody unless that connection is `live`, because the vendor's
-- system — not this one — is the record of every balance and plan.
--
-- What it decides, and where:
--
--   * **Who writes.** No client writes a table directly. Students place,
--     cancel and give through the `dining_*` functions below, each of which
--     reads the caller from `auth.uid()` and their school from
--     `profiles.school_id` — never from a parameter. Dining staff hold
--     `dining:operate` over their school (`role_grants`, scope `school`),
--     which moves an order along, cancels one, pauses a location and reads the
--     pool as totals. Disconnecting the vendor needs `integration:configure`.
--     Plans, hours, menus and the vendor's own ledger postings arrive through
--     the card-office adapter with the service key, which is not a client.
--   * **Who reads.** A student reads only their own plan, ledger and orders.
--     Staff with `dining:operate` read their school's open orders through
--     `dining_order_queue()`, never the table: the table says which orders a
--     shared swipe paid for, and the queue does not. Locations,
--     hours, menus and the connection's status are the school's, and every
--     member reads them: a closed dining hall is not a secret.
--   * **Money.** Integer cents (`bigint`), never a float, never a stored
--     balance: every balance is `sum(delta)` over `dining_ledger`, which
--     nothing may update. A refund is a new entry that names the order and
--     carries its debit's `applies_at`, so a swipe goes back to the plan week
--     it came out of. An order's price is summed here from the menu; the
--     client says what it wants, never what it costs.
--   * **Idempotency.** Every write takes a client key. The same key for the
--     same intent returns the first result and changes nothing; the same key
--     for something else is refused.
--   * **The pool is anonymous by construction.** A donation names its donor
--     and no recipient; a claim names its recipient and no donor; nothing
--     joins them. A deleted donor's gift stays in the pool with the donor
--     cleared. Staff see three totals, and their order queue reports a
--     shared swipe as a swipe, so the counter cannot tell who is eating on
--     one either.
--   * **Switches.** `kill.writeback` or `kill.integration_sync` for the school
--     stops new orders and gifts at once. Cancelling and refunding are
--     deliberately not behind either, or the flag: a switch that stops new
--     money must never trap money already taken.
--
-- Refusals raise `dining: <code>: <sentence>`. The codes are `REFUSALS` in
-- app/src/lib/dining/decision.ts, and `migration.test.ts` there holds every
-- code raised here to that list. `supabase/dining.check.sql` proves it with
-- two students, dining staff and a school next door.
--
-- Additive. NOT APPLIED to production; applying it needs owner approval.

-- ── The role and the capability ─────────────────────────────────────────

insert into public.app_roles (role, global) values
  ('dining_staff', false)
on conflict (role) do nothing;

insert into public.app_capabilities (capability, about) values
  ('dining:operate', 'Work one school''s mobile-order queue: accept, ready, hand over or cancel an order, pause a location, and read the shared-swipe pool as totals. Never a balance or plan, or who gave or used a shared swipe.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('dining_staff', 'dining:operate')
on conflict (role, capability) do nothing;

-- ── The card-office connection ──────────────────────────────────────────
-- One row per school, written by the adapter with the service key, and by
-- `dining_disconnect_partner` below. Every member of the school may read the
-- status: it is what tells a student whether a balance is the institution's.

create table if not exists public.dining_partner_connections (
  tenant_id       text        primary key references public.schools(id) on delete cascade,
  vendor          text        not null check (length(btrim(vendor)) between 1 and 80),
  status          text        not null default 'pending'
                              check (status in ('not_connected', 'pending', 'live', 'degraded', 'disconnected')),
  last_success_at timestamptz,
  updated_at      timestamptz not null default now(),
  updated_by      uuid        references auth.users on delete set null
);
create index if not exists dining_partner_connections_by_updater on public.dining_partner_connections (updated_by);

-- ── Locations, hours, menus ─────────────────────────────────────────────

create table if not exists public.dining_locations (
  id                uuid        primary key default gen_random_uuid(),
  tenant_id         text        not null references public.schools(id) on delete cascade,
  name              text        not null check (length(btrim(name)) between 1 and 80),
  time_zone         text        not null check (time_zone ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)+$'),
  -- Mobile orders that may be open (placed, accepted or ready) at once.
  capacity          integer     not null check (capacity between 1 and 500),
  ordering_enabled  boolean     not null default true,
  source_label      text        not null check (source_label in ('institution_verified', 'imported', 'student_entered', 'estimated', 'needs_review')),
  source_updated_at timestamptz,
  unique (tenant_id, name)
);

-- Half-open windows in local minutes: open at `opens_min`, closed at
-- `closes_min`. A night past midnight is two rows.
create table if not exists public.dining_hours (
  location_id uuid     not null references public.dining_locations(id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),
  opens_min   smallint not null check (opens_min between 0 and 1439),
  closes_min  smallint not null check (closes_min between 1 and 1440),
  check (opens_min < closes_min),
  primary key (location_id, weekday, opens_min)
);

create table if not exists public.dining_menu_items (
  id                uuid        primary key default gen_random_uuid(),
  location_id       uuid        not null references public.dining_locations(id) on delete cascade,
  served_on         date        not null,
  meal              text        not null check (meal in ('breakfast', 'lunch', 'dinner', 'late', 'all_day')),
  name              text        not null check (length(btrim(name)) between 1 and 120),
  price_cents       integer     not null check (price_cents between 0 and 100000),
  swipe_eligible    boolean     not null default false,
  available         boolean     not null default true,
  source_label      text        not null check (source_label in ('institution_verified', 'imported', 'student_entered', 'estimated', 'needs_review')),
  source_updated_at timestamptz
);
create index if not exists dining_menu_items_by_location on public.dining_menu_items (location_id, served_on);

-- ── Meal plans ──────────────────────────────────────────────────────────
-- From the card office, one per student per term. The week starts at local
-- midnight on `week_starts` (0 = Sunday) in `time_zone`.

create table if not exists public.dining_plans (
  id                    uuid        primary key default gen_random_uuid(),
  tenant_id             text        not null references public.schools(id) on delete cascade,
  student               uuid        not null references auth.users on delete cascade,
  term                  text        not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  starts_on             date        not null,
  ends_on               date        not null,
  time_zone             text        not null check (time_zone ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)+$'),
  week_starts           smallint    not null default 0 check (week_starts between 0 and 6),
  swipe_kind            text        not null check (swipe_kind in ('weekly', 'term', 'none')),
  swipes_per_week       integer     check (swipes_per_week between 1 and 50),
  swipes_per_term       integer     check (swipes_per_term between 1 and 1000),
  swipe_rollover        text        not null default 'none' check (swipe_rollover in ('none', 'within_term')),
  dining_cents_rollover text        not null default 'forfeit' check (dining_cents_rollover in ('forfeit', 'carry')),
  source_label          text        not null check (source_label in ('institution_verified', 'imported', 'student_entered', 'estimated', 'needs_review')),
  source_updated_at     timestamptz,
  check (ends_on >= starts_on),
  check ((swipe_kind = 'weekly') = (swipes_per_week is not null)),
  check ((swipe_kind = 'term') = (swipes_per_term is not null)),
  unique (tenant_id, student, term)
);
create index if not exists dining_plans_by_student on public.dining_plans (student);

-- ── Orders ──────────────────────────────────────────────────────────────

create table if not exists public.dining_orders (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       text        not null references public.schools(id) on delete cascade,
  location_id     uuid        not null references public.dining_locations(id) on delete cascade,
  student         uuid        not null references auth.users on delete cascade,
  idempotency_key text        not null check (idempotency_key ~ '^[A-Za-z0-9_.:-]{8,64}$'),
  status          text        not null default 'placed' check (status in ('placed', 'accepted', 'ready', 'picked_up', 'cancelled')),
  pay             text        not null check (pay in ('swipe', 'pool_swipe', 'dining_cents', 'campus_cents')),
  -- 1 for a swipe; cents otherwise, summed from the menu by the function.
  amount          bigint      not null check (amount > 0),
  items           uuid[]      not null check (cardinality(items) between 1 and 6),
  -- The plan term charged, 'card' for campus cash, null for a shared swipe.
  term            text        check (term = 'card' or term ~ '^[0-9]{4}(FA|SP|SU)$'),
  placed_at       timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (student, idempotency_key)
);
create index if not exists dining_orders_by_tenant on public.dining_orders (tenant_id, status);
create index if not exists dining_orders_by_location on public.dining_orders (location_id, status);

-- Every move of an order, in order. Append-only through the API.
create table if not exists public.dining_order_events (
  id       uuid        primary key default gen_random_uuid(),
  order_id uuid        not null references public.dining_orders(id) on delete cascade,
  status   text        not null check (status in ('placed', 'accepted', 'ready', 'picked_up', 'cancelled')),
  by_kind  text        not null check (by_kind in ('student', 'staff')),
  actor    uuid        references auth.users on delete set null,
  reason   text        not null default '' check (length(reason) <= 300),
  at       timestamptz not null default now()
);
create index if not exists dining_order_events_by_order on public.dining_order_events (order_id, at);
create index if not exists dining_order_events_by_actor on public.dining_order_events (actor);

-- ── The card ledger ─────────────────────────────────────────────────────
-- Append-only. `delta` is signed: swipes for `swipe`, cents otherwise. Campus
-- cash is not a term's money, so its term is 'card'. `applies_at` is when an
-- entry counts — for a swipe, the plan week it is charged to.

create table if not exists public.dining_ledger (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       text        not null references public.schools(id) on delete cascade,
  student         uuid        not null references auth.users on delete cascade,
  term            text        not null check (term = 'card' or term ~ '^[0-9]{4}(FA|SP|SU)$'),
  kind            text        not null check (kind in ('swipe', 'dining_cents', 'campus_cents')),
  delta           bigint      not null check (delta <> 0),
  applies_at      timestamptz not null,
  created_at      timestamptz not null default now(),
  reason          text        not null check (reason in ('partner_sync', 'order', 'refund', 'donation', 'adjustment')),
  idempotency_key text        not null check (idempotency_key ~ '^[A-Za-z0-9_.:-]{8,80}$'),
  source_label    text        not null check (source_label in ('institution_verified', 'imported', 'student_entered', 'estimated', 'needs_review')),
  order_id        uuid        references public.dining_orders(id) on delete cascade,
  check (kind = 'campus_cents' or term <> 'card'),
  check (kind <> 'campus_cents' or term = 'card'),
  unique (tenant_id, student, idempotency_key)
);
create index if not exists dining_ledger_by_account on public.dining_ledger (student, term, kind);
create index if not exists dining_ledger_by_order on public.dining_ledger (order_id);

-- Nothing edits an entry, the owner included: a correction is another entry.
-- Deletion is left to account erasure (`erase_account`, and the cascade from
-- `auth.users`), which a trigger here would break; no client role holds a
-- delete grant, so erasure is the only path that has one.
create or replace function private.dining_ledger_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'dining: not_allowed: the card ledger is append-only; write a correcting entry'
    using errcode = 'insufficient_privilege';
end $$;
revoke all on function private.dining_ledger_append_only() from public, anon, authenticated;

drop trigger if exists dining_ledger_append_only on public.dining_ledger;
create trigger dining_ledger_append_only
  before update on public.dining_ledger
  for each row execute function private.dining_ledger_append_only();

-- ── The shared-swipe pool ───────────────────────────────────────────────

create table if not exists public.dining_pool_donations (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       text        not null references public.schools(id) on delete cascade,
  -- Cleared, not cascaded, when the donor's account goes: the gift stays.
  donor           uuid        references auth.users on delete set null,
  swipes          integer     not null check (swipes between 1 and 5),
  consent_version text        not null check (consent_version in ('dining-share-v1')),
  idempotency_key text        not null check (idempotency_key ~ '^[A-Za-z0-9_.:-]{8,64}$'),
  created_at      timestamptz not null default now(),
  unique (donor, idempotency_key)
);
create index if not exists dining_pool_donations_by_tenant on public.dining_pool_donations (tenant_id);

create table if not exists public.dining_pool_claims (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  text        not null references public.schools(id) on delete cascade,
  -- Cleared when the account goes, so a meal eaten stays eaten.
  recipient  uuid        references auth.users on delete set null,
  swipes     smallint    not null check (swipes in (1, -1)),
  order_id   uuid        references public.dining_orders(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (order_id, swipes)
);
create index if not exists dining_pool_claims_by_tenant on public.dining_pool_claims (tenant_id, created_at);
create index if not exists dining_pool_claims_by_recipient on public.dining_pool_claims (recipient, created_at);

comment on table public.dining_partner_connections is 'The school''s campus-card vendor connection. Nothing in dining charges unless it is live.';
comment on table public.dining_locations is 'Dining locations, with source and freshness. Written by the card-office adapter; paused by dining staff.';
comment on table public.dining_hours is 'Weekly opening windows of a dining location, half-open, in local minutes.';
comment on table public.dining_menu_items is 'What a location serves on a date, priced in integer cents, with source and freshness.';
comment on table public.dining_plans is 'A student''s meal plan for a term, from the card office.';
comment on table public.dining_orders is 'Mobile orders. Written only by the dining_* functions; idempotent per student and key.';
comment on table public.dining_order_events is 'Every move of a mobile order.';
comment on table public.dining_ledger is 'The campus-card ledger. Append-only; every balance is a sum over it.';
comment on table public.dining_pool_donations is 'Swipes given to the school''s basic-needs pool, with consent. Names no recipient.';
comment on table public.dining_pool_claims is 'Shared swipes drawn for an order (+1) or returned by its cancellation (-1). Names no donor.';

-- ── Who reads, and that nobody writes directly ──────────────────────────

alter table public.dining_partner_connections enable row level security;
alter table public.dining_locations           enable row level security;
alter table public.dining_hours               enable row level security;
alter table public.dining_menu_items          enable row level security;
alter table public.dining_plans               enable row level security;
alter table public.dining_orders              enable row level security;
alter table public.dining_order_events        enable row level security;
alter table public.dining_ledger              enable row level security;
alter table public.dining_pool_donations      enable row level security;
alter table public.dining_pool_claims         enable row level security;

revoke all on table public.dining_partner_connections, public.dining_locations, public.dining_hours,
  public.dining_menu_items, public.dining_plans, public.dining_orders, public.dining_order_events,
  public.dining_ledger, public.dining_pool_donations, public.dining_pool_claims
  from anon, authenticated;
grant select on table public.dining_partner_connections, public.dining_locations, public.dining_hours,
  public.dining_menu_items, public.dining_plans, public.dining_orders, public.dining_order_events,
  public.dining_ledger, public.dining_pool_donations, public.dining_pool_claims
  to authenticated;

drop policy if exists "school members read their dining connection" on public.dining_partner_connections;
create policy "school members read their dining connection" on public.dining_partner_connections
  for select to authenticated
  using (tenant_id = (select school_id from public.profiles where user_id = (select auth.uid())));

drop policy if exists "school members read their dining locations" on public.dining_locations;
create policy "school members read their dining locations" on public.dining_locations
  for select to authenticated
  using (tenant_id = (select school_id from public.profiles where user_id = (select auth.uid())));

-- Hours and menus follow their location's policy: the subquery is itself
-- under `dining_locations`' row-level security.
drop policy if exists "school members read dining hours" on public.dining_hours;
create policy "school members read dining hours" on public.dining_hours
  for select to authenticated
  using (exists (select 1 from public.dining_locations l where l.id = location_id));

drop policy if exists "school members read dining menus" on public.dining_menu_items;
create policy "school members read dining menus" on public.dining_menu_items
  for select to authenticated
  using (exists (select 1 from public.dining_locations l where l.id = location_id));

drop policy if exists "a student reads their own meal plan" on public.dining_plans;
create policy "a student reads their own meal plan" on public.dining_plans
  for select to authenticated
  using (student = (select auth.uid()));

drop policy if exists "a student reads their own card ledger" on public.dining_ledger;
create policy "a student reads their own card ledger" on public.dining_ledger
  for select to authenticated
  using (student = (select auth.uid()));

-- Staff are deliberately not here: `pay` would tell them who ate on a shared
-- swipe. They read the queue through `dining_order_queue()` below.
drop policy if exists "a student reads their orders, dining staff their school's" on public.dining_orders;
drop policy if exists "a student reads their own orders" on public.dining_orders;
create policy "a student reads their own orders" on public.dining_orders
  for select to authenticated
  using (student = (select auth.uid()));

drop policy if exists "order history follows the order" on public.dining_order_events;
create policy "order history follows the order" on public.dining_order_events
  for select to authenticated
  using (exists (select 1 from public.dining_orders o where o.id = order_id));

drop policy if exists "a donor reads their own gifts" on public.dining_pool_donations;
create policy "a donor reads their own gifts" on public.dining_pool_donations
  for select to authenticated
  using (donor = (select auth.uid()));

drop policy if exists "a recipient reads their own draws" on public.dining_pool_claims;
create policy "a recipient reads their own draws" on public.dining_pool_claims
  for select to authenticated
  using (recipient = (select auth.uid()));

-- ── Helpers ─────────────────────────────────────────────────────────────
-- Called only from the definer functions below, which run as the owner, so
-- no client role executes any of them.

-- The caller's school, from their profile; never a parameter.
create or replace function private.dining_caller_school()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text;
begin
  if me is null then
    raise exception 'dining: not_allowed: not signed in' using errcode = 'insufficient_privilege';
  end if;
  select p.school_id into school from public.profiles p where p.user_id = me;
  if school is null then
    raise exception 'dining: not_allowed: this account belongs to no school' using errcode = 'insufficient_privilege';
  end if;
  return school;
end $$;
revoke all on function private.dining_caller_school() from public, anon, authenticated;

create or replace function private.dining_key(k text)
returns boolean
language sql
immutable
set search_path = ''
as $$ select coalesce(k ~ '^[A-Za-z0-9_.:-]{8,64}$', false) $$;
revoke all on function private.dining_key(text) from public, anon, authenticated;

-- Whether anything may be charged at this school now: the flag in
-- production, neither money switch engaged, and the card office live.
create or replace function private.dining_charge_gate(school text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.feature_state('module.dining', school) <> 'production' then
    raise exception 'dining: flag_off: dining is not turned on at this school' using errcode = 'insufficient_privilege';
  end if;
  if public.kill_switch_engaged('kill.writeback', school) or public.kill_switch_engaged('kill.integration_sync', school) then
    raise exception 'dining: kill_switch: new orders and gifts are stopped at this school' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.dining_partner_connections c where c.tenant_id = school and c.status = 'live') then
    raise exception 'dining: partner_unavailable: the card office is not connected, so nothing can be charged'
      using errcode = 'insufficient_privilege';
  end if;
end $$;
revoke all on function private.dining_charge_gate(text) from public, anon, authenticated;

-- The plan in force for the caller at their school today, or null.
create or replace function private.dining_current_plan(school text, who uuid)
returns public.dining_plans
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.dining_plans p
   where p.tenant_id = school and p.student = who
     and (now() at time zone p.time_zone)::date between p.starts_on and p.ends_on
   order by p.starts_on desc
   limit 1;
$$;
revoke all on function private.dining_current_plan(text, uuid) from public, anon, authenticated;

-- Swipes a plan allows at an instant: its entitlement for the window, plus
-- the net of swipe entries whose `applies_at` falls in it (local dates).
-- The same arithmetic as `swipesAvailable` in app/src/lib/dining/plans.ts.
create or replace function private.dining_swipes_left(pl public.dining_plans, at timestamptz)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today    date;
  wk       date;
  first_wk date;
  f        date;
  t        date;
  entitled integer;
  net      bigint;
begin
  if pl.id is null then return 0; end if;
  today := (at at time zone pl.time_zone)::date;
  if today < pl.starts_on or today > pl.ends_on or pl.swipe_kind = 'none' then return 0; end if;
  wk := today - ((extract(dow from today)::integer - pl.week_starts + 7) % 7);
  if pl.swipe_kind = 'term' then
    f := pl.starts_on;
    t := pl.ends_on + 1;
    entitled := pl.swipes_per_term;
  else
    if pl.swipe_rollover = 'within_term' then
      first_wk := pl.starts_on - ((extract(dow from pl.starts_on)::integer - pl.week_starts + 7) % 7);
      f := pl.starts_on;
      entitled := pl.swipes_per_week * ((wk - first_wk) / 7 + 1);
    else
      f := greatest(wk, pl.starts_on);
      entitled := pl.swipes_per_week;
    end if;
    t := least(wk + 7, pl.ends_on + 1);
  end if;
  select coalesce(sum(l.delta), 0) into net
    from public.dining_ledger l
   where l.tenant_id = pl.tenant_id and l.student = pl.student and l.term = pl.term and l.kind = 'swipe'
     and (l.applies_at at time zone pl.time_zone)::date >= f
     and (l.applies_at at time zone pl.time_zone)::date < t;
  return greatest(0, entitled + net)::integer;
end $$;
revoke all on function private.dining_swipes_left(public.dining_plans, timestamptz) from public, anon, authenticated;

-- ── Placing an order ────────────────────────────────────────────────────
-- The checks run in the order `placeOrder` in app/src/lib/dining/service.ts
-- makes them: the key, the gate, the location, the items, capacity, payment.

create or replace function public.dining_place_order(want_location uuid, want_items uuid[], want_pay text, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me        uuid := (select auth.uid());
  school    text := private.dining_caller_school();
  prior     public.dining_orders;
  loc       public.dining_locations;
  pl        public.dining_plans;
  local_ts  timestamp;
  now_min   integer;
  n_items   integer := coalesce(cardinality(want_items), 0);
  n_found   integer;
  price     bigint;
  all_swipe boolean;
  queued    integer;
  oid       uuid := gen_random_uuid();
  amt       bigint;
  charged   text;
  have      bigint;
begin
  if not private.dining_key(want_key) then
    raise exception 'dining: invalid: the request key is not one this service accepts' using errcode = 'check_violation';
  end if;
  if want_pay is null or want_pay not in ('swipe', 'pool_swipe', 'dining_cents', 'campus_cents') then
    raise exception 'dining: invalid: that is not a way to pay' using errcode = 'check_violation';
  end if;

  -- 1. The key. A retry of an order that exists gets the order back.
  perform pg_advisory_xact_lock(hashtext('dining_order:' || me::text || ':' || want_key));
  select * into prior from public.dining_orders o where o.student = me and o.idempotency_key = want_key;
  if found then
    if prior.location_id = want_location and prior.pay = want_pay and prior.items = want_items then
      return prior.id;
    end if;
    raise exception 'dining: idempotency_conflict: that request key was already used for a different order'
      using errcode = 'unique_violation';
  end if;

  -- 2. The flag, the switches, the card office.
  perform private.dining_charge_gate(school);

  -- 3. The location: this school's, taking orders, open now. Locked, so two
  -- orders cannot both take its last place.
  select * into loc from public.dining_locations l where l.id = want_location and l.tenant_id = school for update;
  if not found then
    raise exception 'dining: not_found: there is no such dining location at your school' using errcode = 'no_data_found';
  end if;
  if not loc.ordering_enabled then
    raise exception 'dining: ordering_paused: this location has paused mobile orders' using errcode = 'check_violation';
  end if;
  local_ts := now() at time zone loc.time_zone;
  now_min := extract(hour from local_ts)::integer * 60 + extract(minute from local_ts)::integer;
  if not exists (
    select 1 from public.dining_hours h
     where h.location_id = loc.id and h.weekday = extract(dow from local_ts)::integer
       and h.opens_min <= now_min and now_min < h.closes_min) then
    raise exception 'dining: closed: this location is closed now' using errcode = 'check_violation';
  end if;

  -- 4. The items: on today's menu there, available. Priced here.
  if n_items < 1 or n_items > 6 then
    raise exception 'dining: invalid: an order has 1 to 6 items' using errcode = 'check_violation';
  end if;
  select count(*), coalesce(sum(m.price_cents), 0), coalesce(bool_and(m.swipe_eligible), false)
    into n_found, price, all_swipe
    from unnest(want_items) as w(item)
    join public.dining_menu_items m on m.id = w.item
   where m.location_id = loc.id and m.served_on = local_ts::date and m.available;
  if n_found <> n_items then
    raise exception 'dining: item_unavailable: an item is not on today''s menu here' using errcode = 'check_violation';
  end if;

  -- 5. Capacity.
  select count(*) into queued from public.dining_orders o
   where o.location_id = loc.id and o.status in ('placed', 'accepted', 'ready');
  if queued >= loc.capacity then
    raise exception 'dining: at_capacity: this location has as many orders in progress as it takes' using errcode = 'check_violation';
  end if;

  -- 6. Payment.
  if want_pay in ('swipe', 'pool_swipe') and not all_swipe then
    raise exception 'dining: invalid: a swipe does not cover every item in this order' using errcode = 'check_violation';
  end if;
  if want_pay = 'pool_swipe' then
    perform pg_advisory_xact_lock(hashtext('dining_pool:' || school));
    if (select coalesce(sum(d.swipes), 0) from public.dining_pool_donations d where d.tenant_id = school)
       - (select coalesce(sum(c.swipes), 0) from public.dining_pool_claims c where c.tenant_id = school) < 1 then
      raise exception 'dining: pool_empty: the shared pool has no swipes right now' using errcode = 'check_violation';
    end if;
    if (select coalesce(sum(c.swipes), 0) from public.dining_pool_claims c
         where c.tenant_id = school and c.recipient = me and c.created_at > now() - interval '7 days') >= 2 then
      raise exception 'dining: claim_limit: the pool allows 2 shared swipes in any seven days' using errcode = 'check_violation';
    end if;
    amt := 1;
    charged := null;
  else
    perform pg_advisory_xact_lock(hashtext('dining_account:' || me::text));
    if want_pay = 'campus_cents' then
      charged := 'card';
    else
      pl := private.dining_current_plan(school, me);
      if pl.id is null then
        raise exception 'dining: no_plan: no meal plan covers today' using errcode = 'check_violation';
      end if;
      charged := pl.term;
    end if;
    if want_pay = 'swipe' then
      if private.dining_swipes_left(pl, now()) < 1 then
        raise exception 'dining: swipes_exhausted: the swipes for this plan week are used' using errcode = 'check_violation';
      end if;
      amt := 1;
    else
      amt := price;
      if amt <= 0 then
        raise exception 'dining: invalid: the order has no price to charge' using errcode = 'check_violation';
      end if;
      select coalesce(sum(l.delta), 0) into have from public.dining_ledger l
       where l.tenant_id = school and l.student = me and l.term = charged and l.kind = want_pay;
      if have < amt then
        raise exception 'dining: insufficient_funds: the balance does not cover this order' using errcode = 'check_violation';
      end if;
    end if;
  end if;

  insert into public.dining_orders (id, tenant_id, location_id, student, idempotency_key, pay, amount, items, term)
  values (oid, school, loc.id, me, want_key, want_pay, amt, want_items, charged);
  insert into public.dining_order_events (order_id, status, by_kind, actor, reason)
  values (oid, 'placed', 'student', me, 'Placed.');
  if want_pay = 'pool_swipe' then
    insert into public.dining_pool_claims (tenant_id, recipient, swipes, order_id) values (school, me, 1, oid);
  else
    insert into public.dining_ledger (tenant_id, student, term, kind, delta, applies_at, reason, idempotency_key, source_label, order_id)
    values (school, me, charged, want_pay, -amt, now(), 'order', 'o.' || want_key, 'estimated', oid);
  end if;
  return oid;
end $$;

-- ── Cancelling, and the refund ──────────────────────────────────────────
-- A student cancels their own order until the counter accepts it; staff with
-- `dining:operate` cancel any before pickup. Not behind the flag, the
-- switches or the card office. The refund names the debit it reverses and
-- carries its `applies_at`.

create or replace function public.dining_cancel_order(want_order uuid, want_reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.dining_caller_school();
  o      public.dining_orders;
  staff  boolean := private.has_capability('dining:operate', 'school', school);
  moved  integer;
begin
  select * into o from public.dining_orders d where d.id = want_order and d.tenant_id = school for update;
  if not found or (o.student <> me and not staff) then
    raise exception 'dining: not_found: there is no such order' using errcode = 'no_data_found';
  end if;
  if o.status = 'cancelled' then
    return 'cancelled';
  end if;
  if o.status = 'picked_up' then
    raise exception 'dining: bad_transition: an order that was picked up cannot be cancelled' using errcode = 'check_violation';
  end if;
  if not staff and o.status <> 'placed' then
    raise exception 'dining: not_allowed: the counter has accepted this order; ask them to cancel it'
      using errcode = 'insufficient_privilege';
  end if;

  update public.dining_orders set status = 'cancelled', updated_at = now() where id = o.id;
  insert into public.dining_order_events (order_id, status, by_kind, actor, reason)
  values (o.id, 'cancelled', case when o.student = me then 'student' else 'staff' end, me,
          left(coalesce(nullif(btrim(want_reason), ''), 'Cancelled.'), 300));

  if o.pay = 'pool_swipe' then
    insert into public.dining_pool_claims (tenant_id, recipient, swipes, order_id) values (o.tenant_id, o.student, -1, o.id);
  else
    insert into public.dining_ledger (tenant_id, student, term, kind, delta, applies_at, reason, idempotency_key, source_label, order_id)
    select d.tenant_id, d.student, d.term, d.kind, -d.delta, d.applies_at, 'refund', 'r.' || d.idempotency_key, 'estimated', o.id
      from public.dining_ledger d
     where d.order_id = o.id and d.reason = 'order';
    get diagnostics moved = row_count;
    if moved <> 1 then
      raise exception 'dining: not_found: the payment for this order is not in the ledger' using errcode = 'no_data_found';
    end if;
  end if;
  return 'cancelled';
end $$;

-- ── Moving an order along ───────────────────────────────────────────────
-- placed → accepted → ready → picked_up, one step at a time; nothing back.
-- The same table as `TRANSITIONS` in app/src/lib/dining/orders.ts.

create or replace function public.dining_advance_order(want_order uuid, want_status text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.dining_caller_school();
  o      public.dining_orders;
begin
  if not private.has_capability('dining:operate', 'school', school) then
    raise exception 'dining: not_allowed: moving orders needs dining:operate at this school' using errcode = 'insufficient_privilege';
  end if;
  if want_status is null or want_status not in ('accepted', 'ready', 'picked_up') then
    raise exception 'dining: invalid: an order moves to accepted, ready or picked_up; cancel it with dining_cancel_order'
      using errcode = 'check_violation';
  end if;
  select * into o from public.dining_orders d where d.id = want_order and d.tenant_id = school for update;
  if not found then
    raise exception 'dining: not_found: there is no such order at this school' using errcode = 'no_data_found';
  end if;
  if o.status = want_status then
    return o.status;
  end if;
  if (o.status, want_status) not in (('placed', 'accepted'), ('accepted', 'ready'), ('ready', 'picked_up')) then
    raise exception 'dining: bad_transition: an order that is % cannot become %', o.status, want_status
      using errcode = 'check_violation';
  end if;
  update public.dining_orders set status = want_status, updated_at = now() where id = o.id;
  insert into public.dining_order_events (order_id, status, by_kind, actor, reason)
  values (o.id, want_status, 'staff', me, 'Marked ' || replace(want_status, '_', ' ') || '.');
  return want_status;
end $$;

-- ── Pausing a location ──────────────────────────────────────────────────

create or replace function public.dining_set_ordering(want_location uuid, want_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  school text := private.dining_caller_school();
begin
  if not private.has_capability('dining:operate', 'school', school) then
    raise exception 'dining: not_allowed: pausing a location needs dining:operate at this school' using errcode = 'insufficient_privilege';
  end if;
  if want_enabled is null then
    raise exception 'dining: invalid: say whether ordering is on or off' using errcode = 'check_violation';
  end if;
  update public.dining_locations l set ordering_enabled = want_enabled where l.id = want_location and l.tenant_id = school;
  if not found then
    raise exception 'dining: not_found: there is no such dining location at your school' using errcode = 'no_data_found';
  end if;
  return want_enabled;
end $$;

-- ── Giving swipes ───────────────────────────────────────────────────────
-- Consent is to a named wording: `SHARE_CONSENT_VERSION` and
-- `SHARE_CONSENT_TEXT` in app/src/lib/dining/sharing.ts.

create or replace function public.dining_donate_swipes(want_swipes integer, want_consent text, want_key text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.dining_caller_school();
  prior  public.dining_pool_donations;
  pl     public.dining_plans;
begin
  if want_consent is distinct from 'dining-share-v1' then
    raise exception 'dining: consent_required: giving swipes needs consent to the current wording' using errcode = 'check_violation';
  end if;
  if want_swipes is null or want_swipes not between 1 and 5 then
    raise exception 'dining: invalid: you can give 1 to 5 swipes at a time' using errcode = 'check_violation';
  end if;
  if not private.dining_key(want_key) then
    raise exception 'dining: invalid: the request key is not one this service accepts' using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtext('dining_gift:' || me::text || ':' || want_key));
  select * into prior from public.dining_pool_donations d where d.donor = me and d.idempotency_key = want_key;
  if found then
    if prior.swipes = want_swipes then return prior.swipes; end if;
    raise exception 'dining: idempotency_conflict: that request key was already used for a different gift'
      using errcode = 'unique_violation';
  end if;

  perform private.dining_charge_gate(school);
  pl := private.dining_current_plan(school, me);
  if pl.id is null then
    raise exception 'dining: no_plan: no meal plan covers today' using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('dining_account:' || me::text));
  if private.dining_swipes_left(pl, now()) < want_swipes then
    raise exception 'dining: swipes_exhausted: this plan week does not have that many swipes left' using errcode = 'check_violation';
  end if;

  insert into public.dining_ledger (tenant_id, student, term, kind, delta, applies_at, reason, idempotency_key, source_label)
  values (school, me, pl.term, 'swipe', -want_swipes, now(), 'donation', 'd.' || want_key, 'estimated');
  insert into public.dining_pool_donations (tenant_id, donor, swipes, consent_version, idempotency_key)
  values (school, me, want_swipes, want_consent, want_key);
  return want_swipes;
end $$;

-- ── The pool, as staff see it: three totals ─────────────────────────────

create or replace function public.dining_pool_summary()
returns table (donated bigint, drawn bigint, available bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  school text := private.dining_caller_school();
  given  bigint;
  taken  bigint;
begin
  if not private.has_capability('dining:operate', 'school', school) then
    raise exception 'dining: not_allowed: the pool summary needs dining:operate at this school' using errcode = 'insufficient_privilege';
  end if;
  select coalesce(sum(d.swipes), 0) into given from public.dining_pool_donations d where d.tenant_id = school;
  select coalesce(sum(c.swipes), 0) into taken from public.dining_pool_claims c where c.tenant_id = school;
  return query select given, taken, given - taken;
end $$;

-- ── The counter's queue ─────────────────────────────────────────────────
-- The school's open orders, for staff with `dining:operate`. A shared swipe
-- is reported as `swipe`: the counter needs to know an order is paid for,
-- not how, and a student eating on the pool is nobody's business there.
-- Amount and term are left out for the same reason (a shared swipe has no
-- term).

create or replace function public.dining_order_queue()
returns table (id uuid, location_id uuid, student uuid, status text, paid_with text, items uuid[],
               placed_at timestamptz, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  school text := private.dining_caller_school();
begin
  if not private.has_capability('dining:operate', 'school', school) then
    raise exception 'dining: not_allowed: the order queue needs dining:operate at this school' using errcode = 'insufficient_privilege';
  end if;
  return query
    select o.id, o.location_id, o.student, o.status,
           case when o.pay = 'pool_swipe' then 'swipe' else o.pay end,
           o.items, o.placed_at, o.updated_at
      from public.dining_orders o
     where o.tenant_id = school and o.status in ('placed', 'accepted', 'ready')
     order by o.placed_at;
end $$;

-- ── Disconnecting the card office ───────────────────────────────────────
-- From this moment nothing charges; the adapter revokes its token on its next
-- run. Reconnecting is the adapter's, with the service key.

create or replace function public.dining_disconnect_partner()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.dining_caller_school();
begin
  if not private.has_capability('integration:configure', 'school', school) then
    raise exception 'dining: not_allowed: disconnecting the card office needs integration:configure at this school'
      using errcode = 'insufficient_privilege';
  end if;
  update public.dining_partner_connections c
     set status = 'disconnected', updated_at = now(), updated_by = me
   where c.tenant_id = school;
  if not found then
    raise exception 'dining: not_found: this school has no card-office connection' using errcode = 'no_data_found';
  end if;
  return 'disconnected';
end $$;

-- ── The caller's own balances ───────────────────────────────────────────
-- One row: the plan in force, its swipes left in the current window, the
-- dining dollars on that plan and the campus cash on the card — all summed
-- from the ledger — and the connection's status and last success, which the
-- app turns into the source label and age every figure carries.

create or replace function public.my_dining_balances()
returns table (plan_term text, swipes_left integer, dining_cents bigint, campus_cents bigint,
               partner_status text, partner_last_success timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.dining_caller_school();
  pl     public.dining_plans;
begin
  pl := private.dining_current_plan(school, me);
  return query
    select pl.term,
           case when pl.id is null then null else private.dining_swipes_left(pl, now()) end,
           case when pl.id is null then null::bigint else (
             select coalesce(sum(l.delta), 0)::bigint from public.dining_ledger l
              where l.tenant_id = school and l.student = me and l.term = pl.term and l.kind = 'dining_cents') end,
           (select coalesce(sum(l.delta), 0)::bigint from public.dining_ledger l
             where l.tenant_id = school and l.student = me and l.term = 'card' and l.kind = 'campus_cents'),
           coalesce((select c.status from public.dining_partner_connections c where c.tenant_id = school), 'not_connected'),
           (select c.last_success_at from public.dining_partner_connections c where c.tenant_id = school);
end $$;

revoke all on function public.dining_place_order(uuid, uuid[], text, text) from public, anon, authenticated;
revoke all on function public.dining_cancel_order(uuid, text) from public, anon, authenticated;
revoke all on function public.dining_advance_order(uuid, text) from public, anon, authenticated;
revoke all on function public.dining_set_ordering(uuid, boolean) from public, anon, authenticated;
revoke all on function public.dining_donate_swipes(integer, text, text) from public, anon, authenticated;
revoke all on function public.dining_pool_summary() from public, anon, authenticated;
revoke all on function public.dining_order_queue() from public, anon, authenticated;
revoke all on function public.dining_disconnect_partner() from public, anon, authenticated;
revoke all on function public.my_dining_balances() from public, anon, authenticated;
grant execute on function public.dining_place_order(uuid, uuid[], text, text) to authenticated;
grant execute on function public.dining_cancel_order(uuid, text) to authenticated;
grant execute on function public.dining_advance_order(uuid, text) to authenticated;
grant execute on function public.dining_set_ordering(uuid, boolean) to authenticated;
grant execute on function public.dining_donate_swipes(integer, text, text) to authenticated;
grant execute on function public.dining_pool_summary() to authenticated;
grant execute on function public.dining_order_queue() to authenticated;
grant execute on function public.dining_disconnect_partner() to authenticated;
grant execute on function public.my_dining_balances() to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- Rolling back
--
--   begin;
--   drop function if exists public.my_dining_balances();
--   drop function if exists public.dining_disconnect_partner();
--   drop function if exists public.dining_order_queue();
--   drop function if exists public.dining_pool_summary();
--   drop function if exists public.dining_donate_swipes(integer, text, text);
--   drop function if exists public.dining_set_ordering(uuid, boolean);
--   drop function if exists public.dining_advance_order(uuid, text);
--   drop function if exists public.dining_cancel_order(uuid, text);
--   drop function if exists public.dining_place_order(uuid, uuid[], text, text);
--   drop function if exists private.dining_swipes_left(public.dining_plans, timestamptz);
--   drop function if exists private.dining_current_plan(text, uuid);
--   drop function if exists private.dining_charge_gate(text);
--   drop function if exists private.dining_key(text);
--   drop function if exists private.dining_caller_school();
--   drop table if exists public.dining_pool_claims, public.dining_pool_donations, public.dining_ledger,
--     public.dining_order_events, public.dining_orders, public.dining_plans, public.dining_menu_items,
--     public.dining_hours, public.dining_locations, public.dining_partner_connections;
--   drop function if exists private.dining_ledger_append_only();
--   delete from public.role_capabilities where capability = 'dining:operate';
--   delete from public.app_capabilities where capability = 'dining:operate';
--   delete from public.app_roles where role = 'dining_staff';
--   commit;
