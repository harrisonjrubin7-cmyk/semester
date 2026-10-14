-- Campus Operations Core, part 2: allocation runs, group selection, entitlement lots + rollover, payment attempts,
-- credit-balance obligations. PROPOSED; extends campus_services_invariants.sql. Reconcile with the repo's canonical
-- finance records (NATIVE_FINANCIAL_PLATFORM.md) before applying. RLS forced on every table; no client write policies.

-- Allocation runs pin every input. Publication is immutable; a change is a new run.
create table if not exists public.cs_allocation_runs (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null, housing_period text not null,
  policy_version text not null, inventory_version int not null, eligible_list_sha256 text not null, accommodation_set_sha256 text not null,
  group_membership_version int not null, method text not null check (method in ('self_selection','lottery','ranked_preference','group','staff_reviewed','waitlist')),
  seed bigint, solver_version text, solver_status text, objective text,
  operator uuid not null, reviewer uuid, published_at timestamptz, supersedes uuid references public.cs_allocation_runs(id),
  constraint reviewer_differs check (reviewer is null or reviewer <> operator),
  constraint lottery_has_seed check (method <> 'lottery' or seed is not null),
  constraint published_needs_review check (published_at is null or reviewer is not null));
create or replace function public.cs_runs_immutable() returns trigger language plpgsql as $$
begin if old.published_at is not null then raise exception 'published allocation run is immutable; create a superseding run'; end if; return new; end $$;
create trigger cs_runs_immutable before update or delete on public.cs_allocation_runs for each row execute function public.cs_runs_immutable();

-- Roommate groups: versioned; every member accepts for themselves.
create table if not exists public.cs_roommate_groups (id uuid primary key default gen_random_uuid(), institution_id uuid not null, version int not null default 1, locked_at timestamptz);
create table if not exists public.cs_roommate_memberships (
  group_id uuid not null references public.cs_roommate_groups(id), student_id uuid not null, accepted_at timestamptz, accepted_by uuid, accepted_group_version int,
  primary key (group_id, student_id),
  constraint self_acceptance check (accepted_at is null or accepted_by = student_id),  -- staff can't accept on a student's behalf
  constraint acceptance_names_version check ((accepted_at is null) = (accepted_group_version is null)));
-- Any membership change bumps the group version, so acceptances of the old group stop counting.
create or replace function public.cs_group_version_bump() returns trigger language plpgsql as $$
begin update public.cs_roommate_groups set version = version + 1 where id = coalesce(new.group_id, old.group_id); return null; end $$;
create trigger cs_group_version_bump after insert or delete on public.cs_roommate_memberships for each row execute function public.cs_group_version_bump();

-- Group selection: all beds or none, locked in a stable order (deadlock-safe). Retry with the same key returns the original set.
create table if not exists public.cs_group_selections (
  institution_id uuid not null, idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  group_id uuid not null, group_version int not null, beds uuid[] not null, assignment_ids uuid[] not null, created_at timestamptz not null default now(),
  primary key (institution_id, idempotency_key));
create or replace function public.cs_select_group_beds(p_inst uuid, p_group uuid, p_group_version int, p_beds uuid[], p_seen_version int, p_period tstzrange, p_key text)
returns setof public.cs_occupancy_assignments language plpgsql security definer set search_path = public, pg_temp as $$
declare g public.cs_roommate_groups; m record; i int := 0; ordered uuid[]; prior public.cs_group_selections; a public.cs_occupancy_assignments; ids uuid[] := '{}';
begin
  select * into prior from public.cs_group_selections where institution_id = p_inst and idempotency_key = p_key;
  if found then
    if prior.group_id <> p_group or prior.beds <> (select array_agg(x order by x) from unnest(p_beds) x) then raise exception 'idempotency key reused with a different selection' using errcode = '22023'; end if;
    return query select * from public.cs_occupancy_assignments where id = any(prior.assignment_ids);
    return;
  end if;
  select * into g from public.cs_roommate_groups where id = p_group and institution_id = p_inst for update;
  if g.version <> p_group_version then raise exception 'group changed since selection (v% ≠ v%)', p_group_version, g.version using errcode = '40001'; end if;
  if exists (select 1 from public.cs_roommate_memberships where group_id = p_group and (accepted_at is null or accepted_group_version <> g.version)) then
    raise exception 'every member must accept the current group (v%)', g.version using errcode = '23514'; end if;
  if array_length(p_beds,1) <> (select count(*) from public.cs_roommate_memberships where group_id = p_group) then raise exception 'one bed per member' using errcode = '22023'; end if;
  select array_agg(x order by x) into ordered from unnest(p_beds) x;
  perform 1 from public.cs_bed_spaces where id = any(ordered) order by id for update;   -- stable lock order
  for m in select student_id from public.cs_roommate_memberships where group_id = p_group order by student_id loop
    i := i + 1;
    a := public.cs_select_bed(p_inst, ordered[i], m.student_id, p_seen_version, p_period);  -- any failure aborts the whole transaction
    ids := ids || a.id; return next a;
  end loop;
  insert into public.cs_group_selections values (p_inst, p_key, p_group, g.version, ordered, ids, now());
end $$;
revoke execute on function public.cs_select_group_beds(uuid,uuid,int,uuid[],int,tstzrange,text) from public, anon, authenticated;

-- Reservation release: never while a deposit payment's outcome is unknown.
create or replace function public.cs_release_expired_reservations(p_inst uuid) returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  update public.cs_occupancy_assignments a set status = 'cancelled'
   where a.institution_id = p_inst and a.status = 'reserved' and a.reserved_until < now()
     and not exists (select 1 from public.cs_payment_attempts p where p.reference = a.id::text and p.status in ('processing','outcome_unknown','confirmed'));
  get diagnostics n = row_count; return n;
end $$;

-- Entitlement lots: consumption earliest-expiry first; rollover = linked transfer + expiration entries.
alter table public.cs_entitlements add column if not exists term text, add column if not exists rolled_from uuid references public.cs_entitlements(id), add column if not exists closed_at timestamptz;
create table if not exists public.cs_rollover_runs (
  institution_id uuid not null, source_lot uuid not null references public.cs_entitlements(id), policy_version text not null,
  transferred bigint not null default 0, expired bigint not null default 0, held_for_pending bigint not null default 0, ran_at timestamptz not null default now(),
  primary key (institution_id, source_lot, policy_version));   -- idempotent per lot × policy version

-- Payment attempts: confirmation, settlement and ledger posting are separate facts.
create table if not exists public.cs_payment_attempts (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null, student_id uuid not null, reference text not null,
  amount_minor bigint not null check (amount_minor > 0), currency text not null default 'usd',
  status text not null check (status in ('created','action_required','processing','confirmed','failed','cancelled','outcome_unknown')),
  settlement text not null default 'pending' check (settlement in ('pending','settled','reversed')),
  ledger_posting text not null default 'none' check (ledger_posting in ('none','posted','failed_retrying')),
  provider_object text, idempotency_key text not null, created_at timestamptz not null default now(),
  unique (institution_id, idempotency_key));
create table if not exists public.cs_provider_events (institution_id uuid not null, provider_event_id text not null, received_at timestamptz not null default now(), primary key (institution_id, provider_event_id));  -- duplicate callbacks no-op

-- Credit-balance obligations: classification, recipient, deadline basis; closed only on accepted delivery.
create table if not exists public.cs_credit_balance_obligations (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null, student_id uuid not null, payment_period text not null,
  kind text not null check (kind in ('overpayment','tuition_refund','housing_dining_credit','title_iv','r2t4','sponsor','dispute_reversal')),
  amount_minor bigint not null check (amount_minor > 0), calculation_version text not null,
  created_on date not null, classes_start date, auth_cancelled_notice date, due_on date not null, due_basis text not null,
  recipient text not null, responsible_officer uuid not null,
  status text not null default 'open' check (status in ('open','approved','dispatched','delivery_rejected','closed')),
  delivery_ref text, closed_at timestamptz,
  constraint closed_needs_delivery check (status <> 'closed' or (delivery_ref is not null and closed_at is not null)));

-- Title IV credit-balance deadline (2026–27 FSA Handbook Vol 4 Ch 2), absent an applicable authorization to hold.
-- The aid office confirms applicability per case; withdrawals use the separate R2T4 workflow.
create or replace function public.cs_title_iv_due(p_created date, p_classes_start date, p_auth_cancelled date default null)
returns table (due_on date, basis text) language sql immutable as $$
  select case when p_auth_cancelled is not null then p_auth_cancelled + 14
              when p_created >= p_classes_start then p_created + 14 else p_classes_start + 14 end,
         case when p_auth_cancelled is not null then '14 days after notice the hold authorization was cancelled'
              when p_created >= p_classes_start then '14 days after creation (classes had begun)'
              else '14 days after the first day of class (created before classes began)' end $$;

do $$ declare t text; begin foreach t in array array['cs_allocation_runs','cs_group_selections','cs_roommate_groups','cs_roommate_memberships','cs_rollover_runs','cs_payment_attempts','cs_provider_events','cs_credit_balance_obligations'] loop
  execute format('alter table public.%I enable row level security', t); execute format('alter table public.%I force row level security', t);
  execute format('revoke all on public.%I from anon', t); end loop; end $$;

-- Checks (run on a branch): expected values from the design-project test of the same rule.
-- select * from cs_title_iv_due('2026-08-20','2026-08-24');            -- 2026-09-07, before classes
-- select * from cs_title_iv_due('2026-09-03','2026-08-24');            -- 2026-09-17, after classes began
-- select * from cs_title_iv_due('2026-08-20','2026-08-24','2026-10-01'); -- 2026-10-15, authorization cancelled

-- ── Idempotent single-bed selection (AT002 for beds). One transaction: lock, select, record key + payload digest. ──
create table if not exists public.cs_bed_selections (
  institution_id uuid not null, idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  payload_sha256 text not null, assignment_id uuid not null references public.cs_occupancy_assignments(id), created_at timestamptz not null default now(),
  primary key (institution_id, idempotency_key));
alter table public.cs_bed_selections enable row level security; alter table public.cs_bed_selections force row level security; revoke all on public.cs_bed_selections from anon;
create or replace function public.cs_select_bed_once(p_inst uuid, p_bed uuid, p_student uuid, p_seen_version int, p_period tstzrange, p_key text)
returns public.cs_occupancy_assignments language plpgsql security definer set search_path = public, pg_temp as $$
declare h text := encode(sha256(convert_to(p_bed::text||'|'||p_student::text||'|'||p_period::text,'UTF8')),'hex'); prior public.cs_bed_selections; a public.cs_occupancy_assignments;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_inst::text||p_key, 0));   -- serialize concurrent retries of one key
  select * into prior from public.cs_bed_selections where institution_id = p_inst and idempotency_key = p_key;
  if found then
    if prior.payload_sha256 <> h then raise exception 'idempotency key reused with a different selection' using errcode = '22023'; end if;
    select * into a from public.cs_occupancy_assignments where id = prior.assignment_id; return a;
  end if;
  a := public.cs_select_bed(p_inst, p_bed, p_student, p_seen_version, p_period);
  insert into public.cs_bed_selections values (p_inst, p_key, h, a.id, now());
  insert into public.live_outbox(institution_id, aggregate, event, payload) values (p_inst, 'housing', 'housing.bed_reserved', jsonb_build_object('assignment_id', a.id, 'bed_id', p_bed));
  return a;
end $$;
revoke execute on function public.cs_select_bed_once(uuid,uuid,uuid,int,tstzrange,text) from public, anon, authenticated;
grant execute on function public.cs_select_bed_once(uuid,uuid,uuid,int,tstzrange,text) to service_role;

-- New capability names for the campus command function (extends live_integration's check).
alter table public.live_tenant_capabilities drop constraint if exists live_tenant_capabilities_capability_check;
alter table public.live_tenant_capabilities add constraint live_tenant_capabilities_capability_check check (capability in
  ('auth.sso','sis.read','lms.lti','payments.checkout','messaging.send','writes.registration','writes.grades','writes.records','campus.housing','campus.dining'));

-- Service role executes the campus writers (EXECUTE was revoked from PUBLIC, which service_role otherwise inherits).
grant execute on function public.cs_select_bed(uuid,uuid,uuid,int,tstzrange,interval) to service_role;
grant execute on function public.cs_redeem(uuid,uuid,bigint,text,text) to service_role;
grant execute on function public.cs_select_group_beds(uuid,uuid,int,uuid[],int,tstzrange,text) to service_role;
