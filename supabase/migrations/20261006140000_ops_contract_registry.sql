-- A registry of the operations read contracts, and a dashboard that reads it.
--
-- Stream 08, option C, first slice (docs/execute/08-projection-foundation-diff.md).
-- The PDFs ask for projected read models with a watermark and a freshness
-- figure. Nothing in this repository is projected yet: the console reads tables
-- live inside `security definer` functions that check a capability, and the
-- domain outbox has never carried an event in production. So this migration
-- builds the part that is true today and cheap: a list of what the operations
-- read contracts are, who may read them, and an honest statement of how fresh
-- each one is.
--
-- ## The registry
--
-- `private.ops_contract_registry` has one row per contract. `kind` is `live_read`
-- (computed from tables when called, so it is as fresh as the call) or
-- `projection` (computed ahead of time from the outbox; none exists, and no row
-- of that kind is inserted here). `gating_capabilities` is what the function
-- body names, read from the source; it is not a second source of authority.
-- The function is the authority, and `ops-read-contracts.check.sql` fails if a
-- row lists a capability the function does not mention.
--
-- Three console functions gate through something the pattern that read the
-- capabilities does not see (`console_approvals`, `console_break_glass`,
-- `console_customers`). Their arrays are empty and say so; they are not
-- guessed.
--
-- `staleness_budget_seconds` is null on every row. The PDFs state no budget and
-- none is invented here. A null budget reads as "no budget set", never as "fresh".
--
-- The table is service-role only and written by migration. A console action
-- that edits it would be a separate, approved change.
--
-- ## The dashboard
--
-- `public.ops_projection_dashboard()` returns the registry, with whether each
-- named function exists and, for a live read, the moment it was computed. It
-- requires `console:operate` at platform scope, like the command center. It
-- returns registry metadata only (no tenant or person), a few dozen rows, so it
-- takes no cursor and writes no read audit.

create table if not exists private.ops_contract_registry (
  name                     text    primary key check (name ~ '^[a-z][a-z0-9_]*$'),
  kind                     text    not null check (kind in ('live_read', 'projection')),
  version                  integer not null default 1 check (version >= 1),
  gating_capabilities      text[]  not null default '{}',
  staleness_budget_seconds integer check (staleness_budget_seconds is null or staleness_budget_seconds > 0),
  note                     text    not null default '',
  registered_in            text    not null check (length(trim(registered_in)) > 0)
);

alter table private.ops_contract_registry enable row level security;
revoke all on table private.ops_contract_registry from public, anon, authenticated;
grant select on table private.ops_contract_registry to service_role;

comment on table private.ops_contract_registry is
  'The operations read contracts, one row each: a live read or a projection, the capabilities its function names, and a staleness budget that is null until somebody sets one. Written by migration only.';

insert into private.ops_contract_registry (name, kind, gating_capabilities, note, registered_in) values
  ('console_audit_read',        'live_read', '{console:operate}', '', '20261006140000_ops_contract_registry.sql'),
  ('console_audit_status',      'live_read', '{console:operate}', '', '20261006140000_ops_contract_registry.sql'),
  ('console_command_center',    'live_read', '{console:operate}', '', '20261006140000_ops_contract_registry.sql'),
  ('console_figures',           'live_read', '{console:operate}', '', '20261006140000_ops_contract_registry.sql'),
  ('console_integration_health','live_read', '{console:operate,integration:configure,tenant:implement}', '', '20261006140000_ops_contract_registry.sql'),
  ('console_privacy_requests',  'live_read', '{console:operate,data_request:handle,tenant:implement}', '', '20261006140000_ops_contract_registry.sql'),
  ('console_release_incidents', 'live_read', '{console:operate,incident:communicate,tenant:implement}', '', '20261006140000_ops_contract_registry.sql'),
  ('console_tenant_access',     'live_read', '{audit:read,console:operate,tenant:implement}', '', '20261006140000_ops_contract_registry.sql'),
  ('console_tenant_operations', 'live_read', '{console:operate}', '', '20261006140000_ops_contract_registry.sql'),
  ('console_approvals',         'live_read', '{}', 'Gate not read: no capability name appears in the function body.', '20261006140000_ops_contract_registry.sql'),
  ('console_break_glass',       'live_read', '{}', 'Gate not read: no capability name appears in the function body.', '20261006140000_ops_contract_registry.sql'),
  ('console_customers',         'live_read', '{}', 'Gate not read: no capability name appears in the function body.', '20261006140000_ops_contract_registry.sql'),
  ('ops_projection_dashboard',  'live_read', '{console:operate}', 'This function.', '20261006140000_ops_contract_registry.sql')
on conflict (name) do nothing;

create or replace function public.ops_projection_dashboard()
returns table (
  name                     text,
  kind                     text,
  version                  integer,
  gating_capabilities      text[],
  staleness_budget_seconds integer,
  budget_state             text,
  as_of                    timestamptz,
  function_exists          boolean,
  note                     text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_capability('console:operate', 'platform', '') then
    raise exception using errcode = '42501', message = 'console:operate at platform scope is required.';
  end if;

  return query
  select r.name,
         r.kind,
         r.version,
         r.gating_capabilities,
         r.staleness_budget_seconds,
         case
           when r.staleness_budget_seconds is null then 'no budget set'
           when r.kind = 'live_read'                then 'live, computed when read'
           else 'unknown: no projection has run'
         end,
         case when r.kind = 'live_read' then now() else null end,
         exists (
           select 1
             from pg_catalog.pg_proc p
             join pg_catalog.pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = r.name
         ),
         r.note
    from private.ops_contract_registry r
   order by r.name;
end
$$;

revoke all on function public.ops_projection_dashboard() from public, anon;
grant execute on function public.ops_projection_dashboard() to authenticated;

comment on function public.ops_projection_dashboard() is
  'The operations read contracts and how fresh each is. console:operate at platform scope. Registry metadata only; a null staleness budget reads as no budget set.';
