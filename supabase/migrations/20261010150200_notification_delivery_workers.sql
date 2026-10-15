-- Service-only publication and delivery state-machine operations. The event
-- table remains append-only for the service boundary through table grants: it
-- receives SELECT and INSERT only, never UPDATE or DELETE.

create or replace function public.publish_notification(
  want_school text, want_recipient uuid, want_subject uuid, want_category text,
  want_template text, want_dedupe text, want_sensitive boolean,
  want_preview_title text, want_preview_body text, want_destination text,
  want_channels text[] default '{}'::text[], want_deliver_after timestamptz default now()
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare notice_id uuid;
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

  if exists (
    select 1
      from unnest(coalesce(want_channels, '{}'::text[])) as requested(channel)
     where requested.channel not in ('push','email','sms')
  ) then
    raise exception 'invalid delivery channel';
  end if;

  with inserted as (
    insert into public.notification_deliveries (inbox_id, school_id, recipient_id, channel, deliver_after)
    select notice_id, want_school, want_recipient, requested.channel, greatest(want_deliver_after, now())
      from unnest(coalesce(want_channels, '{}'::text[])) as requested(channel)
    on conflict (inbox_id, channel) do nothing
    returning id, school_id, recipient_id
  )
  insert into public.notification_delivery_events (delivery_id, school_id, recipient_id, state, attempt)
  select id, school_id, recipient_id, 'queued', 0 from inserted;
  return notice_id;
end $$;

revoke all on function public.publish_notification(text,uuid,uuid,text,text,text,boolean,text,text,text,text[],timestamptz) from public, anon, authenticated;
grant execute on function public.publish_notification(text,uuid,uuid,text,text,text,boolean,text,text,text,text[],timestamptz) to service_role;
