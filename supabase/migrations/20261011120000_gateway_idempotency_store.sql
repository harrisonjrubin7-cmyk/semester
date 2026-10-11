-- Multi-instance, lease-fenced idempotency for institution commands.
-- Response bodies are AES-GCM ciphertext produced by the gateway; Postgres
-- sees only the scope, request hash, status and lease metadata.

create table if not exists private.gateway_idempotency (
  tenant_id text not null references public.schools(id) on delete cascade,
  actor_id text not null check (length(actor_id) between 1 and 200),
  command text not null check (length(command) between 1 and 200),
  idempotency_key text not null check (length(idempotency_key) between 8 and 200),
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  state text not null check (state in ('in_progress', 'completed')),
  lease_id uuid not null,
  lease_until timestamptz not null,
  expires_at timestamptz not null,
  response_status integer check (response_status between 100 and 599),
  sealed_response text check (length(sealed_response) between 40 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, actor_id, command, idempotency_key),
  check ((state = 'completed') = (response_status is not null and sealed_response is not null))
);

create index if not exists gateway_idempotency_retention
  on private.gateway_idempotency (expires_at);

alter table private.gateway_idempotency enable row level security;
alter table private.gateway_idempotency force row level security;
revoke all on table private.gateway_idempotency from public, anon, authenticated;
grant select, insert, update, delete on table private.gateway_idempotency to service_role;

create or replace function private.gateway_begin_idempotency(
  want_tenant text, want_actor text, want_command text, want_key text,
  want_request_hash text, want_now timestamptz, want_lease_ms bigint, want_ttl_ms bigint
)
returns table(
  kind text, lease_id uuid, response_status integer,
  response_body text, retry_after_seconds integer
)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  current_row private.gateway_idempotency%rowtype;
  made_lease uuid;
begin
  if want_now is null
     or want_request_hash !~ '^[0-9a-f]{64}$'
     or length(want_actor) not between 1 and 200
     or length(want_command) not between 1 and 200
     or length(want_key) not between 8 and 200
     or want_lease_ms not between 1 and 3600000
     or want_ttl_ms not between 1 and 2592000000 then
    raise exception 'invalid gateway idempotency request' using errcode = '22023';
  end if;

  -- Serialize this exact scope even before its first row exists. A hash
  -- collision only serializes unrelated commands; it cannot mix their rows.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    want_tenant || chr(31) || want_actor || chr(31) || want_command || chr(31) || want_key, 0
  ));

  select * into current_row
    from private.gateway_idempotency i
   where i.tenant_id = want_tenant
     and i.actor_id = want_actor
     and i.command = want_command
     and i.idempotency_key = want_key
   for update;

  if found and current_row.expires_at > want_now then
    if current_row.request_sha256 <> want_request_hash then
      return query select 'conflict'::text, null::uuid, null::integer, null::text, null::integer;
      return;
    end if;
    if current_row.state = 'completed' then
      return query select 'replay'::text, null::uuid, current_row.response_status,
        current_row.sealed_response, null::integer;
      return;
    end if;
    if current_row.lease_until > want_now then
      return query select 'in_progress'::text, null::uuid, null::integer, null::text,
        greatest(1, ceil(extract(epoch from (current_row.lease_until - want_now)))::integer);
      return;
    end if;
  end if;

  made_lease := pg_catalog.gen_random_uuid();
  insert into private.gateway_idempotency as i
    (tenant_id, actor_id, command, idempotency_key, request_sha256, state,
     lease_id, lease_until, expires_at, response_status, sealed_response, updated_at)
  values
    (want_tenant, want_actor, want_command, want_key, want_request_hash, 'in_progress',
     made_lease, want_now + want_lease_ms * interval '1 millisecond',
     want_now + want_ttl_ms * interval '1 millisecond', null, null, now())
  on conflict (tenant_id, actor_id, command, idempotency_key) do update
    set request_sha256 = excluded.request_sha256,
        state = excluded.state,
        lease_id = excluded.lease_id,
        lease_until = excluded.lease_until,
        expires_at = excluded.expires_at,
        response_status = null,
        sealed_response = null,
        updated_at = excluded.updated_at;
  return query select 'started'::text, made_lease, null::integer, null::text, null::integer;
end $$;

create or replace function private.gateway_complete_idempotency(
  want_tenant text, want_actor text, want_command text, want_key text,
  want_lease uuid, want_status integer, want_body text, want_now timestamptz
)
returns boolean language plpgsql volatile security definer set search_path = ''
as $$
begin
  if want_status not between 100 and 599
     or length(want_body) not between 40 and 1000000
     or want_now is null then
    return false;
  end if;
  update private.gateway_idempotency i
     set state = 'completed', response_status = want_status,
         sealed_response = want_body, lease_until = want_now, updated_at = now()
   where i.tenant_id = want_tenant
     and i.actor_id = want_actor
     and i.command = want_command
     and i.idempotency_key = want_key
     and i.state = 'in_progress'
     and i.lease_id = want_lease;
  return found;
end $$;

create or replace function private.gateway_release_idempotency(
  want_tenant text, want_actor text, want_command text, want_key text, want_lease uuid
)
returns boolean language plpgsql volatile security definer set search_path = ''
as $$
begin
  delete from private.gateway_idempotency i
   where i.tenant_id = want_tenant
     and i.actor_id = want_actor
     and i.command = want_command
     and i.idempotency_key = want_key
     and i.state = 'in_progress'
     and i.lease_id = want_lease;
  return found;
end $$;

create or replace function private.gateway_purge_idempotency()
returns bigint language plpgsql volatile security definer set search_path = ''
as $$
declare
  removed bigint;
begin
  delete from private.gateway_idempotency i
   where i.expires_at < now();
  get diagnostics removed = row_count;
  return removed;
end $$;

-- Keep retention readiness tied to the same hourly sweep while extending that
-- sweep to the idempotency table. Expired keys are replay protection rather
-- than evidence; the authoritative review, receipt and audit rows keep their
-- existing legal-hold rules in the private journal purge.
create or replace function public.gateway_purge_journal()
returns bigint language plpgsql volatile security definer set search_path = ''
as $$
declare
  removed bigint;
begin
  removed := private.gateway_purge_journal() + private.gateway_purge_idempotency();
  insert into private.gateway_health_probe (singleton, touched_at, last_retention_at)
  values (true, now(), now())
  on conflict (singleton) do update
    set touched_at = excluded.touched_at,
        last_retention_at = excluded.last_retention_at;
  return removed;
end $$;

create or replace function public.gateway_begin_idempotency(
  want_tenant text, want_actor text, want_command text, want_key text,
  want_request_hash text, want_now timestamptz, want_lease_ms bigint, want_ttl_ms bigint
)
returns table(kind text, lease_id uuid, response_status integer, response_body text, retry_after_seconds integer)
language sql volatile security definer set search_path = ''
as $$ select * from private.gateway_begin_idempotency(
  want_tenant, want_actor, want_command, want_key, want_request_hash,
  want_now, want_lease_ms, want_ttl_ms
) $$;

create or replace function public.gateway_complete_idempotency(
  want_tenant text, want_actor text, want_command text, want_key text,
  want_lease uuid, want_status integer, want_body text, want_now timestamptz
)
returns boolean language sql volatile security definer set search_path = ''
as $$ select private.gateway_complete_idempotency(
  want_tenant, want_actor, want_command, want_key, want_lease, want_status, want_body, want_now
) $$;

create or replace function public.gateway_release_idempotency(
  want_tenant text, want_actor text, want_command text, want_key text, want_lease uuid
)
returns boolean language sql volatile security definer set search_path = ''
as $$ select private.gateway_release_idempotency(
  want_tenant, want_actor, want_command, want_key, want_lease
) $$;

revoke all on function private.gateway_begin_idempotency(text,text,text,text,text,timestamptz,bigint,bigint) from public, anon, authenticated;
revoke all on function private.gateway_complete_idempotency(text,text,text,text,uuid,integer,text,timestamptz) from public, anon, authenticated;
revoke all on function private.gateway_release_idempotency(text,text,text,text,uuid) from public, anon, authenticated;
revoke all on function private.gateway_purge_idempotency() from public, anon, authenticated;
revoke all on function public.gateway_begin_idempotency(text,text,text,text,text,timestamptz,bigint,bigint) from public, anon, authenticated;
revoke all on function public.gateway_complete_idempotency(text,text,text,text,uuid,integer,text,timestamptz) from public, anon, authenticated;
revoke all on function public.gateway_release_idempotency(text,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.gateway_begin_idempotency(text,text,text,text,text,timestamptz,bigint,bigint) to service_role;
grant execute on function public.gateway_complete_idempotency(text,text,text,text,uuid,integer,text,timestamptz) to service_role;
grant execute on function public.gateway_release_idempotency(text,text,text,text,uuid) to service_role;

comment on table private.gateway_idempotency is
  'Service-only scoped idempotency leases with encrypted replay bodies.';
