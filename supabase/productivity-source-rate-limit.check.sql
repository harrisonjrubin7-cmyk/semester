-- Adversarial checks for the authenticated outbound-source budget.
--
--   How to run it: supabase/check.sh productivity-source-rate-limit

begin;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                        created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'source-a@example.invalid', now(), now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'source-b@example.invalid', now(), now(), now());

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text,
                     true);
  execute 'set local role authenticated';
end $$;

do $$
declare
  state text;
  message text;
begin
  perform pg_temp.become('11111111-1111-4111-8111-111111111111');
  for i in 1..10 loop
    perform public.take_productivity_source_rate_limit();
  end loop;

  begin
    perform public.take_productivity_source_rate_limit();
    raise exception 'FAILED: the eleventh source check was allowed';
  exception when others then
    get stacked diagnostics state = returned_sqlstate, message = message_text;
    if state <> '54000' or message not like 'You''ve sent a lot in a short time%' then
      raise exception 'FAILED: the eleventh check failed for the wrong reason (% %)', state, message;
    end if;
  end;
  raise notice 'ok  the eleventh check is refused by the shared limiter';

  reset role;
  perform pg_temp.become('22222222-2222-4222-8222-222222222222');
  perform public.take_productivity_source_rate_limit();
  raise notice 'ok  a second account has an independent allowance';
end $$;

do $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  begin
    perform public.take_productivity_source_rate_limit();
    raise exception 'FAILED: anonymous caller spent a source-check allowance';
  exception when insufficient_privilege then
    raise notice 'ok  anonymous callers cannot invoke the limiter';
  end;
end $$;

do $$
begin
  reset role;
  if exists (
    select 1 from private.direct_rate_limit
     where user_id = '11111111-1111-4111-8111-111111111111'
       and bucket = 'productivity_source'
     group by user_id, bucket
    having count(*) <> 10
  ) or (select count(*) from private.direct_rate_limit
        where user_id = '11111111-1111-4111-8111-111111111111'
          and bucket = 'productivity_source') <> 10 then
    raise exception 'FAILED: the limiter did not record exactly ten accepted hits';
  end if;
  raise notice 'ok  refusals do not inflate or reset the accepted-hit count';
end $$;

rollback;
