-- Service-only publication and delivery state-machine operations.

create or replace function private.notification_event_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'notification delivery events are append-only'; end $$;
do $migration$
begin
  if not exists (
    select 1
      from pg_catalog.pg_trigger
     where tgname = 'notification_delivery_events_immutable'
       and tgrelid = 'public.notification_delivery_events'::regclass
       and not tgisinternal
  ) then
    execute 'create trigger notification_delivery_events_immutable
      before update on public.notification_delivery_events
      for each row execute function private.notification_event_immutable()';
  end if;
end
$migration$;

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
