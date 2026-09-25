-- Immutable evidence for every status change in the current moderation flow.
--
-- `public.reports` already limits status changes to a live
-- `moderation:action` capability, and column grants prevent a moderator from
-- rewriting the complaint itself. Until this migration, however, a status
-- could move from open to resolved with no durable answer to who moved it or
-- what the previous state was. This trigger records that transition without
-- copying the report reason, message copy, names, email addresses or raw user
-- identifiers into the audit log.

create table if not exists public.moderation_audit_event (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null,
  from_status text not null,
  to_status text not null,
  reporter_sha256 text not null check (reporter_sha256 ~ '^[0-9a-f]{64}$'),
  about_sha256 text check (about_sha256 is null or about_sha256 ~ '^[0-9a-f]{64}$'),
  actor_sha256 text check (actor_sha256 is null or actor_sha256 ~ '^[0-9a-f]{64}$'),
  actor_kind text not null check (actor_kind in ('authenticated', 'service')),
  occurred_at timestamptz not null default now(),
  check (from_status <> to_status)
);

create index if not exists moderation_audit_by_report_time
  on public.moderation_audit_event (report_id, occurred_at desc);
create index if not exists moderation_audit_by_time
  on public.moderation_audit_event (occurred_at desc);

alter table public.moderation_audit_event enable row level security;
revoke all on table public.moderation_audit_event from anon, authenticated;
grant select on table public.moderation_audit_event to authenticated;

drop policy if exists "report readers read moderation evidence"
  on public.moderation_audit_event;
create policy "report readers read moderation evidence"
  on public.moderation_audit_event
  for select to authenticated
  using (private.has_capability('report:read'));

create or replace function private.audit_report_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if old.status is not distinct from new.status then return new; end if;

  insert into public.moderation_audit_event (
    report_id, from_status, to_status, reporter_sha256, about_sha256,
    actor_sha256, actor_kind
  ) values (
    new.id,
    old.status,
    new.status,
    private.role_audit_sha256(new.reporter::text),
    case when new.about is null then null
      else private.role_audit_sha256(new.about::text) end,
    case when caller is null then null
      else private.role_audit_sha256(caller::text) end,
    case when caller is null then 'service' else 'authenticated' end
  );

  return new;
end $$;

create or replace function private.refuse_moderation_audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Moderation audit events are immutable.';
end $$;

revoke all on function private.audit_report_status_change()
  from public, anon, authenticated;
revoke all on function private.refuse_moderation_audit_change()
  from public, anon, authenticated;

drop trigger if exists audit_report_status_change on public.reports;
create trigger audit_report_status_change
  after update of status on public.reports
  for each row execute function private.audit_report_status_change();

drop trigger if exists keep_moderation_audit_immutable
  on public.moderation_audit_event;
create trigger keep_moderation_audit_immutable
  before update or delete on public.moderation_audit_event
  for each row execute function private.refuse_moderation_audit_change();

comment on table public.moderation_audit_event is
  'Append-only, content-free evidence of report status transitions. Visible only to live report:read capability holders.';
