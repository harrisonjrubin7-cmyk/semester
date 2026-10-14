-- Campus services: core invariants as Postgres constraints. PROPOSED — reconcile with the repo's existing
-- housing/dining/finance tables (docs/finance/NATIVE_FINANCIAL_PLATFORM.md names canonical records to extend).
-- Do not add a parallel student-account ledger. RLS: enable + force on every table; reads via existing capability system.
create extension if not exists btree_gist;

-- Housing: a bed can't have two overlapping active occupancies; a student can't hold two active beds at once.
create table if not exists public.cs_bed_spaces (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null, residence text not null, unit text not null, label text not null,
  inventory_version int not null default 1, features text[] not null default '{}',
  unique (institution_id, id), unique (institution_id, residence, unit, label));
create table if not exists public.cs_occupancy_assignments (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null, bed_id uuid not null, student_id uuid,
  contract_version_id uuid, period tstzrange not null, status text not null check (status in ('reserved','assigned','active','blocked','ended','cancelled')),
  reserved_until timestamptz, created_by uuid not null, override_reason text, override_approved_by uuid,
  foreign key (institution_id, bed_id) references public.cs_bed_spaces (institution_id, id),
  constraint override_needs_authority check ((override_reason is null) = (override_approved_by is null)),
  constraint reservation_expires check (status <> 'reserved' or reserved_until is not null),
  constraint closure_has_no_student check ((status = 'blocked') = (student_id is null)),   -- a bed closure is a claim with no student
  exclude using gist (bed_id with =, period with &&) where (status in ('reserved','assigned','active','blocked')),   -- one exclusion domain for reservations, assignments and closures
  exclude using gist (institution_id with =, student_id with =, period with &&) where (status in ('reserved','assigned','active')));  -- incl. reserved: a partial exclusion ignores rows outside the predicate, so a new reservation would slip past an existing assignment

-- Select a bed against the inventory version the student saw. One winner; stale versions refused.
create or replace function public.cs_select_bed(p_inst uuid, p_bed uuid, p_student uuid, p_seen_version int, p_period tstzrange, p_hold interval default '10 minutes')
returns public.cs_occupancy_assignments language plpgsql security definer set search_path = public, pg_temp as $$
declare b public.cs_bed_spaces; a public.cs_occupancy_assignments;
begin
  select * into b from public.cs_bed_spaces where institution_id = p_inst and id = p_bed for update;  -- serialises racers
  if not found then raise exception 'bed not found' using errcode = 'P0002'; end if;
  if b.inventory_version <> p_seen_version then raise exception 'stale inventory: saw v%, current v%', p_seen_version, b.inventory_version using errcode = '40001'; end if;
  insert into public.cs_occupancy_assignments (institution_id, bed_id, student_id, period, status, reserved_until, created_by)
    values (p_inst, p_bed, p_student, p_period, 'reserved', now() + p_hold, p_student) returning * into a;  -- exclusion constraint is the backstop
  update public.cs_bed_spaces set inventory_version = inventory_version + 1 where id = p_bed;
  insert into public.live_outbox (institution_id, aggregate, event, payload) values (p_inst, 'housing', 'housing.assignment.reserved', jsonb_build_object('assignment', a.id));
  return a;
end $$;
revoke execute on function public.cs_select_bed(uuid,uuid,uuid,int,tstzrange,interval) from public, anon, authenticated;

-- Dining: entitlements have their own unit; redemptions are append-only and idempotent per key.
create table if not exists public.cs_entitlements (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null, student_id uuid not null,
  kind text not null check (kind in ('meal_unit','guest_pass','dining_funds','promotional_credit','basic_needs')),
  unit text not null check (unit in ('meal','pass','usd_cents')), granted bigint not null check (granted > 0),
  effective tstzrange not null, location_rules jsonb not null default '{}', source_ref text not null,
  unique (institution_id, id));
create table if not exists public.cs_redemptions (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null, entitlement_id uuid not null,
  qty bigint not null, idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  device_id text, order_ref text, reverses uuid references public.cs_redemptions(id), created_at timestamptz not null default now(),
  foreign key (institution_id, entitlement_id) references public.cs_entitlements (institution_id, id),
  unique (institution_id, idempotency_key),
  constraint sign_matches check ((reverses is null and qty > 0) or (reverses is not null and qty < 0)));

create or replace function public.cs_redeem(p_inst uuid, p_ent uuid, p_qty bigint, p_key text, p_order text)
returns public.cs_redemptions language plpgsql security definer set search_path = public, pg_temp as $$
declare e public.cs_entitlements; r public.cs_redemptions; used bigint;
begin
  select * into r from public.cs_redemptions where institution_id = p_inst and idempotency_key = p_key;
  if found then
    if r.entitlement_id <> p_ent or r.qty <> p_qty then raise exception 'idempotency key reused with a different redemption' using errcode = '22023'; end if;
    return r;  -- device retry: original result, balance unchanged
  end if;
  select * into e from public.cs_entitlements where institution_id = p_inst and id = p_ent for update;  -- serialises concurrent spending
  if not found or not (e.effective @> now()) then raise exception 'entitlement not active' using errcode = 'P0002'; end if;
  select coalesce(sum(qty),0) into used from public.cs_redemptions where entitlement_id = p_ent;
  if used + p_qty > e.granted then raise exception 'insufficient %', e.unit using errcode = '23514'; end if;
  insert into public.cs_redemptions (institution_id, entitlement_id, qty, idempotency_key, order_ref) values (p_inst, p_ent, p_qty, p_key, p_order) returning * into r;
  insert into public.live_outbox (institution_id, aggregate, event, payload) values (p_inst, 'dining', 'dining.redemption.posted', jsonb_build_object('redemption', r.id));
  return r;
end $$;
revoke execute on function public.cs_redeem(uuid,uuid,bigint,text,text) from public, anon, authenticated;

-- Holds: each hold has an owner office; release needs that office's grant and records who.
create table if not exists public.cs_holds (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null, student_id uuid not null,
  hold_type text not null, owner_office text not null, rule_ref text not null,
  placed_at timestamptz not null default now(), released_at timestamptz, released_by uuid, release_reason text,
  constraint release_complete check ((released_at is null) = (released_by is null) and (released_at is null) = (release_reason is null)));

do $$ declare t text; begin foreach t in array array['cs_bed_spaces','cs_occupancy_assignments','cs_entitlements','cs_redemptions','cs_holds'] loop
  execute format('alter table public.%I enable row level security', t); execute format('alter table public.%I force row level security', t);
  execute format('revoke all on public.%I from anon', t); end loop; end $$;
-- NOTE: forced RLS also applies to the owner unless it bypasses RLS — check the definer functions' owner (see registration_hardening precondition).
