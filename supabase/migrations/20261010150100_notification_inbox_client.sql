-- Authenticated, owner-bound operations over the notification foundation.

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
