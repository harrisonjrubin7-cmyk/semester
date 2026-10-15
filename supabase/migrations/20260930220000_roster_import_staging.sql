-- A roster import lands in a staging area, is validated against its manifest,
-- is held when it would remove too much, and can be rolled back (D-160).
--
-- This is the **foundation** for OneRoster CSV and REST roster imports, and
-- nothing more. It has no OneRoster client, makes no network call, reads no
-- SIS, and nothing in the app reads `private.roster_current` yet: EDT-6 in
-- docs/FERPA-COPPA-1EDTECH-READINESS.md stays NOT_STARTED, and no page may say
-- Semester supports OneRoster until a real import has run against a real
-- sandbox. What it fixes is the shape a future import must take, so that the
-- first one cannot write straight into live rows.
--
-- ## The rules, each one a function or a constraint here
--
--   * **Per tenant, server-only.** Every table is in `private`, has row-level
--     security and no policy, and grants no client role anything. Every
--     function takes its tenant from the batch row it is handed, never from a
--     parameter that could disagree with it, and is executable by no client
--     role. Credentials are a pointer (`vault:`, `env:`, `secret-manager:`),
--     never a secret, and the column is unreadable to clients because the
--     table is.
--   * **Staged, not written.** `roster_stage` writes `roster_staged_row` only.
--     Live rows (`roster_current`) change in exactly one place, `roster_promote`.
--   * **Closed row shape.** An entity is one of four, a row's keys are an
--     allowlist per entity, and nothing outside it is stored: no grade,
--     no email, no date of birth, no free text. A roster import is minimum
--     data by construction.
--   * **Manifest.** A batch names its files, their row counts and a content
--     digest; `roster_validate` refuses a batch whose staged rows disagree, and
--     one that lists a file it has no rows for, or rows for a file it does not
--     list. Enrollments must point at staged users and classes.
--   * **Idempotent.** A batch is identified by (tenant, manifest digest);
--     staging the same manifest again returns the first batch and stages nothing.
--     Promoting a promoted batch does nothing.
--   * **Delta threshold.** A batch that would remove more than the tenant's
--     `max_removal_pct` of its current roster (10 by default) is **held**, and
--     promotes only with an approver who is not the person who staged it.
--   * **Last known good.** Promotion copies the roster it replaces into
--     `roster_snapshot`; `roster_rollback` puts it back, for the most recent
--     promotion only, and refuses if a later one exists.
--
-- Idempotent. No begin/commit: the runner opens the transaction.

-- ── Configuration: one row per school ─────────────────────────────────────

create table if not exists private.roster_import_config (
  tenant_id text primary key references public.schools(id) on delete cascade,
  source_kind text not null check (source_kind in ('csv', 'rest')),
  -- Where a REST source's credential lives. Never the credential.
  credentials_reference text check (
    credentials_reference is null
    or credentials_reference ~ '^(vault|env|secret-manager):[A-Za-z0-9_./-]{1,200}$'
  ),
  -- A REST source without a reference is a source nobody can authenticate to.
  constraint roster_rest_needs_reference check (source_kind = 'csv' or credentials_reference is not null),
  max_removal_pct integer not null default 10 check (max_removal_pct between 0 and 100),
  updated_at timestamptz not null default now()
);

-- ── Batches ───────────────────────────────────────────────────────────────

create table if not exists private.roster_import_batch (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.schools(id) on delete cascade,
  source_kind text not null check (source_kind in ('csv', 'rest')),
  -- { "files": [ { "entity": "users", "rows": 120, "sha256": "<hex>" }, … ] }
  manifest jsonb not null,
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'staged'
    check (status in ('staged', 'validated', 'held', 'promoted', 'rejected', 'rolled_back')),
  problems jsonb not null default '[]'::jsonb,
  report jsonb,
  held_reason text,
  staged_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  promoted_at timestamptz,
  rolled_back_at timestamptz,
  unique (id, tenant_id),
  -- The idempotency key: one batch per tenant per manifest.
  unique (tenant_id, manifest_sha256)
);
create index if not exists roster_import_batch_by_tenant
  on private.roster_import_batch (tenant_id, created_at desc);
create index if not exists roster_import_batch_by_staged_by
  on private.roster_import_batch (staged_by) where staged_by is not null;
create index if not exists roster_import_batch_by_approved_by
  on private.roster_import_batch (approved_by) where approved_by is not null;

create table if not exists private.roster_staged_row (
  batch_id uuid not null,
  tenant_id text not null,
  entity text not null check (entity in ('orgs', 'users', 'classes', 'enrollments')),
  sourced_id text not null check (length(sourced_id) between 1 and 200),
  payload jsonb not null,
  row_hash text not null check (row_hash ~ '^[0-9a-f]{64}$'),
  primary key (batch_id, entity, sourced_id),
  foreign key (batch_id, tenant_id) references private.roster_import_batch (id, tenant_id) on delete cascade
);
create index if not exists roster_staged_row_by_batch on private.roster_staged_row (batch_id, tenant_id);

-- The live roster: what the last promotion left. Nothing reads it yet.
create table if not exists private.roster_current (
  tenant_id text not null references public.schools(id) on delete cascade,
  entity text not null check (entity in ('orgs', 'users', 'classes', 'enrollments')),
  sourced_id text not null,
  payload jsonb not null,
  row_hash text not null check (row_hash ~ '^[0-9a-f]{64}$'),
  batch_id uuid not null,
  primary key (tenant_id, entity, sourced_id),
  foreign key (batch_id, tenant_id) references private.roster_import_batch (id, tenant_id) on delete restrict
);
create index if not exists roster_current_by_batch on private.roster_current (batch_id, tenant_id);

-- The roster a promotion replaced: the last known good.
create table if not exists private.roster_snapshot (
  batch_id uuid not null,
  tenant_id text not null,
  entity text not null,
  sourced_id text not null,
  payload jsonb not null,
  row_hash text not null,
  -- The batch that had put this row in the live roster.
  origin_batch_id uuid not null,
  primary key (batch_id, entity, sourced_id),
  foreign key (batch_id, tenant_id) references private.roster_import_batch (id, tenant_id) on delete cascade
);
create index if not exists roster_snapshot_by_batch on private.roster_snapshot (batch_id, tenant_id);

alter table private.roster_import_config enable row level security;
alter table private.roster_import_batch enable row level security;
alter table private.roster_staged_row enable row level security;
alter table private.roster_current enable row level security;
alter table private.roster_snapshot enable row level security;

revoke all on private.roster_import_config, private.roster_import_batch, private.roster_staged_row,
  private.roster_current, private.roster_snapshot from public, anon, authenticated;

-- ── The closed row shape ──────────────────────────────────────────────────

-- The keys a row of each entity may carry. Anything else refuses the batch.
create or replace function private.roster_allowed_keys(want_entity text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case want_entity
    when 'orgs'        then array['name', 'type', 'status', 'parentSourcedId']
    when 'users'       then array['status', 'role', 'givenName', 'familyName', 'orgSourcedIds']
    when 'classes'     then array['title', 'courseCode', 'status', 'orgSourcedId', 'termSourcedId']
    when 'enrollments' then array['userSourcedId', 'classSourcedId', 'role', 'status']
  end;
$$;

-- What is wrong with one row, or null. Small and total: every branch returns.
create or replace function private.roster_row_problem(want_entity text, want_payload jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
begin
  if want_entity not in ('orgs', 'users', 'classes', 'enrollments') then return 'unknown entity'; end if;
  if jsonb_typeof(want_payload) is distinct from 'object' then return 'payload is not an object'; end if;
  for k in select jsonb_object_keys(want_payload) loop
    if not (k = any (private.roster_allowed_keys(want_entity))) then
      return 'key ' || k || ' is not allowed on ' || want_entity;
    end if;
  end loop;
  if want_entity = 'enrollments'
     and (coalesce(want_payload ->> 'userSourcedId', '') = '' or coalesce(want_payload ->> 'classSourcedId', '') = '') then
    return 'an enrollment names a user and a class';
  end if;
  if length(want_payload::text) > 4000 then return 'row is larger than 4000 characters'; end if;
  return null;
end;
$$;

-- Digest of an entity's staged rows: sha256 of the sorted row hashes, newline-joined.
create or replace function private.roster_entity_digest(want_batch uuid, want_entity text)
returns text
language sql
stable
set search_path = ''
as $$
  select encode(sha256(convert_to(
    coalesce(string_agg(row_hash, E'\n' order by row_hash), ''), 'UTF8')), 'hex')
    from private.roster_staged_row
   where batch_id = want_batch and entity = want_entity;
$$;

-- ── Stage ─────────────────────────────────────────────────────────────────

-- Stage a batch for a school. `want_rows` is an array of
-- { entity, sourcedId, payload }. Returns the batch id; the same manifest
-- staged again returns the first batch and stages nothing.
create or replace function private.roster_stage(
  want_tenant text,
  want_source text,
  want_manifest jsonb,
  want_rows jsonb,
  want_staged_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  digest text;
  batch uuid;
  r jsonb;
  problem text;
  bad jsonb := '[]'::jsonb;
  n integer := 0;
begin
  if not exists (select 1 from public.schools where id = want_tenant) then
    raise exception 'roster_stage: no such school' using errcode = '22023';
  end if;
  if want_source not in ('csv', 'rest') then
    raise exception 'roster_stage: source must be csv or rest' using errcode = '22023';
  end if;
  -- A REST source has to be one this school configured, with a credential
  -- pointer. The table constraint refuses a bad config row; it cannot refuse
  -- the absence of one, so the ingestion boundary does.
  if want_source = 'rest' and not exists (
    select 1 from private.roster_import_config c
     where c.tenant_id = want_tenant and c.source_kind = 'rest' and c.credentials_reference is not null
  ) then
    raise exception 'roster_stage: a REST batch needs a configured REST source with a credential reference for this school' using errcode = '42501';
  end if;
  if jsonb_typeof(want_manifest -> 'files') is distinct from 'array'
     or jsonb_typeof(want_rows) is distinct from 'array' then
    raise exception 'roster_stage: manifest.files and rows must be arrays' using errcode = '22023';
  end if;
  if jsonb_array_length(want_rows) > 200000 then
    raise exception 'roster_stage: more than 200000 rows in one batch' using errcode = '22023';
  end if;

  digest := encode(sha256(convert_to(want_manifest::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(hashtext('roster:' || want_tenant));

  select id into batch from private.roster_import_batch
   where tenant_id = want_tenant and manifest_sha256 = digest;
  if batch is not null then return batch; end if;

  insert into private.roster_import_batch (tenant_id, source_kind, manifest, manifest_sha256, staged_by)
  values (want_tenant, want_source, want_manifest, digest, want_staged_by)
  returning id into batch;

  for r in select * from jsonb_array_elements(want_rows) loop
    n := n + 1;
    problem := private.roster_row_problem(r ->> 'entity', r -> 'payload');
    if problem is null and coalesce(r ->> 'sourcedId', '') = '' then problem := 'row has no sourcedId'; end if;
    if problem is not null then
      if jsonb_array_length(bad) < 20 then
        bad := bad || jsonb_build_object('row', n, 'problem', problem);
      end if;
      continue;
    end if;
    insert into private.roster_staged_row (batch_id, tenant_id, entity, sourced_id, payload, row_hash)
    values (batch, want_tenant, r ->> 'entity', r ->> 'sourcedId', r -> 'payload',
            encode(sha256(convert_to((r ->> 'entity') || ':' || (r ->> 'sourcedId') || ':' || (r -> 'payload')::text, 'UTF8')), 'hex'))
    on conflict (batch_id, entity, sourced_id) do update set payload = excluded.payload
    where false;  -- a repeated sourcedId inside one batch is a problem, not an overwrite
    if not found then
      if jsonb_array_length(bad) < 20 then
        bad := bad || jsonb_build_object('row', n, 'problem', 'duplicate sourcedId in this batch');
      end if;
    end if;
  end loop;

  if jsonb_array_length(bad) > 0 then
    update private.roster_import_batch set status = 'rejected', problems = bad where id = batch;
  end if;
  return batch;
end;
$$;

-- ── Validate ──────────────────────────────────────────────────────────────

-- Check a staged batch against its manifest. Returns the new status.
create or replace function private.roster_validate(want_batch uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  b private.roster_import_batch%rowtype;
  f jsonb;
  ent text;
  staged_rows bigint;
  bad jsonb := '[]'::jsonb;
  listed text[] := '{}';
begin
  select * into b from private.roster_import_batch where id = want_batch for update;
  if not found then raise exception 'roster_validate: no such batch' using errcode = '22023'; end if;
  if b.status <> 'staged' then return b.status; end if;

  for f in select * from jsonb_array_elements(b.manifest -> 'files') loop
    ent := f ->> 'entity';
    if ent is null or ent not in ('orgs', 'users', 'classes', 'enrollments') then
      bad := bad || jsonb_build_object('problem', 'manifest lists an unknown entity');
      continue;
    end if;
    if ent = any (listed) then
      bad := bad || jsonb_build_object('entity', ent, 'problem', 'manifest lists the entity twice');
      continue;
    end if;
    listed := listed || ent;
    select count(*) into staged_rows from private.roster_staged_row where batch_id = b.id and entity = ent;
    if staged_rows <> coalesce((f ->> 'rows')::bigint, -1) then
      bad := bad || jsonb_build_object('entity', ent, 'problem', 'row count differs from the manifest');
    end if;
    if private.roster_entity_digest(b.id, ent) is distinct from (f ->> 'sha256') then
      bad := bad || jsonb_build_object('entity', ent, 'problem', 'content digest differs from the manifest');
    end if;
  end loop;

  for ent in
    select distinct entity from private.roster_staged_row
     where batch_id = b.id and not (entity = any (listed))
  loop
    bad := bad || jsonb_build_object('entity', ent, 'problem', 'rows staged for an entity the manifest does not list');
  end loop;

  -- Enrollments must point at staged users and classes.
  if exists (
    select 1 from private.roster_staged_row e
     where e.batch_id = b.id and e.entity = 'enrollments'
       and (not exists (select 1 from private.roster_staged_row u
                         where u.batch_id = b.id and u.entity = 'users' and u.sourced_id = e.payload ->> 'userSourcedId')
         or not exists (select 1 from private.roster_staged_row c
                         where c.batch_id = b.id and c.entity = 'classes' and c.sourced_id = e.payload ->> 'classSourcedId'))
  ) then
    bad := bad || jsonb_build_object('entity', 'enrollments', 'problem', 'an enrollment names a user or class that is not in the batch');
  end if;

  update private.roster_import_batch
     set status = case when jsonb_array_length(bad) = 0 then 'validated' else 'rejected' end,
         problems = bad
   where id = b.id;
  return case when jsonb_array_length(bad) = 0 then 'validated' else 'rejected' end;
end;
$$;

-- ── Reconciliation ────────────────────────────────────────────────────────

-- What promoting this batch would do, per entity and in total. A batch is a
-- full roster: a row in the live roster and not in the batch is "removed".
create or replace function private.roster_reconcile(want_batch uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with b as (select id, tenant_id from private.roster_import_batch where id = want_batch),
  ents as (select unnest(array['orgs', 'users', 'classes', 'enrollments']) as entity),
  per as (
    select e.entity,
      (select count(*) from private.roster_staged_row s join b on s.batch_id = b.id
        where s.entity = e.entity
          and not exists (select 1 from private.roster_current c
                           where c.tenant_id = b.tenant_id and c.entity = e.entity and c.sourced_id = s.sourced_id)) as added,
      (select count(*) from private.roster_staged_row s join b on s.batch_id = b.id
         join private.roster_current c on c.tenant_id = b.tenant_id and c.entity = e.entity and c.sourced_id = s.sourced_id
        where s.entity = e.entity and c.row_hash <> s.row_hash) as changed,
      (select count(*) from private.roster_staged_row s join b on s.batch_id = b.id
         join private.roster_current c on c.tenant_id = b.tenant_id and c.entity = e.entity and c.sourced_id = s.sourced_id
        where s.entity = e.entity and c.row_hash = s.row_hash) as unchanged,
      (select count(*) from private.roster_current c join b on c.tenant_id = b.tenant_id
        where c.entity = e.entity
          and not exists (select 1 from private.roster_staged_row s
                           where s.batch_id = b.id and s.entity = e.entity and s.sourced_id = c.sourced_id)) as removed,
      (select count(*) from private.roster_current c join b on c.tenant_id = b.tenant_id
        where c.entity = e.entity) as current_rows
    from ents e
  )
  select jsonb_build_object(
    'entities', coalesce(jsonb_object_agg(entity, jsonb_build_object(
        'added', added, 'changed', changed, 'unchanged', unchanged, 'removed', removed)), '{}'::jsonb),
    'added', coalesce(sum(added), 0), 'changed', coalesce(sum(changed), 0),
    'unchanged', coalesce(sum(unchanged), 0), 'removed', coalesce(sum(removed), 0),
    'current_rows', coalesce(sum(current_rows), 0)
  ) from per;
$$;

-- ── Promote ───────────────────────────────────────────────────────────────

-- Make a validated batch the live roster. Returns 'promoted', 'held',
-- 'already-promoted', or refuses. A batch that would remove more than the
-- school's threshold is held and promotes only with an approver who is not
-- the person who staged it.
create or replace function private.roster_promote(want_batch uuid, want_approver uuid default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  b private.roster_import_batch%rowtype;
  rep jsonb;
  cap integer;
  removal_pct numeric;
begin
  select * into b from private.roster_import_batch where id = want_batch;
  if not found then raise exception 'roster_promote: no such batch' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtext('roster:' || b.tenant_id));
  select * into b from private.roster_import_batch where id = want_batch for update;

  if b.status = 'promoted' then return 'already-promoted'; end if;
  if b.status not in ('validated', 'held') then
    raise exception 'roster_promote: a % batch cannot be promoted', b.status using errcode = '22023';
  end if;

  rep := private.roster_reconcile(b.id);
  select coalesce((select max_removal_pct from private.roster_import_config where tenant_id = b.tenant_id), 10) into cap;
  removal_pct := case when (rep ->> 'current_rows')::numeric = 0 then 0
                      else (rep ->> 'removed')::numeric * 100 / (rep ->> 'current_rows')::numeric end;

  if removal_pct > cap then
    if want_approver is null then
      update private.roster_import_batch
         set status = 'held', report = rep,
             held_reason = format('would remove %s%% of the roster; the limit is %s%%', round(removal_pct, 1), cap)
       where id = b.id;
      return 'held';
    end if;
    if b.staged_by is not null and b.staged_by = want_approver then
      raise exception 'roster_promote: the approver must not be the person who staged the batch' using errcode = '42501';
    end if;
  end if;

  -- Last known good: the roster this replaces.
  insert into private.roster_snapshot (batch_id, tenant_id, entity, sourced_id, payload, row_hash, origin_batch_id)
  select b.id, tenant_id, entity, sourced_id, payload, row_hash, batch_id
    from private.roster_current where tenant_id = b.tenant_id;

  delete from private.roster_current where tenant_id = b.tenant_id;
  insert into private.roster_current (tenant_id, entity, sourced_id, payload, row_hash, batch_id)
  select tenant_id, entity, sourced_id, payload, row_hash, batch_id
    from private.roster_staged_row where batch_id = b.id;

  update private.roster_import_batch
     set status = 'promoted', report = rep, promoted_at = clock_timestamp(),
         approved_by = coalesce(want_approver, approved_by), held_reason = null
   where id = b.id;
  return 'promoted';
end;
$$;

-- ── Roll back ─────────────────────────────────────────────────────────────

-- Put the last known good back. Only the most recent promotion for a school
-- can be rolled back; a rolled-back batch is a no-op the second time.
create or replace function private.roster_rollback(want_batch uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  b private.roster_import_batch%rowtype;
begin
  select * into b from private.roster_import_batch where id = want_batch;
  if not found then raise exception 'roster_rollback: no such batch' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtext('roster:' || b.tenant_id));
  select * into b from private.roster_import_batch where id = want_batch for update;

  if b.status = 'rolled_back' then return 'already-rolled-back'; end if;
  if b.status <> 'promoted' then
    raise exception 'roster_rollback: a % batch was never promoted', b.status using errcode = '22023';
  end if;
  if exists (select 1 from private.roster_import_batch
              where tenant_id = b.tenant_id and status = 'promoted' and promoted_at > b.promoted_at) then
    raise exception 'roster_rollback: a later batch has been promoted; roll that one back first' using errcode = '22023';
  end if;

  delete from private.roster_current where tenant_id = b.tenant_id;
  insert into private.roster_current (tenant_id, entity, sourced_id, payload, row_hash, batch_id)
  select s.tenant_id, s.entity, s.sourced_id, s.payload, s.row_hash, s.origin_batch_id
    from private.roster_snapshot s where s.batch_id = b.id;

  update private.roster_import_batch set status = 'rolled_back', rolled_back_at = clock_timestamp() where id = b.id;
  return 'rolled-back';
end;
$$;

-- ── Legal holds (#1012) ───────────────────────────────────────────────────
--
-- A legal hold means records are not destroyed. Promotion and rollback destroy
-- nothing: `roster_promote` copies the roster it replaces into
-- `roster_snapshot` first, and `roster_rollback` leaves the promoted rows in
-- `roster_staged_row`. What could destroy a record is a delete of a batch, its
-- staged rows or its snapshot, and nothing here does that. This refuses it for
-- anything that tries while the school (or the platform) is under a live hold,
-- the way `refuse_delete_while_held` does for an account. `roster_current` is
-- deliberately not guarded: replacing it is the point of a promotion, and the
-- snapshot is what keeps the old rows.
create or replace function private.refuse_roster_delete_while_held()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.tenant_is_held(old.tenant_id) then
    raise exception 'This school is under a legal hold; its roster batches, staged rows and snapshots cannot be deleted until the hold is released.' using errcode = '55006';
  end if;
  return old;
end $$;

revoke all on function private.refuse_roster_delete_while_held() from public, anon, authenticated;

drop trigger if exists refuse_roster_delete_while_held on private.roster_import_batch;
create trigger refuse_roster_delete_while_held
  before delete on private.roster_import_batch
  for each row execute function private.refuse_roster_delete_while_held();
drop trigger if exists refuse_roster_delete_while_held on private.roster_staged_row;
create trigger refuse_roster_delete_while_held
  before delete on private.roster_staged_row
  for each row execute function private.refuse_roster_delete_while_held();
drop trigger if exists refuse_roster_delete_while_held on private.roster_snapshot;
create trigger refuse_roster_delete_while_held
  before delete on private.roster_snapshot
  for each row execute function private.refuse_roster_delete_while_held();

-- Nothing here is for a client. The service key calls these from a worker
-- that has already established which school it is acting for.
revoke all on function private.roster_allowed_keys(text) from public, anon, authenticated;
revoke all on function private.roster_row_problem(text, jsonb) from public, anon, authenticated;
revoke all on function private.roster_entity_digest(uuid, text) from public, anon, authenticated;
revoke all on function private.roster_stage(text, text, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke all on function private.roster_validate(uuid) from public, anon, authenticated;
revoke all on function private.roster_reconcile(uuid) from public, anon, authenticated;
revoke all on function private.roster_promote(uuid, uuid) from public, anon, authenticated;
revoke all on function private.roster_rollback(uuid) from public, anon, authenticated;

-- The worker calls the entry points with the service key. `private` has no
-- default function privileges (only `public` does), so the worker's access came
-- from PUBLIC, which the revokes above removed. Grant it by name, to the one
-- role that needs it; the helpers stay reachable only through these.
grant execute on function private.roster_stage(text, text, jsonb, jsonb, uuid) to service_role;
grant execute on function private.roster_validate(uuid) to service_role;
grant execute on function private.roster_reconcile(uuid) to service_role;
grant execute on function private.roster_promote(uuid, uuid) to service_role;
grant execute on function private.roster_rollback(uuid) to service_role;
