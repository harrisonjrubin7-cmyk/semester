-- Durable notification inbox, preference, retry, and audit boundaries.
-- LOCAL/DISPOSABLE DATABASES ONLY. Run with:
--   supabase/check.sh notification-inbox

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text,
                     true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          address, now(), now(), now());
  insert into public.profiles (user_id, handle) values (who, split_part(address, '@', 1));
  update public.profiles set school_id = school where user_id = who;
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.refused(who uuid, statement text)
returns boolean language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute statement;
  execute 'reset role';
  return false;
exception when others then
  execute 'reset role';
  return true;
end $$;

create or replace function pg_temp.service_refused(statement text)
returns boolean language plpgsql as $$
begin
  execute 'set local role service_role';
  execute statement;
  execute 'reset role';
  return false;
exception when others then
  execute 'reset role';
  return true;
end $$;

do $$
declare
  student uuid;
  stranger uuid;
  notice_id uuid;
  duplicate_id uuid;
  sensitive_id uuid;
  dead_id uuid;
  claimed_delivery_id uuid;
  dead_delivery_id uuid;
  claim_id uuid := gen_random_uuid();
  n bigint;
  got text;
begin
  insert into public.schools (id, name, email_domains, edition) values
    ('notification-check', 'Notification Check School', array['notification-check.example'], 'higher_ed'),
    ('other-notification-check', 'Other Notification Check School', array['other-notification-check.example'], 'higher_ed');

  student := pg_temp.newuser('student@notification-check.example', 'notification-check');
  stranger := pg_temp.newuser('stranger@other-notification-check.example', 'other-notification-check');

  -- Preference writes are owner-bound and school-bound. Required
  -- categories cannot be disabled, and quiet hours are a complete pair.
  perform pg_temp.become(student);
  select p.channel into got from public.set_notification_preference(
    'notification-check', 'academic', 'push', true, '22:00', '07:00', 'America/Chicago') p;
  reset role;
  if got is distinct from 'push' then raise exception 'FAILED: preference write returned %', got; end if;
  raise notice 'ok  a user writes a preference for their pinned school';

  if not pg_temp.refused(student,
    $$select public.set_notification_preference('other-notification-check','academic','push',true,null,null,'UTC')$$) then
    raise exception 'FAILED: a user wrote a preference for another school';
  end if;
  raise notice 'ok  cross-school preference writes are refused';

  if not pg_temp.refused(student,
    $$select public.set_notification_preference('notification-check','safety','in_app',false,null,null,'UTC')$$) then
    raise exception 'FAILED: required in-app safety was disabled';
  end if;
  raise notice 'ok  required safety cannot be disabled';

  if not pg_temp.refused(student,
    $$select public.set_notification_preference('notification-check','academic','email',true,'22:00',null,'UTC')$$) then
    raise exception 'FAILED: an incomplete quiet-hours pair was accepted';
  end if;
  raise notice 'ok  incomplete quiet hours are refused';

  if not pg_temp.refused(student,
    $$select public.set_notification_preference('notification-check','academic','push',true,'22:00','07:00','Mars/Olympus')$$) then
    raise exception 'FAILED: an unknown time zone was accepted';
  end if;
  raise notice 'ok  unknown time zones are refused';

  perform pg_temp.become(stranger);
  perform pg_temp.counted('another user cannot read the preference row',
    (select count(*) from public.notification_preferences where person_id = student), 0);
  reset role;

  perform pg_temp.counted('anon cannot call preference mutation',
    has_function_privilege('anon', 'public.set_notification_preference(text,text,text,boolean,time,time,text)', 'execute')::int, 0);
  perform pg_temp.counted('authenticated cannot call the publisher',
    has_function_privilege('authenticated', 'public.publish_notification(text,uuid,uuid,text,text,text,boolean,text,text,text,text[],timestamptz)', 'execute')::int, 0);
  perform pg_temp.counted('authenticated cannot call the claimant',
    has_function_privilege('authenticated', 'public.claim_notification_deliveries(uuid,integer)', 'execute')::int, 0);
  perform pg_temp.counted('authenticated cannot call delivery settlement',
    has_function_privilege('authenticated', 'public.settle_notification_delivery(uuid,uuid,text,text,timestamptz)', 'execute')::int, 0);

  -- A service publisher persists the minimized in-app record, one delivery
  -- row per requested external channel, and an append-only queued event.
  execute 'set local role service_role';
  select public.publish_notification(
    'notification-check', student, student, 'academic', 'assignment.changed', 'dedupe-fixture', false,
    'Assignment updated', 'Review the latest assignment details.', '#/courses/course-42', array['push'], now())
    into notice_id;
  select public.publish_notification(
    'notification-check', student, student, 'academic', 'assignment.changed', 'dedupe-fixture', false,
    'Changed text is ignored', 'A duplicate does not rewrite the original.', '#/courses/other', array['push'], now())
    into duplicate_id;
  execute 'reset role';
  if duplicate_id is distinct from notice_id then raise exception 'FAILED: dedupe returned a different inbox id'; end if;
  perform pg_temp.counted('dedupe produces one inbox item',
    (select count(*) from public.notification_inbox where dedupe_key = 'dedupe-fixture'), 1);
  perform pg_temp.counted('dedupe produces one external delivery',
    (select count(*) from public.notification_deliveries where inbox_id = notice_id), 1);
  perform pg_temp.counted('the queued delivery has one initial audit event',
    (select count(*) from public.notification_delivery_events e join public.notification_deliveries d on d.id=e.delivery_id
      where d.inbox_id = notice_id and e.state = 'queued' and e.attempt = 0), 1);

  if not pg_temp.service_refused(format(
    'select public.publish_notification(%L,%L,%L,%L,%L,%L,true,%L,%L,%L,array[]::text[],now())',
    'notification-check', student, student, 'account_security', 'security.changed', 'security-bad',
    'Password changed', 'Your password was changed.', '#/settings/security')) then
    raise exception 'FAILED: a sensitive notification accepted a revealing preview';
  end if;
  raise notice 'ok  sensitive notifications require the fixed generic preview';

  execute 'set local role service_role';
  select public.publish_notification(
    'notification-check', student, student, 'account_security', 'security.changed', 'security-generic', true,
    'You have a new update', 'Open Semester to view this update.', '#/settings/security', array[]::text[], now())
    into sensitive_id;
  execute 'reset role';
  perform pg_temp.counted('the generic sensitive item is stored once',
    (select count(*) from public.notification_inbox where id = sensitive_id and sensitive), 1);

  -- RLS and the read/mutation functions expose only the recipient's rows.
  perform pg_temp.become(student);
  select count(*) into n from public.read_notification_inbox(50);
  reset role;
  perform pg_temp.counted('the recipient reads both active inbox items', n, 2);
  perform pg_temp.become(stranger);
  select count(*) into n from public.read_notification_inbox(50);
  reset role;
  perform pg_temp.counted('another user reads no inbox items', n, 0);

  if not pg_temp.refused(stranger, format('select public.mark_notification_inbox(%L,%L)', notice_id, 'read')) then
    raise exception 'FAILED: a stranger marked another recipient notification';
  end if;
  raise notice 'ok  only the recipient can mutate inbox state';
  perform pg_temp.become(student);
  select i.status into got from public.mark_notification_inbox(notice_id, 'read') i;
  reset role;
  if got is distinct from 'read' then raise exception 'FAILED: recipient did not mark notification read'; end if;
  raise notice 'ok  the recipient marks an item read';

  -- Claims are exclusive, retries are scheduled, and terminal transitions
  -- carry bounded attempt counts plus immutable audit evidence.
  execute 'set local role service_role';
  select d.id into claimed_delivery_id from public.claim_notification_deliveries(claim_id, 1) d;
  select d.state into got from public.settle_notification_delivery(
    claimed_delivery_id, claim_id, 'retry', 'provider_unavailable', now() + interval '1 hour') d;
  execute 'reset role';
  if got is distinct from 'retry' then raise exception 'FAILED: delivery was not scheduled for retry'; end if;
  perform pg_temp.counted('a future retry is not immediately claimable',
    (select count(*) from public.claim_notification_deliveries(gen_random_uuid(), 10)), 0);
  execute 'reset role';
  perform pg_temp.counted('the retry transition increments attempts once',
    (select attempts from public.notification_deliveries where id = claimed_delivery_id), 1);

  if not pg_temp.service_refused(format(
    'select public.settle_notification_delivery(%L,%L,%L,null,null)', claimed_delivery_id, gen_random_uuid(), 'delivered')) then
    raise exception 'FAILED: a mismatched claim settled a delivery';
  end if;
  raise notice 'ok  claim mismatch is refused';

  execute 'set local role service_role';
  update public.notification_deliveries set deliver_after = now() where id = claimed_delivery_id;
  select d.id into claimed_delivery_id from public.claim_notification_deliveries(claim_id, 1) d;
  select d.state into got from public.settle_notification_delivery(claimed_delivery_id, claim_id, 'delivered') d;
  execute 'reset role';
  if got is distinct from 'delivered' then raise exception 'FAILED: claimed delivery did not settle delivered'; end if;
  perform pg_temp.counted('delivery audit records queue, claims, retry, and delivery',
    (select count(*) from public.notification_delivery_events e where e.delivery_id = claimed_delivery_id), 5);

  execute 'set local role service_role';
  select public.publish_notification(
    'notification-check', student, student, 'transactional', 'billing.receipt', 'billing-dead-letter', false,
    'Receipt available', 'Your receipt is ready.', '#/billing', array['sms'], now()) into dead_id;
  select id into dead_delivery_id from public.notification_deliveries where inbox_id = dead_id;
  update public.notification_deliveries set attempts = 7 where id = dead_delivery_id;
  select d.id into dead_delivery_id from public.claim_notification_deliveries(claim_id, 1) d;
  select d.state into got from public.settle_notification_delivery(
    dead_delivery_id, claim_id, 'retry', 'provider_unavailable', now() + interval '1 hour') d;
  execute 'reset role';
  if got is distinct from 'dead_letter' then raise exception 'FAILED: attempt cap did not dead-letter'; end if;
  perform pg_temp.counted('dead-letter transition stops at the bounded attempt cap',
    (select attempts from public.notification_deliveries where id = dead_delivery_id), 8);

  if not pg_temp.service_refused(format(
    'delete from public.notification_delivery_events where delivery_id=%L', dead_delivery_id)) then
    raise exception 'FAILED: service role deleted delivery audit evidence';
  end if;
  raise notice 'ok  delivery events are append-only';

  perform pg_temp.counted('authenticated has no raw delivery table access',
    has_table_privilege('authenticated', 'public.notification_deliveries', 'select')::int, 0);
  perform pg_temp.counted('authenticated has no raw delivery event access',
    has_table_privilege('authenticated', 'public.notification_delivery_events', 'select')::int, 0);
  perform pg_temp.counted('service cannot delete delivery state',
    has_table_privilege('service_role', 'public.notification_deliveries', 'delete')::int, 0);
  perform pg_temp.counted('service cannot update or delete delivery audit events',
    (has_table_privilege('service_role', 'public.notification_delivery_events', 'update') or
     has_table_privilege('service_role', 'public.notification_delivery_events', 'delete'))::int, 0);
  perform pg_temp.counted('delivery rows contain no address, token, or rendered-content columns',
    (select count(*) from information_schema.columns
      where table_schema='public' and table_name='notification_deliveries'
        and column_name in ('email','phone','address','provider_token','device_token','rendered_body','rendered_content')), 0);
end $$;

rollback;
