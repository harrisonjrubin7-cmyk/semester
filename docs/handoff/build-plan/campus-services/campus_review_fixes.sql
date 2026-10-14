-- Campus Operations Core, part 3: fixes from the Housing Validation Review (MASTER_REVIEW.md, 10 findings).
-- PROPOSED, NOT RUN. Apply after campus_services_invariants.sql and campus_operations_core.sql.
-- Authorization model (decided 2026-10-14): READS through scoped RLS policies; WRITES only through security-definer
-- command functions owned by a dedicated role. Clients get no insert/update/delete policies. See ../AUTHZ-DECISION.md.

-- ── P1: closures retire cleanly. Kind is fixed at creation; the student-null rule follows kind, not mutable status.
alter table public.cs_occupancy_assignments add column if not exists claim_kind text not null default 'student' check (claim_kind in ('student','closure'));
update public.cs_occupancy_assignments set claim_kind = 'closure' where status = 'blocked' and student_id is null;
alter table public.cs_occupancy_assignments drop constraint if exists closure_has_no_student;
alter table public.cs_occupancy_assignments
  add constraint kind_matches_student check ((claim_kind = 'closure') = (student_id is null)),
  add constraint closure_states check (claim_kind = 'student' or status in ('blocked','ended','cancelled')),
  add constraint student_never_blocked check (claim_kind = 'closure' or status <> 'blocked');
create or replace function public.cs_claim_kind_fixed() returns trigger language plpgsql as $$
begin if new.claim_kind <> old.claim_kind or new.institution_id <> old.institution_id or new.bed_id <> old.bed_id or new.student_id is distinct from old.student_id then
  raise exception 'claim kind, institution, bed and student are fixed after creation; cancel and create a new claim'; end if; return new; end $$;
drop trigger if exists cs_claim_kind_fixed on public.cs_occupancy_assignments;
create trigger cs_claim_kind_fixed before update on public.cs_occupancy_assignments for each row execute function public.cs_claim_kind_fixed();

-- ── P0: correspondence. Contract version must belong to the same institution AND student, and cover the period.
create table if not exists public.cs_contract_versions (
  institution_id uuid not null, id uuid not null default gen_random_uuid(), student_id uuid not null,
  period tstzrange not null, terms_sha256 text not null, policy_version text not null, accepted_at timestamptz, accepted_by uuid,
  primary key (institution_id, id), unique (institution_id, id, student_id),
  constraint self_accepted check (accepted_at is null or accepted_by = student_id));
alter table public.cs_occupancy_assignments
  add constraint contract_same_student foreign key (institution_id, contract_version_id, student_id)
  references public.cs_contract_versions (institution_id, id, student_id);   -- forged contract id for another student or school fails here

-- ── P0: lifecycle. Assigned/active needs an accepted, matching contract; confirmation refuses an expired reservation.
alter table public.cs_occupancy_assignments
  add constraint confirmed_has_contract check (claim_kind = 'closure' or status not in ('assigned','active') or contract_version_id is not null);
create or replace function public.cs_confirm_assignment(p_inst uuid, p_assignment uuid, p_contract uuid)
returns public.cs_occupancy_assignments language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.cs_occupancy_assignments; c public.cs_contract_versions;
begin
  select * into a from public.cs_occupancy_assignments where institution_id = p_inst and id = p_assignment for update;  -- same lock the expiry worker takes
  if not found then raise exception 'assignment not found' using errcode = 'P0002'; end if;
  if a.status = 'assigned' and a.contract_version_id = p_contract then return a; end if;               -- idempotent retry
  if a.status <> 'reserved' then raise exception 'only a reserved claim can be confirmed (is %)', a.status using errcode = '23514'; end if;
  if a.reserved_until < now() then raise exception 'reservation expired at %', a.reserved_until using errcode = '23514'; end if;
  select * into c from public.cs_contract_versions where institution_id = p_inst and id = p_contract and student_id = a.student_id;
  if not found then raise exception 'contract does not belong to this student' using errcode = '23503'; end if;
  if c.accepted_at is null then raise exception 'contract not accepted' using errcode = '23514'; end if;
  if not (c.period @> a.period) then raise exception 'contract period does not cover the assignment' using errcode = '23514'; end if;
  update public.cs_occupancy_assignments set status = 'assigned', contract_version_id = p_contract, reserved_until = null where id = a.id returning * into a;
  insert into public.live_outbox (institution_id, aggregate, event, payload) values (p_inst, 'housing', 'housing.assignment.confirmed', jsonb_build_object('assignment', a.id, 'contract', p_contract));
  return a;
end $$;
alter table public.cs_occupancy_assignments drop constraint if exists reservation_expires;
alter table public.cs_occupancy_assignments add constraint reservation_expires check (status <> 'reserved' or reserved_until is not null);   -- unchanged; confirmed rows clear it

-- Expiry worker uses the same row lock, so it can't race confirmation. A confirmed claim is never auto-expired.
create or replace function public.cs_expire_reservations(p_inst uuid) returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  update public.cs_occupancy_assignments a set status = 'cancelled'
   where a.id in (select id from public.cs_occupancy_assignments where institution_id = p_inst and status = 'reserved' and reserved_until < now() for update skip locked)
     and not exists (select 1 from public.cs_payment_attempts p where p.reference = a.id::text and p.status in ('processing','outcome_unknown','confirmed'));
  get diagnostics n = row_count; return n;
end $$;

-- ── P0: authorization (reads). Scoped read policies; no client write policies anywhere.
alter table public.cs_contract_versions enable row level security; alter table public.cs_contract_versions force row level security;
revoke all on public.cs_contract_versions from anon;
create policy cs_own_contracts on public.cs_contract_versions for select to authenticated using (student_id = auth.uid());
create policy cs_own_claims on public.cs_occupancy_assignments for select to authenticated using (student_id = auth.uid());
create policy cs_staff_claims on public.cs_occupancy_assignments for select to authenticated using (exists (
  select 1 from public.live_workspace_grants g where g.user_id = auth.uid() and g.institution_id = cs_occupancy_assignments.institution_id
    and g.workspace = 'student_affairs' and (g.valid_until is null or g.valid_until > now())));
grant select on public.cs_contract_versions, public.cs_occupancy_assignments to authenticated;

-- ── Writes: one dedicated owner for every definer function, never a login role. Execute only for service_role.
do $$ begin if not exists (select 1 from pg_roles where rolname = 'semester_writer') then create role semester_writer nologin bypassrls; end if; end $$;
grant semester_writer to current_user;   -- needed to hand functions to it; creator must itself have BYPASSRLS (Supabase: run as postgres)
grant usage on schema public to semester_writer;
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' and (tablename like 'cs\_%' or tablename in ('live_outbox','live_command_receipts')) loop
    execute format('grant select, insert, update on public.%I to semester_writer', t);
  end loop; end $$;
grant usage on all sequences in schema public to semester_writer;
do $$ declare f regprocedure; begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'cs\_%' and p.prosecdef loop
    execute format('alter function %s owner to semester_writer', f);
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop; end $$;

-- ── Runtime role check (fails the migration if the browser role could bypass RLS or write directly)
do $$ begin
  if (select rolbypassrls from pg_roles where rolname = 'authenticated') then raise exception 'authenticated must not bypass RLS'; end if;
  if has_table_privilege('authenticated', 'public.cs_occupancy_assignments', 'insert,update,delete') then raise exception 'authenticated has direct write on claims'; end if;
end $$;
