-- Milestone 9: a durable, fail-closed notification inbox foundation.
-- No provider is activated here. Producers and senders remain separate gates.

create table if not exists public.notification_preferences (
  school_id text not null,
  person_id uuid not null,
  category text not null check (category in ('safety','account_security','transactional','academic','marketing')),
  channel text not null check (channel in ('in_app','push','email','sms')),
  enabled boolean not null,
  quiet_start time,
  quiet_end time,
  time_zone text not null default 'UTC' check (length(time_zone) between 1 and 64),
  updated_at timestamptz not null default now(),
  primary key (school_id, person_id, category, channel),
  constraint notification_quiet_pair check ((quiet_start is null) = (quiet_end is null)),
  constraint notification_required_category check (not (category in ('safety','account_security','transactional') and not enabled))
);

alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from public, anon;
grant select on public.notification_preferences to authenticated;
drop policy if exists notification_preferences_owner_read on public.notification_preferences;
create policy notification_preferences_owner_read on public.notification_preferences
  for select to authenticated using ((select auth.uid()) = person_id);

create table if not exists public.notification_inbox (
  id uuid primary key default gen_random_uuid(),
  school_id text not null,
  recipient_id uuid not null,
  subject_id uuid,
  category text not null check (category in ('safety','account_security','transactional','academic','marketing')),
  template_id text not null check (template_id ~ '^[a-z0-9][a-z0-9._-]{0,95}$'),
  dedupe_key text not null check (length(dedupe_key) between 1 and 160),
  sensitive boolean not null default false,
  preview_title text not null check (length(preview_title) between 1 and 120),
  preview_body text not null check (length(preview_body) between 1 and 240),
  destination text check (destination is null or destination ~ '^#/[a-z0-9/_-]{1,120}$'),
  status text not null default 'unread' check (status in ('unread','read','archived')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  archived_at timestamptz,
  expires_at timestamptz,
  constraint notification_generic_sensitive_preview check (
    not sensitive or (preview_title = 'You have a new update' and preview_body = 'Open Semester to view this update.')
  ),
  constraint notification_inbox_status_times check (
    (status = 'unread' and read_at is null and archived_at is null)
    or (status = 'read' and read_at is not null and archived_at is null)
    or (status = 'archived' and archived_at is not null)
  ),
  constraint notification_inbox_identity unique (id, school_id, recipient_id),
  unique (school_id, recipient_id, dedupe_key)
);

create index if not exists notification_inbox_recipient_created on public.notification_inbox (recipient_id, created_at desc);
alter table public.notification_inbox enable row level security;
revoke all on public.notification_inbox from public, anon;
grant select on public.notification_inbox to authenticated;
drop policy if exists notification_inbox_owner_read on public.notification_inbox;
create policy notification_inbox_owner_read on public.notification_inbox
  for select to authenticated using ((select auth.uid()) = recipient_id);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  inbox_id uuid not null,
  school_id text not null,
  recipient_id uuid not null,
  channel text not null check (channel in ('push','email','sms')),
  state text not null default 'queued' check (state in ('queued','claimed','delivered','retry','dead_letter','suppressed')),
  deliver_after timestamptz not null default now(),
  attempts integer not null default 0 check (attempts between 0 and 8),
  claim_id uuid,
  claimed_at timestamptz,
  delivered_at timestamptz,
  last_error_code text check (last_error_code is null or last_error_code ~ '^[a-z0-9_]{1,64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_delivery_claim_pair check ((claim_id is null) = (claimed_at is null)),
  constraint notification_delivery_claim_state check ((state = 'claimed') = (claim_id is not null)),
  constraint notification_delivery_terminal_shape check (
    (state = 'delivered' and delivered_at is not null and claim_id is null)
    or (state <> 'delivered' and delivered_at is null)
  ),
  constraint notification_deliveries_identity unique (id, school_id, recipient_id),
  unique (inbox_id, channel)
);

create index if not exists notification_deliveries_due on public.notification_deliveries (deliver_after, created_at)
  where state in ('queued','retry');
alter table public.notification_deliveries enable row level security;
revoke all on public.notification_deliveries from public, anon, authenticated, service_role;
grant select, insert, update on public.notification_deliveries to service_role;

create table if not exists public.notification_delivery_events (
  id bigint generated always as identity primary key,
  delivery_id uuid not null,
  school_id text not null,
  recipient_id uuid not null,
  state text not null check (state in ('queued','claimed','delivered','retry','dead_letter','suppressed')),
  attempt integer not null check (attempt between 0 and 8),
  reason_code text check (reason_code is null or reason_code ~ '^[a-z0-9_]{1,64}$'),
  occurred_at timestamptz not null default now()
);

create index if not exists notification_delivery_events_delivery on public.notification_delivery_events (delivery_id, occurred_at);
alter table public.notification_delivery_events enable row level security;
revoke all on public.notification_delivery_events from public, anon, authenticated, service_role;
grant select, insert on public.notification_delivery_events to service_role;

-- Supabase's schema listeners inspect each public-table DDL command. Add and
-- validate relationships separately so a table first exists in a complete,
-- relationship-free shape, and guard each constraint so a failed deploy can
-- safely reapply this migration.
do $migration$
begin
  if not exists (select 1 from pg_constraint where conname = 'notification_preferences_school_fkey' and conrelid = 'public.notification_preferences'::regclass) then
    alter table public.notification_preferences add constraint notification_preferences_school_fkey
      foreign key (school_id) references public.schools(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notification_preferences_person_fkey' and conrelid = 'public.notification_preferences'::regclass) then
    alter table public.notification_preferences add constraint notification_preferences_person_fkey
      foreign key (person_id) references auth.users(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notification_inbox_school_fkey' and conrelid = 'public.notification_inbox'::regclass) then
    alter table public.notification_inbox add constraint notification_inbox_school_fkey
      foreign key (school_id) references public.schools(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notification_inbox_recipient_fkey' and conrelid = 'public.notification_inbox'::regclass) then
    alter table public.notification_inbox add constraint notification_inbox_recipient_fkey
      foreign key (recipient_id) references auth.users(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notification_inbox_subject_fkey' and conrelid = 'public.notification_inbox'::regclass) then
    alter table public.notification_inbox add constraint notification_inbox_subject_fkey
      foreign key (subject_id) references auth.users(id) on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notification_deliveries_inbox_fkey' and conrelid = 'public.notification_deliveries'::regclass) then
    alter table public.notification_deliveries add constraint notification_deliveries_inbox_fkey
      foreign key (inbox_id) references public.notification_inbox(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notification_deliveries_inbox_scope_fkey' and conrelid = 'public.notification_deliveries'::regclass) then
    alter table public.notification_deliveries add constraint notification_deliveries_inbox_scope_fkey
      foreign key (inbox_id, school_id, recipient_id)
      references public.notification_inbox(id, school_id, recipient_id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notification_deliveries_school_fkey' and conrelid = 'public.notification_deliveries'::regclass) then
    alter table public.notification_deliveries add constraint notification_deliveries_school_fkey
      foreign key (school_id) references public.schools(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notification_deliveries_recipient_fkey' and conrelid = 'public.notification_deliveries'::regclass) then
    alter table public.notification_deliveries add constraint notification_deliveries_recipient_fkey
      foreign key (recipient_id) references auth.users(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notification_delivery_events_delivery_fkey' and conrelid = 'public.notification_delivery_events'::regclass) then
    alter table public.notification_delivery_events add constraint notification_delivery_events_delivery_fkey
      foreign key (delivery_id) references public.notification_deliveries(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notification_delivery_events_scope_fkey' and conrelid = 'public.notification_delivery_events'::regclass) then
    alter table public.notification_delivery_events add constraint notification_delivery_events_scope_fkey
      foreign key (delivery_id, school_id, recipient_id)
      references public.notification_deliveries(id, school_id, recipient_id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notification_delivery_events_school_fkey' and conrelid = 'public.notification_delivery_events'::regclass) then
    alter table public.notification_delivery_events add constraint notification_delivery_events_school_fkey
      foreign key (school_id) references public.schools(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notification_delivery_events_recipient_fkey' and conrelid = 'public.notification_delivery_events'::regclass) then
    alter table public.notification_delivery_events add constraint notification_delivery_events_recipient_fkey
      foreign key (recipient_id) references auth.users(id) on delete cascade not valid;
  end if;
end
$migration$;

alter table public.notification_preferences validate constraint notification_preferences_school_fkey;
alter table public.notification_preferences validate constraint notification_preferences_person_fkey;
alter table public.notification_inbox validate constraint notification_inbox_school_fkey;
alter table public.notification_inbox validate constraint notification_inbox_recipient_fkey;
alter table public.notification_inbox validate constraint notification_inbox_subject_fkey;
alter table public.notification_deliveries validate constraint notification_deliveries_inbox_fkey;
alter table public.notification_deliveries validate constraint notification_deliveries_inbox_scope_fkey;
alter table public.notification_deliveries validate constraint notification_deliveries_school_fkey;
alter table public.notification_deliveries validate constraint notification_deliveries_recipient_fkey;
alter table public.notification_delivery_events validate constraint notification_delivery_events_delivery_fkey;
alter table public.notification_delivery_events validate constraint notification_delivery_events_scope_fkey;
alter table public.notification_delivery_events validate constraint notification_delivery_events_school_fkey;
alter table public.notification_delivery_events validate constraint notification_delivery_events_recipient_fkey;

-- Client and worker functions follow in two bounded migrations. Supabase and
-- the PostgreSQL 17 policy harness each execute a migration as one DDL batch;
-- keeping those definitions separate avoids exhausting a backend while its
-- schema listeners process this relation-heavy foundation.
