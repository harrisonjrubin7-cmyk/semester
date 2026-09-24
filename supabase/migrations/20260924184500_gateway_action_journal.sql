-- Durable, tenant-scoped state for university actions.
-- Review bodies are AES-GCM ciphertext produced by the gateway. Postgres sees
-- only the fields needed to authorize access and enforce the state machine.

create table if not exists private.gateway_review (
  id uuid primary key,
  tenant_id text not null references public.schools(id) on delete cascade,
  actor_id text not null check (length(actor_id) between 1 and 200),
  expires_at timestamptz not null,
  state text not null default 'ready'
    check (state in ('ready', 'processing', 'completed', 'pending', 'refused', 'uncertain')),
  operation_sha256 text not null check (operation_sha256 ~ '^[0-9a-f]{64}$'),
  sealed_body text not null check (length(sealed_body) between 40 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gateway_review_unresolved_operation
  on private.gateway_review (operation_sha256, state)
  where state in ('processing', 'pending', 'uncertain');
create index if not exists gateway_review_retention
  on private.gateway_review (state, expires_at);

create table if not exists private.gateway_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  tenant_id text not null references public.schools(id) on delete cascade,
  actor_id text not null check (length(actor_id) between 1 and 200),
  area text not null check (length(area) between 1 and 100),
  event text not null check (length(event) between 1 and 100),
  review_id uuid
);

create table if not exists private.gateway_intelligence_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  tenant_id text not null references public.schools(id) on delete cascade,
  actor_id text not null check (length(actor_id) between 1 and 200),
  category text not null check (length(category) between 1 and 100),
  provider text not null check (length(provider) <= 100),
  model text not null check (length(model) <= 200),
  input_tokens integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  cost_cents numeric not null check (cost_cents >= 0),
  policy_decision text not null check (length(policy_decision) between 1 and 200),
  action_id uuid,
  confirmation text check (confirmation in ('confirmed', 'refused'))
);

create index if not exists gateway_audit_tenant_time
  on private.gateway_audit (tenant_id, at desc);

-- A write probe, rather than a SELECT wearing a readiness-check name.
create table if not exists private.gateway_health_probe (
  singleton boolean primary key default true check (singleton),
  touched_at timestamptz not null default now()
);

create table if not exists private.gateway_rate_limit (
  tenant_id text not null references public.schools(id) on delete cascade,
  actor_id text not null check (length(actor_id) between 1 and 200),
  window_start timestamptz not null,
  count integer not null check (count > 0),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, actor_id, window_start)
);

create table if not exists private.gateway_intelligence_action (
  id uuid primary key,
  tenant_id text not null references public.schools(id) on delete cascade,
  actor_id text not null check (length(actor_id) between 1 and 200),
  expires_at timestamptz not null,
  state text not null default 'ready' check (state in ('ready', 'processing')),
  sealed_body text not null check (length(sealed_body) between 40 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gateway_rate_limit_retention
  on private.gateway_rate_limit (updated_at);

alter table private.gateway_review enable row level security;
alter table private.gateway_audit enable row level security;
alter table private.gateway_intelligence_audit enable row level security;
alter table private.gateway_health_probe enable row level security;
alter table private.gateway_rate_limit enable row level security;
alter table private.gateway_intelligence_action enable row level security;
revoke all on table private.gateway_review from public, anon, authenticated;
revoke all on table private.gateway_audit from public, anon, authenticated;
revoke all on table private.gateway_intelligence_audit from public, anon, authenticated;
revoke all on table private.gateway_health_probe from public, anon, authenticated;
revoke all on table private.gateway_rate_limit from public, anon, authenticated;
revoke all on table private.gateway_intelligence_action from public, anon, authenticated;
grant select, insert, update, delete on table private.gateway_review to service_role;
grant select, insert, delete on table private.gateway_audit to service_role;
grant select, insert, delete on table private.gateway_intelligence_audit to service_role;
grant select, insert, update on table private.gateway_health_probe to service_role;
grant select, insert, update, delete on table private.gateway_rate_limit to service_role;
grant select, insert, update, delete on table private.gateway_intelligence_action to service_role;

create or replace function private.gateway_save_intelligence_action(
  want_action uuid, want_tenant text, want_actor text,
  want_expires timestamptz, want_body text
)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if want_expires <= now() or length(want_body) not between 40 and 1000000 then return false; end if;
  insert into private.gateway_intelligence_action
    (id, tenant_id, actor_id, expires_at, state, sealed_body)
  values (want_action, want_tenant, want_actor, want_expires, 'ready', want_body);
  return true;
exception when unique_violation or foreign_key_violation or check_violation then return false;
end $$;

create or replace function private.gateway_claim_intelligence_action(
  want_action uuid, want_tenant text, want_actor text, want_now timestamptz
)
returns table(body text) language plpgsql security definer set search_path = ''
as $$
begin
  return query
  update private.gateway_intelligence_action a
     set state = 'processing', updated_at = now()
   where a.id = want_action
     and a.tenant_id = want_tenant
     and a.actor_id = want_actor
     and a.state = 'ready'
     and a.expires_at > want_now
  returning a.sealed_body;
end $$;

create or replace function private.gateway_take_rate_limit(
  want_tenant text,
  want_actor text,
  want_now timestamptz,
  want_window_seconds integer,
  want_max integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  bucket timestamptz;
  requests integer;
begin
  if want_now is null
     or want_window_seconds not between 1 and 3600
     or want_max not between 1 and 10000 then
    return false;
  end if;

  bucket := to_timestamp(
    floor(extract(epoch from want_now) / want_window_seconds) * want_window_seconds
  );
  insert into private.gateway_rate_limit
    (tenant_id, actor_id, window_start, count, updated_at)
  values
    (want_tenant, want_actor, bucket, 1, now())
  on conflict (tenant_id, actor_id, window_start)
  do update set count = private.gateway_rate_limit.count + 1, updated_at = now()
  returning count into requests;
  return requests <= want_max;
exception when foreign_key_violation or check_violation then
  return false;
end $$;

create or replace function private.gateway_save_review(
  want_review uuid,
  want_tenant text,
  want_actor text,
  want_expires timestamptz,
  want_operation text,
  want_body text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if want_expires <= now()
     or want_operation !~ '^[0-9a-f]{64}$'
     or length(want_body) not between 40 and 1000000 then
    return false;
  end if;
  insert into private.gateway_review
    (id, tenant_id, actor_id, expires_at, state, operation_sha256, sealed_body)
  values
    (want_review, want_tenant, want_actor, want_expires, 'ready', want_operation, want_body);
  return true;
exception when unique_violation or foreign_key_violation or check_violation then
  return false;
end $$;

create or replace function private.gateway_get_review(
  want_review uuid,
  want_tenant text,
  want_actor text
)
returns table(state text, body text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.state, r.sealed_body
    from private.gateway_review r
   where r.id = want_review
     and r.tenant_id = want_tenant
     and r.actor_id = want_actor;
$$;

create or replace function private.gateway_claim_review(
  want_review uuid,
  want_tenant text,
  want_actor text,
  want_now timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation text;
begin
  select r.operation_sha256 into operation
    from private.gateway_review r
   where r.id = want_review
     and r.tenant_id = want_tenant
     and r.actor_id = want_actor
   for update;
  if not found then return false; end if;

  -- Different review ids for the same action must serialize together. Row
  -- locks alone do not protect this cross-row invariant.
  perform pg_advisory_xact_lock(hashtextextended(operation, 0));

  update private.gateway_review r
     set state = 'processing', updated_at = now()
   where r.id = want_review
     and r.tenant_id = want_tenant
     and r.actor_id = want_actor
     and r.state = 'ready'
     and r.expires_at > want_now
     and not exists (
       select 1
         from private.gateway_review other
        where other.operation_sha256 = operation
          and other.id <> r.id
          and other.state in ('processing', 'pending', 'uncertain')
     );
  return found;
end $$;

create or replace function private.gateway_finish_review(
  want_review uuid,
  want_tenant text,
  want_actor text,
  want_state text,
  want_body text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if want_state not in ('completed', 'pending', 'refused', 'uncertain')
     or length(want_body) not between 40 and 1000000 then
    return false;
  end if;
  update private.gateway_review r
     set state = want_state, sealed_body = want_body, updated_at = now()
   where r.id = want_review
     and r.tenant_id = want_tenant
     and r.actor_id = want_actor
     and (
       (r.state = 'processing')
       or (r.state in ('pending', 'uncertain') and want_state in ('pending', 'completed'))
     );
  return found;
end $$;

create or replace function private.gateway_write_audit(
  want_tenant text,
  want_actor text,
  want_area text,
  want_event text,
  want_review uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.gateway_audit (tenant_id, actor_id, area, event, review_id)
  values (want_tenant, want_actor, want_area, want_event, want_review);
  return true;
exception when foreign_key_violation or check_violation then
  return false;
end $$;

create or replace function private.gateway_write_intelligence_audit(
  want_tenant text, want_actor text, want_category text, want_provider text,
  want_model text, want_input_tokens integer, want_output_tokens integer,
  want_cost_cents numeric, want_policy_decision text,
  want_action uuid default null, want_confirmation text default null
)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  insert into private.gateway_intelligence_audit
    (tenant_id, actor_id, category, provider, model, input_tokens, output_tokens,
     cost_cents, policy_decision, action_id, confirmation)
  values
    (want_tenant, want_actor, want_category, want_provider, want_model,
     want_input_tokens, want_output_tokens, want_cost_cents, want_policy_decision,
     want_action, want_confirmation);
  return true;
exception when foreign_key_violation or check_violation then return false;
end $$;

create or replace function private.gateway_journal_health()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.gateway_health_probe (singleton, touched_at)
  values (true, now())
  on conflict (singleton) do update set touched_at = excluded.touched_at;
  return true;
exception when others then
  return false;
end $$;

create or replace function private.gateway_purge_journal()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed bigint := 0;
  affected bigint := 0;
begin
  delete from private.gateway_review
   where (state = 'ready' and expires_at < now() - interval '1 day')
      or (state in ('completed', 'refused') and expires_at < now() - interval '90 days');
  get diagnostics removed = row_count;
  delete from private.gateway_audit where at < now() - interval '180 days';
  get diagnostics affected = row_count;
  removed := removed + affected;
  delete from private.gateway_intelligence_audit where at < now() - interval '180 days';
  get diagnostics affected = row_count;
  removed := removed + affected;
  delete from private.gateway_rate_limit where updated_at < now() - interval '1 day';
  get diagnostics affected = row_count;
  removed := removed + affected;
  delete from private.gateway_intelligence_action
   where (state = 'ready' and expires_at < now() - interval '1 day')
      or (state = 'processing' and updated_at < now() - interval '90 days');
  get diagnostics affected = row_count;
  return removed + affected;
end $$;

-- Private schema functions are not reachable through PostgREST. Public
-- wrappers expose only this narrow, service-role-only server API.
create or replace function public.gateway_save_review(
  want_review uuid, want_tenant text, want_actor text, want_expires timestamptz,
  want_operation text, want_body text
)
returns boolean language sql volatile security definer set search_path = ''
as $$ select private.gateway_save_review(want_review, want_tenant, want_actor, want_expires, want_operation, want_body) $$;

create or replace function public.gateway_get_review(want_review uuid, want_tenant text, want_actor text)
returns table(state text, body text) language sql stable security definer set search_path = ''
as $$ select * from private.gateway_get_review(want_review, want_tenant, want_actor) $$;

create or replace function public.gateway_claim_review(
  want_review uuid, want_tenant text, want_actor text, want_now timestamptz
)
returns boolean language sql volatile security definer set search_path = ''
as $$ select private.gateway_claim_review(want_review, want_tenant, want_actor, want_now) $$;

create or replace function public.gateway_finish_review(
  want_review uuid, want_tenant text, want_actor text, want_state text, want_body text
)
returns boolean language sql volatile security definer set search_path = ''
as $$ select private.gateway_finish_review(want_review, want_tenant, want_actor, want_state, want_body) $$;

create or replace function public.gateway_write_audit(
  want_tenant text, want_actor text, want_area text, want_event text, want_review uuid default null
)
returns boolean language sql volatile security definer set search_path = ''
as $$ select private.gateway_write_audit(want_tenant, want_actor, want_area, want_event, want_review) $$;

create or replace function public.gateway_write_intelligence_audit(
  want_tenant text, want_actor text, want_category text, want_provider text,
  want_model text, want_input_tokens integer, want_output_tokens integer,
  want_cost_cents numeric, want_policy_decision text,
  want_action uuid default null, want_confirmation text default null
)
returns boolean language sql volatile security definer set search_path = ''
as $$ select private.gateway_write_intelligence_audit(
  want_tenant, want_actor, want_category, want_provider, want_model,
  want_input_tokens, want_output_tokens, want_cost_cents, want_policy_decision,
  want_action, want_confirmation
) $$;

create or replace function public.gateway_journal_health()
returns boolean language sql volatile security definer set search_path = ''
as $$ select private.gateway_journal_health() $$;

create or replace function public.gateway_purge_journal()
returns bigint language sql volatile security definer set search_path = ''
as $$ select private.gateway_purge_journal() $$;

create or replace function public.gateway_take_rate_limit(
  want_tenant text, want_actor text, want_now timestamptz,
  want_window_seconds integer, want_max integer
)
returns boolean language sql volatile security definer set search_path = ''
as $$ select private.gateway_take_rate_limit(want_tenant, want_actor, want_now, want_window_seconds, want_max) $$;

create or replace function public.gateway_save_intelligence_action(
  want_action uuid, want_tenant text, want_actor text, want_expires timestamptz, want_body text
)
returns boolean language sql volatile security definer set search_path = ''
as $$ select private.gateway_save_intelligence_action(want_action, want_tenant, want_actor, want_expires, want_body) $$;

create or replace function public.gateway_claim_intelligence_action(
  want_action uuid, want_tenant text, want_actor text, want_now timestamptz
)
returns table(body text) language sql volatile security definer set search_path = ''
as $$ select * from private.gateway_claim_intelligence_action(want_action, want_tenant, want_actor, want_now) $$;

revoke all on function private.gateway_save_review(uuid, text, text, timestamptz, text, text) from public, anon, authenticated;
revoke all on function private.gateway_get_review(uuid, text, text) from public, anon, authenticated;
revoke all on function private.gateway_claim_review(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function private.gateway_finish_review(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function private.gateway_write_audit(text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function private.gateway_write_intelligence_audit(text,text,text,text,text,integer,integer,numeric,text,uuid,text) from public, anon, authenticated;
revoke all on function private.gateway_journal_health() from public, anon, authenticated;
revoke all on function private.gateway_purge_journal() from public, anon, authenticated;
revoke all on function private.gateway_take_rate_limit(text, text, timestamptz, integer, integer) from public, anon, authenticated;
revoke all on function private.gateway_save_intelligence_action(uuid, text, text, timestamptz, text) from public, anon, authenticated;
revoke all on function private.gateway_claim_intelligence_action(uuid, text, text, timestamptz) from public, anon, authenticated;

revoke all on function public.gateway_save_review(uuid, text, text, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.gateway_get_review(uuid, text, text) from public, anon, authenticated;
revoke all on function public.gateway_claim_review(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.gateway_finish_review(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.gateway_write_audit(text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.gateway_write_intelligence_audit(text,text,text,text,text,integer,integer,numeric,text,uuid,text) from public, anon, authenticated;
revoke all on function public.gateway_journal_health() from public, anon, authenticated;
revoke all on function public.gateway_purge_journal() from public, anon, authenticated;
revoke all on function public.gateway_take_rate_limit(text, text, timestamptz, integer, integer) from public, anon, authenticated;
revoke all on function public.gateway_save_intelligence_action(uuid, text, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.gateway_claim_intelligence_action(uuid, text, text, timestamptz) from public, anon, authenticated;

grant execute on function public.gateway_save_review(uuid, text, text, timestamptz, text, text) to service_role;
grant execute on function public.gateway_get_review(uuid, text, text) to service_role;
grant execute on function public.gateway_claim_review(uuid, text, text, timestamptz) to service_role;
grant execute on function public.gateway_finish_review(uuid, text, text, text, text) to service_role;
grant execute on function public.gateway_write_audit(text, text, text, text, uuid) to service_role;
grant execute on function public.gateway_write_intelligence_audit(text,text,text,text,text,integer,integer,numeric,text,uuid,text) to service_role;
grant execute on function public.gateway_journal_health() to service_role;
grant execute on function public.gateway_purge_journal() to service_role;
grant execute on function public.gateway_take_rate_limit(text, text, timestamptz, integer, integer) to service_role;
grant execute on function public.gateway_save_intelligence_action(uuid, text, text, timestamptz, text) to service_role;
grant execute on function public.gateway_claim_intelligence_action(uuid, text, text, timestamptz) to service_role;

comment on table private.gateway_review is
  'Encrypted two-phase university action state; uncertain and pending rows are never age-purged.';
comment on table private.gateway_audit is
  'Metadata-only audit events for university action access and state transitions.';
comment on table private.gateway_intelligence_audit is
  'Metadata-only governed AI decisions and usage; no questions, source bodies or model prose.';
comment on table private.gateway_rate_limit is
  'Shared fixed-window gateway counters; contains no tokens, bodies or university records.';
comment on table private.gateway_intelligence_action is
  'Encrypted, expiring, single-use AI-proposed actions scoped to one tenant and actor.';
