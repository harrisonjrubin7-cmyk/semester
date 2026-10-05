-- Private source payloads and atomic provider budgets for Semester Intelligence.
-- Browser clients may inspect approved-source metadata, but only the server-side
-- gateway may read the source text that is sent to a model provider.

create table if not exists private.approved_source_content (
  source_id uuid primary key references public.approved_source(id) on delete cascade,
  body text not null check (length(body) between 1 and 200000),
  evidence_ids text[] not null default '{}',
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz not null default now(),
  constraint approved_source_content_evidence_bound check (cardinality(evidence_ids) <= 500)
);

revoke all on table private.approved_source_content from public, anon, authenticated;
grant select, insert, update, delete on table private.approved_source_content to service_role;

create table if not exists private.ai_usage_month (
  tenant_id text not null references public.schools(id) on delete cascade,
  period_start date not null,
  spent_cents numeric(14,4) not null default 0 check (spent_cents >= 0),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  completed_requests bigint not null default 0 check (completed_requests >= 0),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, period_start)
);

create table if not exists private.ai_usage_reservation (
  id uuid primary key,
  tenant_id text not null references public.schools(id) on delete cascade,
  period_start date not null,
  reserved_cents numeric(14,4) not null check (reserved_cents >= 0),
  actual_cents numeric(14,4) check (actual_cents is null or actual_cents >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'settled', 'released')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  settled_at timestamptz,
  constraint ai_usage_reservation_settlement check (
    (status = 'reserved' and actual_cents is null and settled_at is null)
    or (status = 'released' and actual_cents is null and settled_at is not null)
    or (status = 'settled' and actual_cents is not null and settled_at is not null)
  )
);

alter table private.approved_source_content enable row level security;
alter table private.ai_usage_month enable row level security;
alter table private.ai_usage_reservation enable row level security;

create index if not exists ai_usage_reservation_by_tenant_period_status
  on private.ai_usage_reservation (tenant_id, period_start, status);

revoke all on table private.ai_usage_month from public, anon, authenticated;
revoke all on table private.ai_usage_reservation from public, anon, authenticated;
grant select on table private.ai_usage_month to service_role;
grant select on table private.ai_usage_reservation to service_role;

create or replace function private.reserve_ai_budget(
  want_tenant text,
  want_reservation uuid,
  want_cents numeric
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  budget bigint;
  month_start date := date_trunc('month', timezone('UTC', now()))::date;
  already_spent numeric := 0;
  already_reserved numeric := 0;
begin
  if want_cents < 0 then return false; end if;

  select monthly_budget_cents into budget
    from public.ai_policy
   where tenant_id = want_tenant
   for update;
  if budget is null or budget <= 0 then return false; end if;

  select coalesce(spent_cents, 0) into already_spent
    from private.ai_usage_month
   where tenant_id = want_tenant and period_start = month_start;
  select coalesce(sum(reserved_cents), 0) into already_reserved
    from private.ai_usage_reservation
   where tenant_id = want_tenant and period_start = month_start
     and status = 'reserved' and expires_at > now();

  if already_spent + already_reserved + want_cents > budget then return false; end if;

  insert into private.ai_usage_reservation (id, tenant_id, period_start, reserved_cents)
  values (want_reservation, want_tenant, month_start, want_cents);
  return true;
end $$;

create or replace function private.settle_ai_budget(
  want_tenant text,
  want_reservation uuid,
  want_actual_cents numeric,
  want_input_tokens bigint,
  want_output_tokens bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation private.ai_usage_reservation%rowtype;
begin
  if want_actual_cents < 0 or want_input_tokens < 0 or want_output_tokens < 0 then return false; end if;
  select * into reservation
    from private.ai_usage_reservation
   where id = want_reservation and tenant_id = want_tenant and expires_at > now()
   for update;
  if not found or reservation.status <> 'reserved' or want_actual_cents > reservation.reserved_cents then
    return false;
  end if;

  update private.ai_usage_reservation
     set status = 'settled', actual_cents = want_actual_cents, settled_at = now()
   where id = want_reservation;
  insert into private.ai_usage_month
    (tenant_id, period_start, spent_cents, input_tokens, output_tokens, completed_requests)
  values
    (want_tenant, reservation.period_start, want_actual_cents, want_input_tokens, want_output_tokens, 1)
  on conflict (tenant_id, period_start) do update set
    spent_cents = private.ai_usage_month.spent_cents + excluded.spent_cents,
    input_tokens = private.ai_usage_month.input_tokens + excluded.input_tokens,
    output_tokens = private.ai_usage_month.output_tokens + excluded.output_tokens,
    completed_requests = private.ai_usage_month.completed_requests + 1,
    updated_at = now();
  return true;
end $$;

create or replace function private.sweep_ai_runtime_metadata()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed bigint := 0;
  affected bigint := 0;
begin
  update private.ai_usage_reservation
     set status = 'released', settled_at = now()
   where status = 'reserved' and expires_at <= now();

  delete from private.ai_usage_reservation r
  using public.ai_policy p
   where r.tenant_id = p.tenant_id
     and r.created_at < now() - make_interval(days => p.retention_days);
  get diagnostics removed = row_count;

  delete from private.ai_usage_month m
  using public.ai_policy p
   where m.tenant_id = p.tenant_id
     -- Never erase the authoritative current-month spend while it still
     -- enforces the monthly ceiling, even when retention_days is zero.
     and m.period_start < date_trunc('month', timezone('UTC', now()))::date
     and m.period_start < (timezone('UTC', now()) - make_interval(days => p.retention_days))::date;
  get diagnostics affected = row_count;
  return removed + affected;
end $$;

create or replace function private.release_ai_budget(want_tenant text, want_reservation uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.ai_usage_reservation
     set status = 'released', settled_at = now()
   where id = want_reservation and tenant_id = want_tenant and status = 'reserved';
  return found;
end $$;

revoke all on function private.reserve_ai_budget(text, uuid, numeric) from public, anon, authenticated;
revoke all on function private.settle_ai_budget(text, uuid, numeric, bigint, bigint) from public, anon, authenticated;
revoke all on function private.release_ai_budget(text, uuid) from public, anon, authenticated;
revoke all on function private.sweep_ai_runtime_metadata() from public, anon, authenticated;
grant execute on function private.reserve_ai_budget(text, uuid, numeric) to service_role;
grant execute on function private.settle_ai_budget(text, uuid, numeric, bigint, bigint) to service_role;
grant execute on function private.release_ai_budget(text, uuid) to service_role;
grant execute on function private.sweep_ai_runtime_metadata() to service_role;

-- The private schema is deliberately not exposed through PostgREST. These
-- narrowly scoped, service-role-only RPCs are the gateway's API boundary.
create or replace function public.load_approved_source_content(
  want_tenant text,
  want_sources uuid[]
)
returns table(source_id uuid, body text, evidence_ids text[])
language sql
stable
security definer
set search_path = ''
as $$
  select c.source_id, c.body, c.evidence_ids
    from private.approved_source_content c
    join public.approved_source s on s.id = c.source_id
   where s.tenant_id = want_tenant
     and s.authority <> 'prohibited'
     and c.source_id = any(want_sources);
$$;

create or replace function public.ai_usage_spent(want_tenant text)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select spent_cents
      from private.ai_usage_month
     where tenant_id = want_tenant
       and period_start = date_trunc('month', timezone('UTC', now()))::date
  ), 0);
$$;

create or replace function public.reserve_ai_budget(want_tenant text, want_reservation uuid, want_cents numeric)
returns boolean language sql volatile security definer set search_path = ''
as $$ select private.reserve_ai_budget(want_tenant, want_reservation, want_cents) $$;

create or replace function public.settle_ai_budget(
  want_tenant text, want_reservation uuid, want_actual_cents numeric,
  want_input_tokens bigint, want_output_tokens bigint
)
returns boolean language sql volatile security definer set search_path = ''
as $$ select private.settle_ai_budget(want_tenant, want_reservation, want_actual_cents, want_input_tokens, want_output_tokens) $$;

create or replace function public.release_ai_budget(want_tenant text, want_reservation uuid)
returns boolean language sql volatile security definer set search_path = ''
as $$ select private.release_ai_budget(want_tenant, want_reservation) $$;

revoke all on function public.load_approved_source_content(text, uuid[]) from public, anon, authenticated;
revoke all on function public.ai_usage_spent(text) from public, anon, authenticated;
revoke all on function public.reserve_ai_budget(text, uuid, numeric) from public, anon, authenticated;
revoke all on function public.settle_ai_budget(text, uuid, numeric, bigint, bigint) from public, anon, authenticated;
revoke all on function public.release_ai_budget(text, uuid) from public, anon, authenticated;
grant execute on function public.load_approved_source_content(text, uuid[]) to service_role;
grant execute on function public.ai_usage_spent(text) to service_role;
grant execute on function public.reserve_ai_budget(text, uuid, numeric) to service_role;
grant execute on function public.settle_ai_budget(text, uuid, numeric, bigint, bigint) to service_role;
grant execute on function public.release_ai_budget(text, uuid) to service_role;

comment on table private.approved_source_content is
  'Server-only approved source text and evidence identifiers; never readable with a browser session.';
comment on table private.ai_usage_reservation is
  'Short-lived atomic reservations that prevent concurrent provider requests from exceeding one tenant budget.';
