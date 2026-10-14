-- Multi-pool capacity (physical, cross-list, reserved, linked component). Replaces the single counter in 100 for real scheduling.
create table registrar.capacity_pools (
  institution_id uuid not null, id uuid not null default gen_random_uuid(),
  kind text not null check (kind in ('physical','cross_list','reserved','linked_component')),
  label text not null, capacity int not null check (capacity >= 0), used int not null default 0, held int not null default 0,
  eligibility_rule jsonb, -- e.g. reserved for program X
  primary key (institution_id, id),
  constraint pool_not_over check (used + held <= capacity)
);
create table registrar.section_pools (
  institution_id uuid not null, section_id uuid not null, pool_id uuid not null,
  primary key (institution_id, section_id, pool_id),
  foreign key (institution_id, section_id) references registrar.sections (institution_id, id),
  foreign key (institution_id, pool_id) references registrar.capacity_pools (institution_id, id)
);
create table registrar.seat_offers (
  institution_id uuid not null, id uuid not null default gen_random_uuid(), waitlist_entry_id uuid not null, section_id uuid not null,
  expires_at timestamptz not null, status text not null default 'open' check (status in ('open','accepted','expired','withdrawn')),
  primary key (institution_id, id)
);
-- Take a seat in every pool a section consumes. Locks pools in id order so two transactions never deadlock.
create or replace function registrar.claim_seat(p_inst uuid, p_section uuid) returns void language plpgsql security definer set search_path = registrar, pg_temp as $$
declare r record;
begin
  for r in select p.id from capacity_pools p join section_pools sp on sp.institution_id = p.institution_id and sp.pool_id = p.id
           where sp.institution_id = p_inst and sp.section_id = p_section order by p.id for update of p loop
    update capacity_pools set used = used + 1 where institution_id = p_inst and id = r.id; -- CHECK raises when full
  end loop;
end $$;
-- Expired offers release their hold (run by a worker every minute).
create or replace function registrar.expire_offers() returns int language plpgsql security definer set search_path = registrar, pg_temp as $$
declare n int;
begin
  with x as (update seat_offers set status = 'expired' where status = 'open' and expires_at < now() returning institution_id, section_id)
  update capacity_pools p set held = held - 1 from section_pools sp, x where sp.institution_id = x.institution_id and sp.section_id = x.section_id and p.institution_id = sp.institution_id and p.id = sp.pool_id;
  get diagnostics n = row_count; return n;
end $$;
revoke execute on function registrar.claim_seat, registrar.expire_offers from public, anon, authenticated;
