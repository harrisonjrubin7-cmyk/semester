-- The dollar meter on the shared key (20261004170000_ai_spend_meter).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- What must hold:
--   * a reservation that fits is added and the new total answered; one that
--     would pass the cap changes nothing and answers -1, to the micro-dollar;
--   * a reservation larger than the whole allowance writes no row at all;
--   * settling gives money back and never takes the total below zero;
--   * a charge with no cap is recorded even when it passes what was reserved;
--   * the dollar meter and `count_call` share one row and neither disturbs
--     the other, in either order;
--   * months are independent;
--   * a negative total cannot be written by any route;
--   * neither a visitor nor a signed-in account can call it; the service role can.

begin;

create or replace function pg_temp.is(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got::text, 'null'); end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.newuser(address text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
  return who;
end $$;

do $$
declare
  a uuid := pg_temp.newuser('a-spend@example.edu');
  b uuid := pg_temp.newuser('b-spend@example.edu');
  c uuid := pg_temp.newuser('c-spend@example.edu');
  d uuid := pg_temp.newuser('d-spend@example.edu');
  cap constant bigint := 750000;       -- $0.75
  n bigint;
  rows bigint;
begin
  -- ── a reservation that fits, and the boundary ──────────────────────────
  perform pg_temp.is('first reservation is added', public.add_spend(a, '2026-10', 300000, cap), 300000);
  perform pg_temp.is('second reservation reaches the cap exactly', public.add_spend(a, '2026-10', 450000, cap), 750000);
  perform pg_temp.is('one micro-dollar more is refused', public.add_spend(a, '2026-10', 1, cap), -1);
  select cost_micros into n from public.usage where user_id = a and month = '2026-10';
  perform pg_temp.is('and the refusal changed nothing', n, 750000);

  -- ── settling gives money back, never below zero ───────────────────────
  perform pg_temp.is('settling returns the unused part', public.add_spend(a, '2026-10', -200000, null), 550000);
  perform pg_temp.is('and what was returned can be reserved again', public.add_spend(a, '2026-10', 200000, cap), 750000);
  perform pg_temp.is('settling more than is held stops at zero', public.add_spend(a, '2026-10', -9000000000, null), 0);

  -- ── a charge with no cap is recorded even when it is over ─────────────
  perform pg_temp.is('an uncapped charge is recorded', public.add_spend(a, '2026-10', 900000, null), 900000);
  perform pg_temp.is('and the next reservation is then refused', public.add_spend(a, '2026-10', 1, cap), -1);

  -- ── a reservation bigger than the whole allowance writes no row ───────
  perform pg_temp.is('an impossible first reservation is refused', public.add_spend(b, '2026-10', cap + 1, cap), -1);
  select count(*) into rows from public.usage where user_id = b;
  perform pg_temp.is('and no row was written for it', rows, 0);

  -- ── the dollar meter and the call meter share a row ───────────────────
  perform pg_temp.is('a first reservation creates the row with no calls', public.add_spend(c, '2026-10', 40000, cap), 40000);
  select calls into n from public.usage where user_id = c and month = '2026-10';
  perform pg_temp.is('no call has been counted', n, 0);
  perform pg_temp.is('count_call then counts one', public.count_call(c, '2026-10'), 1);
  select cost_micros into n from public.usage where user_id = c and month = '2026-10';
  perform pg_temp.is('and left the money alone', n, 40000);
  perform pg_temp.is('a later reservation leaves the call alone', public.add_spend(c, '2026-10', 10000, cap), 50000);
  select calls into n from public.usage where user_id = c and month = '2026-10';
  perform pg_temp.is('the call count is still one', n, 1);

  -- the other order: calls first, money after
  perform pg_temp.is('calls first: count_call', public.count_call(d, '2026-10'), 1);
  perform pg_temp.is('calls first: money is added to that row', public.add_spend(d, '2026-10', 123456, cap), 123456);
  select count(*) into rows from public.usage where user_id = d;
  perform pg_temp.is('calls first: still one row', rows, 1);

  -- ── months are independent ─────────────────────────────────────────────
  perform pg_temp.is('next month starts at zero', public.add_spend(a, '2026-11', 100, cap), 100);
  select cost_micros into n from public.usage where user_id = a and month = '2026-10';
  perform pg_temp.is('and this month is unchanged', n, 900000);

  -- ── settling an account with no row records nothing negative ──────────
  perform pg_temp.is('a refund against no row is zero, not negative', public.add_spend(b, '2026-12', -5, null), 0);

  -- ── a negative total cannot be written by any route ───────────────────
  begin
    update public.usage set cost_micros = -1 where user_id = a and month = '2026-10';
    raise exception 'FAILED: a negative total was written';
  exception when check_violation then
    raise notice 'ok  a negative total is refused by the table';
  end;

  -- ── it refuses to guess ───────────────────────────────────────────────
  begin
    perform public.add_spend(null, '2026-10', 1, cap);
    raise exception 'FAILED: a null account was accepted';
  exception when raise_exception then
    if sqlerrm like 'FAILED%' then raise; end if;
    raise notice 'ok  a null account is refused';
  end;
end $$;

-- ── who may call it ──────────────────────────────────────────────────────
do $$
begin
  if has_function_privilege('anon', 'public.add_spend(uuid, text, bigint, bigint)', 'execute') then
    raise exception 'FAILED: a visitor can call add_spend';
  end if;
  if has_function_privilege('authenticated', 'public.add_spend(uuid, text, bigint, bigint)', 'execute') then
    raise exception 'FAILED: a signed-in account can call add_spend';
  end if;
  if not has_function_privilege('service_role', 'public.add_spend(uuid, text, bigint, bigint)', 'execute') then
    raise exception 'FAILED: the service role cannot call add_spend';
  end if;
  raise notice 'ok  only the service role can call add_spend';
end $$;

rollback;
