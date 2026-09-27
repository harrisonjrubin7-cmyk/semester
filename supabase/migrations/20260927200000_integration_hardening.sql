-- Semester — retention, legal hold and health for the integration tables.
--
-- Phase 7. Until this file the sync logs had a retention *answer* in
-- RETENTION.md and no mechanism: "no time-based purge exists yet". This adds
-- the purge, the hold that stops it, a record of each sweep, and the health
-- question a monitor asks. All three functions are for the service role only;
-- a scheduled job calls them (docs/INTEGRATION-OPERATOR-RUNBOOK.md).
--
-- What the sweep removes, per school, unless that connection is on hold:
--
--   sync runs completed more than 180 days ago (their errors go with them)
--   sync errors resolved, or raised, more than 180 days ago
--   webhook events processed more than 30 days ago — past that, a redelivery
--     of the same key is no longer recognised as a duplicate; the runbook says so
--   dead letters resolved more than 90 days ago
--   source snapshots past their own retention_expires_at
--   canonical references the source deleted more than 30 days ago
--
-- What it never touches: connections, scopes, mappings, consent, the audit
-- trail, and any reference still live at its source.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

alter table public.integration_connections
  add column if not exists legal_hold boolean not null default false;
alter table public.integration_connections
  add column if not exists legal_hold_reason text
  check (legal_hold_reason is null or length(legal_hold_reason) <= 1000);

alter table public.integration_connections
  drop constraint if exists connection_hold_has_reason;
alter table public.integration_connections
  add constraint connection_hold_has_reason
  check (not legal_hold or length(trim(coalesce(legal_hold_reason, ''))) > 0);

-- Readable beside the rest of the connection; set only by the service role,
-- because a hold is a legal instruction, not a configuration choice.
grant select (legal_hold, legal_hold_reason) on public.integration_connections to authenticated;

create table if not exists public.integration_retention_runs (
  id                    uuid        primary key default gen_random_uuid(),
  tenant_id             text        not null references public.schools(id) on delete cascade,
  ran_at                timestamptz not null default now(),
  runs_deleted          integer     not null default 0,
  errors_deleted        integer     not null default 0,
  events_deleted        integer     not null default 0,
  dead_letters_deleted  integer     not null default 0,
  snapshots_deleted     integer     not null default 0,
  references_deleted    integer     not null default 0,
  connections_held      integer     not null default 0
);
create index if not exists integration_retention_runs_by_tenant_time
  on public.integration_retention_runs (tenant_id, ran_at desc);

alter table public.integration_retention_runs enable row level security;
revoke all on table public.integration_retention_runs from anon, authenticated;
grant select on table public.integration_retention_runs to authenticated;
drop policy if exists "integration viewers read retention runs" on public.integration_retention_runs;
create policy "integration viewers read retention runs" on public.integration_retention_runs
  for select to authenticated using (private.has_capability('integration:view', 'school', tenant_id));

create or replace function public.integration_retention_sweep()
returns setof public.integration_retention_runs
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  t text;
  held uuid[];
  n_runs integer; n_errors integer; n_events integer; n_dead integer; n_snaps integer; n_refs integer;
  r public.integration_retention_runs;
begin
  for t in select distinct tenant_id from public.integration_connections loop
    select coalesce(array_agg(id), '{}') into held
      from public.integration_connections where tenant_id = t and legal_hold;

    delete from public.integration_sync_errors
     where tenant_id = t and not (connection_id = any(held))
       and coalesce(resolved_at, created_at) < now() - interval '180 days';
    get diagnostics n_errors = row_count;

    delete from public.integration_sync_runs
     where tenant_id = t and not (connection_id = any(held))
       and completed_at is not null and completed_at < now() - interval '180 days';
    get diagnostics n_runs = row_count;

    delete from public.integration_webhook_events
     where tenant_id = t and not (connection_id = any(held))
       and processed_at is not null and processed_at < now() - interval '30 days';
    get diagnostics n_events = row_count;

    delete from public.integration_dead_letter_events
     where tenant_id = t and not (connection_id = any(held))
       and resolved_at is not null and resolved_at < now() - interval '90 days';
    get diagnostics n_dead = row_count;

    delete from public.source_snapshots s
     using public.source_records sr
     where s.tenant_id = t and sr.id = s.source_record_id
       and (sr.connection_id is null or not (sr.connection_id = any(held)))
       and s.retention_expires_at is not null and s.retention_expires_at < now();
    get diagnostics n_snaps = row_count;

    delete from public.canonical_entity_references
     where tenant_id = t and (connection_id is null or not (connection_id = any(held)))
       and external_deleted_at is not null and external_deleted_at < now() - interval '30 days';
    get diagnostics n_refs = row_count;

    insert into public.integration_retention_runs
      (tenant_id, runs_deleted, errors_deleted, events_deleted, dead_letters_deleted,
       snapshots_deleted, references_deleted, connections_held)
    values (t, n_runs, n_errors, n_events, n_dead, n_snaps, n_refs, coalesce(array_length(held, 1), 0))
    returning * into r;
    return next r;
  end loop;
end $$;
revoke all on function public.integration_retention_sweep() from public;
revoke all on function public.integration_retention_sweep() from anon, authenticated;
grant execute on function public.integration_retention_sweep() to service_role;

-- What a monitor asks every few minutes: which connections are live but
-- stale, erroring, or holding dead letters. Counts and times only.
create or replace function public.integration_health()
returns table (
  tenant_id text,
  connection text,
  provider_domain text,
  status text,
  minutes_since_success integer,
  stale boolean,
  open_errors integer,
  open_dead_letters integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.tenant_id,
         c.public_id,
         c.provider_domain,
         c.status,
         case when c.last_successful_sync_at is null then null
              else (extract(epoch from now() - c.last_successful_sync_at) / 60)::integer end,
         c.approved_at is not null
           and c.status in ('healthy', 'degraded', 'error')
           and (c.last_successful_sync_at is null
                or c.last_successful_sync_at < now() - 2 * coalesce(c.freshness_target, interval '1 day')),
         (select count(*)::integer from public.integration_sync_errors e
           where e.connection_id = c.id and e.resolved_at is null),
         (select count(*)::integer from public.integration_dead_letter_events d
           where d.connection_id = c.id and d.resolved_at is null)
    from public.integration_connections c
   where c.status <> 'disconnected';
$$;
revoke all on function public.integration_health() from public;
revoke all on function public.integration_health() from anon, authenticated;
grant execute on function public.integration_health() to service_role;

comment on column public.integration_connections.legal_hold is
  'Set by the service role on a legal instruction. While true, the retention sweep removes nothing belonging to this connection.';
comment on table public.integration_retention_runs is
  'One row per school per retention sweep: what was removed, and how many connections were held.';
