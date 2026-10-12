-- The access saga's policy administrator and enforcement point, in Postgres
-- (packages/institution/src/access-saga.ts, `Services`: prepare, install,
-- inspect, revokePa, removePep, verifyCleanup).
--
-- The runner has had a store since 20261006180000 and a scheduled tick since
-- 20261012040000, and no participant: the registry
-- (app/server/institution/access-saga-registry.ts) holds null. This migration
-- is the two participants a grant passes through, held where the saga already
-- is, so the one property the runner states and cannot show — the revocation
-- barrier — is a row the same transaction checks, not a promise about a remote
-- system. The policy decision point (`validate`, `evaluate`) is not here; it is
-- `decide` in policy.ts, wired in a later change.
--
-- Four tables, all service-only as the saga tables are (row level security on,
-- no policy, every privilege revoked from `public`, `anon` and `authenticated`);
-- six `security definer` functions, execute for `service_role` alone.
--
--   access_grants              the administrator's record of a grant it prepared:
--                              one per (saga, generation); `prepared`, then
--                              `superseded` by a later generation or `revoked`
--   access_revocations         the barrier: per saga, the highest generation
--                              revoked. It only ever rises. An installation whose
--                              generation is at or below it is refused, however
--                              late it arrives
--   access_enforcements        the enforcement point's record of what it holds:
--                              one per grant, removed by setting `removed_at`,
--                              never resurrected
--   access_operation_receipts  the first outcome of each successful operation by
--                              its key, so a call repeated under the same key
--                              returns what the first returned and does nothing
--                              again. Refusals are not recorded: a barrier only
--                              rises and an expiry only passes, so a refusal
--                              repeats on its own
--
-- What the Services contract asks for, and where it is held here:
--
--   prepare        refuses a saga with no decision (SC422) and a generation the
--                  barrier covers (SC423); supersedes every earlier generation's
--                  prepared grant of the same saga; the grant's id is a function
--                  of (saga, generation), so the successor of a worker that died
--                  after preparing finds the same grant under the same key
--   install        refuses a grant it does not know (SC404), one revoked or
--                  behind the barrier (SC423), one superseded (SC409) and one past
--                  its expiry (SC410); an enforcement once removed is not
--                  installed again (SC423)
--   inspect        `installed` when the grant's enforcement is held and current;
--                  `conflict` when the point holds a different grant of the same
--                  saga; otherwise `absent`, which is authoritative: this point
--                  is the system of record for what it enforces
--   revoke_pa      raises the barrier to the generation given and revokes every
--                  prepared or superseded grant at or below it, whether or not
--                  the saga row ever learned a grant id; always `confirmed`
--   remove_pep     removes every enforcement of the saga; always `confirmed`
--   verify_cleanup `paRevoked` once the barrier covers the generation and no
--                  grant at or below it is still `prepared`; `pepAbsent` once no
--                  enforcement of the saga is held
--
-- SQLSTATEs: SC404 unknown grant, SC409 superseded, SC410 expired, SC422 no
-- decision, SC423 revoked or behind the barrier. Anything else is a storage
-- failure, and the adapter (postgres-access-participants.ts) says so.
--
-- access-participants.check.sql proves the above, the barrier first. Rollback: a
-- forward migration that drops the six functions and the four tables; nothing
-- else depends on them.

-- ── The administrator ───────────────────────────────────────────────────

create table if not exists public.access_grants (
  id                   text primary key check (length(id) between 1 and 300),
  saga_id              text not null references public.access_sagas (id),
  tenant_id            text not null check (length(tenant_id) between 1 and 200),
  subject_id           text not null check (length(subject_id) between 1 and 200),
  intent_resource_id   text not null check (length(intent_resource_id) between 1 and 200),
  intent_action        text not null
                       check (intent_action in ('registration.readiness.view', 'registration.override.request', 'registration.override.approve')),
  generation           integer not null check (generation >= 0),
  decision_id          text not null check (length(decision_id) between 1 and 200),
  expires_at           bigint not null,
  status               text not null default 'prepared' check (status in ('prepared', 'superseded', 'revoked')),
  prepared_at          timestamptz not null default now(),
  revoked_at           timestamptz,
  constraint access_grants_one_per_generation unique (saga_id, generation),
  constraint access_grants_revoked_at_pair check ((status = 'revoked') = (revoked_at is not null))
);
alter table public.access_grants enable row level security;
revoke all on public.access_grants from public, anon, authenticated;

create table if not exists public.access_revocations (
  saga_id             text primary key references public.access_sagas (id),
  through_generation  integer not null check (through_generation >= 0),
  revoked_at          timestamptz not null default now()
);
alter table public.access_revocations enable row level security;
revoke all on public.access_revocations from public, anon, authenticated;

-- ── The enforcement point ───────────────────────────────────────────────

create table if not exists public.access_enforcements (
  grant_id      text primary key references public.access_grants (id),
  saga_id       text not null references public.access_sagas (id),
  tenant_id     text not null,
  subject_id    text not null,
  resource_id   text not null,
  action        text not null,
  expires_at    bigint not null,
  installed_at  timestamptz not null default now(),
  removed_at    timestamptz
);
create index if not exists access_enforcements_saga_id on public.access_enforcements (saga_id);
create index if not exists access_enforcements_saga_live on public.access_enforcements (saga_id) where removed_at is null;
alter table public.access_enforcements enable row level security;
revoke all on public.access_enforcements from public, anon, authenticated;

-- ── The receipts ────────────────────────────────────────────────────────

create table if not exists public.access_operation_receipts (
  operation_key  text primary key check (length(operation_key) between 1 and 600),
  saga_id        text not null references public.access_sagas (id),
  operation      text not null check (operation in ('prepare', 'install', 'revoke_pa', 'remove_pep')),
  result         jsonb not null,
  recorded_at    timestamptz not null default now()
);
create index if not exists access_operation_receipts_saga_id on public.access_operation_receipts (saga_id);
alter table public.access_operation_receipts enable row level security;
revoke all on public.access_operation_receipts from public, anon, authenticated;

-- ── What the rows may do ────────────────────────────────────────────────

create or replace function private.access_grants_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'access_grants is not deleted from.'; end if;
  if new.id is distinct from old.id or new.saga_id is distinct from old.saga_id or new.generation is distinct from old.generation
     or new.tenant_id is distinct from old.tenant_id or new.subject_id is distinct from old.subject_id
     or new.intent_resource_id is distinct from old.intent_resource_id or new.intent_action is distinct from old.intent_action
     or new.decision_id is distinct from old.decision_id or new.expires_at is distinct from old.expires_at
     or new.prepared_at is distinct from old.prepared_at then
    raise exception 'An access grant keeps the identity it was prepared with.';
  end if;
  if old.status = 'revoked' and new.status <> 'revoked' then
    raise exception 'A revoked access grant stays revoked.';
  end if;
  if old.status = 'superseded' and new.status = 'prepared' then
    raise exception 'A superseded access grant is not prepared again.';
  end if;
  return new;
end $$;
drop trigger if exists access_grants_guard on public.access_grants;
create trigger access_grants_guard before update or delete on public.access_grants
  for each row execute function private.access_grants_guard();

create or replace function private.access_revocations_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'A revocation barrier is not removed.'; end if;
  if new.saga_id is distinct from old.saga_id then raise exception 'A revocation barrier keeps its saga.'; end if;
  if new.through_generation < old.through_generation then
    raise exception 'A revocation barrier only rises: % is below %.', new.through_generation, old.through_generation;
  end if;
  return new;
end $$;
drop trigger if exists access_revocations_guard on public.access_revocations;
create trigger access_revocations_guard before update or delete on public.access_revocations
  for each row execute function private.access_revocations_guard();

create or replace function private.access_enforcements_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'access_enforcements is not deleted from; an enforcement is removed by removed_at.'; end if;
  if new.grant_id is distinct from old.grant_id or new.saga_id is distinct from old.saga_id
     or new.tenant_id is distinct from old.tenant_id or new.subject_id is distinct from old.subject_id
     or new.resource_id is distinct from old.resource_id or new.action is distinct from old.action
     or new.expires_at is distinct from old.expires_at or new.installed_at is distinct from old.installed_at then
    raise exception 'An enforcement keeps the grant it was installed from.';
  end if;
  if old.removed_at is not null and new.removed_at is distinct from old.removed_at then
    raise exception 'A removed enforcement is not reinstated.';
  end if;
  return new;
end $$;
drop trigger if exists access_enforcements_guard on public.access_enforcements;
create trigger access_enforcements_guard before update or delete on public.access_enforcements
  for each row execute function private.access_enforcements_guard();

create or replace function private.access_operation_receipts_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'access_operation_receipts is append-only.';
end $$;
drop trigger if exists access_operation_receipts_guard on public.access_operation_receipts;
create trigger access_operation_receipts_guard before update or delete on public.access_operation_receipts
  for each row execute function private.access_operation_receipts_guard();

-- ── The participants ────────────────────────────────────────────────────

create or replace function private.access_now_ms()
returns bigint language sql stable set search_path = '' as $$
  select (extract(epoch from clock_timestamp()) * 1000)::bigint;
$$;

-- The administrator prepares a grant for the saga's current generation, for
-- `p_ttl_ms` from now (at most a day). Idempotent by key.
create or replace function public.access_pa_prepare(p_key text, p_saga_id text, p_ttl_ms bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  cur public.access_sagas;
  g public.access_grants;
  barrier integer;
  receipt jsonb;
  gid text;
begin
  select result into receipt from public.access_operation_receipts where operation_key = p_key;
  if found then return receipt; end if;
  if p_ttl_ms is null or p_ttl_ms < 1 or p_ttl_ms > 86400000 then
    raise exception 'A grant lasts between 1 ms and a day.';
  end if;

  select * into cur from public.access_sagas where id = p_saga_id;
  if not found then raise exception 'No such access saga.' using errcode = 'SC404'; end if;
  if cur.decision_id is null then
    raise exception 'The saga has no decision to prepare a grant from.' using errcode = 'SC422';
  end if;
  select through_generation into barrier from public.access_revocations where saga_id = p_saga_id;
  if barrier is not null and barrier >= cur.generation then
    raise exception 'Generation % of saga % is revoked (barrier at %).', cur.generation, p_saga_id, barrier using errcode = 'SC423';
  end if;

  -- A later generation supersedes every earlier grant still standing.
  update public.access_grants set status = 'superseded'
   where saga_id = p_saga_id and generation < cur.generation and status = 'prepared';

  gid := 'grant:' || p_saga_id || ':' || cur.generation;
  insert into public.access_grants (id, saga_id, tenant_id, subject_id, intent_resource_id, intent_action, generation, decision_id, expires_at)
  values (gid, p_saga_id, cur.tenant_id, cur.subject_id, cur.intent_resource_id, cur.intent_action, cur.generation, cur.decision_id,
          private.access_now_ms() + p_ttl_ms)
  on conflict (saga_id, generation) do nothing;
  select * into g from public.access_grants where saga_id = p_saga_id and generation = cur.generation;
  if g.status = 'revoked' then
    raise exception 'Grant % is revoked.', g.id using errcode = 'SC423';
  end if;

  receipt := jsonb_build_object('id', g.id, 'expiresAt', g.expires_at);
  insert into public.access_operation_receipts (operation_key, saga_id, operation, result) values (p_key, p_saga_id, 'prepare', receipt);
  return receipt;
end $$;

-- The enforcement point installs the grant the saga names. Idempotent by key.
create or replace function public.access_pep_install(p_key text, p_saga_id text, p_grant_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  g public.access_grants;
  e public.access_enforcements;
  barrier integer;
begin
  if exists (select 1 from public.access_operation_receipts where operation_key = p_key) then return; end if;

  select * into g from public.access_grants where id = p_grant_id and saga_id = p_saga_id;
  if not found then raise exception 'No such grant % for saga %.', p_grant_id, p_saga_id using errcode = 'SC404'; end if;
  select through_generation into barrier from public.access_revocations where saga_id = p_saga_id;
  if g.status = 'revoked' or (barrier is not null and barrier >= g.generation) then
    raise exception 'Grant % is revoked (generation %, barrier at %).', g.id, g.generation, coalesce(barrier::text, 'none') using errcode = 'SC423';
  end if;
  if g.status = 'superseded' then
    raise exception 'Grant % was superseded by a later generation.', g.id using errcode = 'SC409';
  end if;
  if g.expires_at <= private.access_now_ms() then
    raise exception 'Grant % expired.', g.id using errcode = 'SC410';
  end if;

  select * into e from public.access_enforcements where grant_id = g.id;
  if found and e.removed_at is not null then
    raise exception 'The enforcement of grant % was removed and is not reinstated.', g.id using errcode = 'SC423';
  end if;
  if not found then
    insert into public.access_enforcements (grant_id, saga_id, tenant_id, subject_id, resource_id, action, expires_at)
    values (g.id, g.saga_id, g.tenant_id, g.subject_id, g.intent_resource_id, g.intent_action, g.expires_at);
  end if;
  insert into public.access_operation_receipts (operation_key, saga_id, operation, result) values (p_key, p_saga_id, 'install', 'null'::jsonb);
end $$;

-- What the enforcement point holds for this saga: installed, conflict or absent.
create or replace function public.access_pep_inspect(p_saga_id text, p_grant_id text)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when p_grant_id is not null and exists (
      select 1 from public.access_enforcements
       where grant_id = p_grant_id and saga_id = p_saga_id and removed_at is null and expires_at > private.access_now_ms())
      then 'installed'
    when exists (
      select 1 from public.access_enforcements
       where saga_id = p_saga_id and removed_at is null and expires_at > private.access_now_ms()
         and (p_grant_id is null or grant_id <> p_grant_id))
      then 'conflict'
    else 'absent'
  end;
$$;

-- The administrator revokes by saga and generation: every generation up to the
-- one given, whether or not any grant was ever recorded on the saga row. The
-- barrier is what makes a late installation fail. Idempotent by key.
create or replace function public.access_pa_revoke(p_key text, p_saga_id text, p_generation integer)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.access_operation_receipts where operation_key = p_key) then return 'confirmed'; end if;
  if p_generation is null or p_generation < 0 then raise exception 'A generation is not negative.'; end if;
  if not exists (select 1 from public.access_sagas where id = p_saga_id) then
    raise exception 'No such access saga.' using errcode = 'SC404';
  end if;
  insert into public.access_revocations (saga_id, through_generation) values (p_saga_id, p_generation)
  on conflict (saga_id) do update
    set through_generation = greatest(public.access_revocations.through_generation, excluded.through_generation),
        revoked_at = clock_timestamp();
  update public.access_grants set status = 'revoked', revoked_at = clock_timestamp()
   where saga_id = p_saga_id and generation <= p_generation and status <> 'revoked';
  insert into public.access_operation_receipts (operation_key, saga_id, operation, result) values (p_key, p_saga_id, 'revoke_pa', '"confirmed"'::jsonb);
  return 'confirmed';
end $$;

-- The enforcement point removes everything it holds for the saga. Idempotent by key.
create or replace function public.access_pep_remove(p_key text, p_saga_id text)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.access_operation_receipts where operation_key = p_key) then return 'confirmed'; end if;
  if not exists (select 1 from public.access_sagas where id = p_saga_id) then
    raise exception 'No such access saga.' using errcode = 'SC404';
  end if;
  update public.access_enforcements set removed_at = clock_timestamp() where saga_id = p_saga_id and removed_at is null;
  insert into public.access_operation_receipts (operation_key, saga_id, operation, result) values (p_key, p_saga_id, 'remove_pep', '"confirmed"'::jsonb);
  return 'confirmed';
end $$;

-- Both sides of the cleanup, each on its own.
create or replace function public.access_cleanup_verify(p_saga_id text, p_generation integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'paRevoked', exists (select 1 from public.access_revocations where saga_id = p_saga_id and through_generation >= p_generation)
                 and not exists (select 1 from public.access_grants where saga_id = p_saga_id and generation <= p_generation and status = 'prepared'),
    'pepAbsent', not exists (select 1 from public.access_enforcements where saga_id = p_saga_id and removed_at is null)
  );
$$;

revoke all on function public.access_pa_prepare(text, text, bigint) from public, anon, authenticated;
revoke all on function public.access_pep_install(text, text, text) from public, anon, authenticated;
revoke all on function public.access_pep_inspect(text, text) from public, anon, authenticated;
revoke all on function public.access_pa_revoke(text, text, integer) from public, anon, authenticated;
revoke all on function public.access_pep_remove(text, text) from public, anon, authenticated;
revoke all on function public.access_cleanup_verify(text, integer) from public, anon, authenticated;
revoke all on function private.access_now_ms() from public, anon, authenticated;
grant execute on function public.access_pa_prepare(text, text, bigint) to service_role;
grant execute on function public.access_pep_install(text, text, text) to service_role;
grant execute on function public.access_pep_inspect(text, text) to service_role;
grant execute on function public.access_pa_revoke(text, text, integer) to service_role;
grant execute on function public.access_pep_remove(text, text) to service_role;
grant execute on function public.access_cleanup_verify(text, integer) to service_role;
