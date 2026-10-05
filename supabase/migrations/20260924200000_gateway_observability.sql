-- Truthful retention readiness for the durable institutional gateway.
-- A writable database is not enough: production is unavailable when the
-- cleanup job has stopped, because retention promises are part of correctness.

alter table private.gateway_health_probe
  add column if not exists last_retention_at timestamptz;

create or replace function public.gateway_purge_journal()
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  removed bigint;
begin
  removed := private.gateway_purge_journal();
  insert into private.gateway_health_probe (singleton, touched_at, last_retention_at)
  values (true, now(), now())
  on conflict (singleton) do update
    set touched_at = excluded.touched_at,
        last_retention_at = excluded.last_retention_at;
  return removed;
end $$;

create or replace function private.gateway_retention_health()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select last_retention_at > now() - interval '2 hours'
       from private.gateway_health_probe
      where singleton),
    false
  );
$$;

create or replace function public.gateway_retention_health()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.gateway_retention_health() $$;

revoke all on function private.gateway_retention_health() from public, anon, authenticated;
revoke all on function public.gateway_retention_health() from public, anon, authenticated;
grant execute on function public.gateway_retention_health() to service_role;

comment on function public.gateway_retention_health() is
  'Service-only proof that the hourly institutional retention sweep ran within two hours.';
