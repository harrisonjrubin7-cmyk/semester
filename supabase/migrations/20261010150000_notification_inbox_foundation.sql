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

create or replace function public.set_notification_preference(
  want_school text, want_category text, want_channel text, want_enabled boolean,
  want_quiet_start time default null, want_quiet_end time default null, want_time_zone text default 'UTC'
) returns public.notification_preferences
language plpgsql security definer set search_path = '' as $$
declare out_row public.notification_preferences;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.profiles p
     where p.user_id = auth.uid() and p.school_id = want_school
  ) then
    raise exception 'notification preference school mismatch';
  end if;
  if want_category not in ('safety','account_security','transactional','academic','marketing')
     or want_channel not in ('in_app','push','email','sms') then raise exception 'invalid notification preference'; end if;
  if want_category in ('safety','account_security','transactional') and not want_enabled then
    raise exception 'required notification categories cannot be disabled';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = want_time_zone) then
    raise exception 'invalid notification time zone';
  end if;
  insert into public.notification_preferences (school_id, person_id, category, channel, enabled, quiet_start, quiet_end, time_zone)
  values (want_school, auth.uid(), want_category, want_channel, want_enabled, want_quiet_start, want_quiet_end, want_time_zone)
  on conflict (school_id, person_id, category, channel) do update
    set enabled = excluded.enabled, quiet_start = excluded.quiet_start, quiet_end = excluded.quiet_end,
        time_zone = excluded.time_zone, updated_at = now()
  returning * into out_row;
  return out_row;
end $$;

create or replace function public.read_notification_inbox(want_limit integer default 50)
returns setof public.notification_inbox
language sql security definer stable set search_path = '' as $$
  select i from public.notification_inbox i
   where i.recipient_id = auth.uid() and (i.expires_at is null or i.expires_at > now())
   order by i.created_at desc limit least(greatest(coalesce(want_limit, 50), 1), 200)
$$;

create or replace function public.mark_notification_inbox(want_id uuid, want_status text)
returns public.notification_inbox
language plpgsql security definer set search_path = '' as $$
declare out_row public.notification_inbox;
begin
  if want_status not in ('read','archived') then raise exception 'invalid inbox state'; end if;
  update public.notification_inbox set status = want_status,
    read_at = case when want_status = 'read' then coalesce(read_at, now()) else read_at end,
    archived_at = case when want_status = 'archived' then now() else null end
  where id = want_id and recipient_id = auth.uid() returning * into out_row;
  if out_row.id is null then raise exception 'notification not found'; end if;
  return out_row;
end $$;

revoke all on function public.set_notification_preference(text,text,text,boolean,time,time,text) from public, anon;
revoke all on function public.read_notification_inbox(integer) from public, anon;
revoke all on function public.mark_notification_inbox(uuid,text) from public, anon;
grant execute on function public.set_notification_preference(text,text,text,boolean,time,time,text) to authenticated;
grant execute on function public.read_notification_inbox(integer) to authenticated;
grant execute on function public.mark_notification_inbox(uuid,text) to authenticated;

create or replace function private.notification_event_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'notification delivery events are append-only'; end $$;
drop trigger if exists notification_delivery_events_immutable on public.notification_delivery_events;
create trigger notification_delivery_events_immutable
before update on public.notification_delivery_events
for each row execute function private.notification_event_immutable();

create or replace function public.publish_notification(
  want_school text, want_recipient uuid, want_subject uuid, want_category text,
  want_template text, want_dedupe text, want_sensitive boolean,
  want_preview_title text, want_preview_body text, want_destination text,
  want_channels text[] default array[]::text[], want_deliver_after timestamptz default now()
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare notice_id uuid; delivery_id uuid; wanted text;
begin
  if not exists (
    select 1 from public.profiles p
     where p.user_id = want_recipient and p.school_id = want_school
  ) then
    raise exception 'notification recipient school mismatch';
  end if;
  if want_subject is not null and not exists (
    select 1 from public.profiles p
     where p.user_id = want_subject and p.school_id = want_school
  ) then
    raise exception 'notification subject school mismatch';
  end if;
  insert into public.notification_inbox
    (school_id, recipient_id, subject_id, category, template_id, dedupe_key, sensitive, preview_title, preview_body, destination)
  values
    (want_school, want_recipient, want_subject, want_category, want_template, want_dedupe, want_sensitive,
     want_preview_title, want_preview_body, want_destination)
  on conflict (school_id, recipient_id, dedupe_key) do update
    set dedupe_key = public.notification_inbox.dedupe_key
  returning id into notice_id;

  foreach wanted in array coalesce(want_channels, array[]::text[]) loop
    if wanted not in ('push','email','sms') then raise exception 'invalid delivery channel'; end if;
    insert into public.notification_deliveries (inbox_id, school_id, recipient_id, channel, deliver_after)
    values (notice_id, want_school, want_recipient, wanted, greatest(want_deliver_after, now()))
    on conflict (inbox_id, channel) do nothing returning id into delivery_id;
    if delivery_id is not null then
      insert into public.notification_delivery_events (delivery_id, school_id, recipient_id, state, attempt)
      values (delivery_id, want_school, want_recipient, 'queued', 0);
    end if;
    delivery_id := null;
  end loop;
  return notice_id;
end $$;

create or replace function public.claim_notification_deliveries(want_claim uuid, want_limit integer default 100)
returns setof public.notification_deliveries
language sql security definer set search_path = '' as $$
  with due as (
    select d.id from public.notification_deliveries d
     where want_claim is not null and d.state in ('queued','retry') and d.deliver_after <= now()
     order by d.deliver_after, d.created_at
     for update skip locked limit least(greatest(coalesce(want_limit,100),1),500)
  ), claimed as (
    update public.notification_deliveries d set state='claimed', claim_id=want_claim, claimed_at=now(), updated_at=now()
     from due where d.id=due.id returning d.*
  ), audited as (
    insert into public.notification_delivery_events (delivery_id, school_id, recipient_id, state, attempt)
    select id, school_id, recipient_id, 'claimed', attempts from claimed
  ) select c from claimed c
$$;

create or replace function public.settle_notification_delivery(
  want_id uuid, want_claim uuid, want_outcome text, want_error_code text default null,
  want_retry_after timestamptz default null
) returns public.notification_deliveries
language plpgsql security definer set search_path = '' as $$
declare row_now public.notification_deliveries; next_state text; next_attempt integer;
begin
  select * into row_now from public.notification_deliveries where id=want_id for update;
  if row_now.id is null or row_now.state <> 'claimed' or row_now.claim_id is distinct from want_claim then
    raise exception 'delivery claim mismatch';
  end if;
  next_attempt := row_now.attempts + 1;
  if want_outcome = 'delivered' then next_state := 'delivered';
  elsif want_outcome = 'suppressed' then next_state := 'suppressed';
  elsif want_outcome = 'retry' and next_attempt < 8 and want_retry_after is not null and want_retry_after > now() then next_state := 'retry';
  elsif want_outcome in ('retry','dead_letter') then next_state := 'dead_letter';
  else raise exception 'invalid delivery outcome'; end if;

  update public.notification_deliveries set state=next_state, attempts=next_attempt,
    claim_id=null, claimed_at=null, delivered_at=case when next_state='delivered' then now() else null end,
    deliver_after=case when next_state='retry' then want_retry_after else deliver_after end,
    last_error_code=case when next_state in ('retry','dead_letter') then want_error_code else null end, updated_at=now()
  where id=want_id returning * into row_now;
  insert into public.notification_delivery_events (delivery_id, school_id, recipient_id, state, attempt, reason_code)
  values (row_now.id, row_now.school_id, row_now.recipient_id, next_state, next_attempt, row_now.last_error_code);
  return row_now;
end $$;

revoke all on function public.publish_notification(text,uuid,uuid,text,text,text,boolean,text,text,text,text[],timestamptz) from public, anon, authenticated;
revoke all on function public.claim_notification_deliveries(uuid,integer) from public, anon, authenticated;
revoke all on function public.settle_notification_delivery(uuid,uuid,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.publish_notification(text,uuid,uuid,text,text,text,boolean,text,text,text,text[],timestamptz) to service_role;
grant execute on function public.claim_notification_deliveries(uuid,integer) to service_role;
grant execute on function public.settle_notification_delivery(uuid,uuid,text,text,timestamptz) to service_role;
