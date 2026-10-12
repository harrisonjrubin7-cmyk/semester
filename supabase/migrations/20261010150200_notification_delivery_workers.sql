-- Service-only publication and delivery state-machine operations. The event
-- table remains append-only for the service boundary through table grants: it
-- receives SELECT and INSERT only, never UPDATE or DELETE.

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

revoke all on function public.publish_notification(text,uuid,uuid,text,text,text,boolean,text,text,text,text[],timestamptz) from public, anon, authenticated;
grant execute on function public.publish_notification(text,uuid,uuid,text,text,text,boolean,text,text,text,text[],timestamptz) to service_role;
