-- The daily token quota on the shared key (20261011210000_daily_token_quota).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- What must hold:
--   * a reservation that fits is added and the new total answered; one that
--     would pass the quota changes nothing and answers -1, to the token;
--   * a reservation larger than the whole quota writes no row at all;
--   * settling gives tokens back and never takes the total below zero;
--   * a charge with no cap is recorded even when it passes what was reserved;
--   * days are independent, and the monthly `usage` row is not touched;
--   * a negative total cannot be written by any route;
--   * an account reads its own day and nobody else's;
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

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

do $$
declare
  a uuid := pg_temp.newuser('a-tokens@example.edu');
  b uuid := pg_temp.newuser('b-tokens@example.edu');
  c uuid := pg_temp.newuser('c-tokens@example.edu');
  cap constant bigint := 250000;
  n bigint;
  rows bigint;
begin
  -- ── a reservation that fits, and the boundary ──────────────────────────
  perform pg_temp.is('first reservation is added', public.add_tokens(a, '2026-10-11', 100000, cap), 100000);
  perform pg_temp.is('second reservation reaches the quota exactly', public.add_tokens(a, '2026-10-11', 150000, cap), 250000);
  perform pg_temp.is('one token more is refused', public.add_tokens(a, '2026-10-11', 1, cap), -1);
  select tokens into n from public.usage_daily where user_id = a and day = '2026-10-11';
  perform pg_temp.is('and the refusal changed nothing', n, 250000);

  -- ── settling gives tokens back, never below zero ──────────────────────
  perform pg_temp.is('settling returns the unused part', public.add_tokens(a, '2026-10-11', -60000, null), 190000);
  perform pg_temp.is('and what was returned can be reserved again', public.add_tokens(a, '2026-10-11', 60000, cap), 250000);
  perform pg_temp.is('settling more than is held stops at zero', public.add_tokens(a, '2026-10-11', -9000000000, null), 0);

  -- ── a charge with no cap is recorded even when it is over ─────────────
  perform pg_temp.is('an uncapped charge is recorded', public.add_tokens(a, '2026-10-11', 300000, null), 300000);
  perform pg_temp.is('and the next reservation is then refused', public.add_tokens(a, '2026-10-11', 1, cap), -1);

  -- ── a reservation bigger than the whole quota writes no row ───────────
  perform pg_temp.is('an impossible first reservation is refused', public.add_tokens(b, '2026-10-11', cap + 1, cap), -1);
  select count(*) into rows from public.usage_daily where user_id = b;
  perform pg_temp.is('and no row was written for it', rows, 0);

  -- ── days are independent, and the monthly row is another table ────────
  perform pg_temp.is('the next day starts at zero', public.add_tokens(a, '2026-10-12', 100, cap), 100);
  select tokens into n from public.usage_daily where user_id = a and day = '2026-10-11';
  perform pg_temp.is('and the first day is unchanged', n, 300000);
  select count(*) into rows from public.usage where user_id = a;
  perform pg_temp.is('the monthly usage row was never written', rows, 0);
  perform pg_temp.is('count_call still counts its own row', public.count_call(a, '2026-10'), 1);
  select tokens into n from public.usage_daily where user_id = a and day = '2026-10-11';
  perform pg_temp.is('and left the day alone', n, 300000);

  -- ── settling an account with no row records nothing negative ──────────
  perform pg_temp.is('a refund against no row is zero, not negative', public.add_tokens(b, '2026-12-01', -5, null), 0);

  -- ── a negative total cannot be written by any route ───────────────────
  begin
    update public.usage_daily set tokens = -1 where user_id = a and day = '2026-10-11';
    raise exception 'FAILED: a negative total was written';
  exception when check_violation then
    raise notice 'ok  a negative total is refused by the table';
  end;

  -- ── it refuses to guess ───────────────────────────────────────────────
  begin
    perform public.add_tokens(null, '2026-10-11', 1, cap);
    raise exception 'FAILED: a null account was accepted';
  exception when raise_exception then
    if sqlerrm like 'FAILED%' then raise; end if;
    raise notice 'ok  a null account is refused';
  end;

  -- ── an account reads its own day and nobody else's ────────────────────
  perform public.add_tokens(c, '2026-10-11', 42, cap);
  perform pg_temp.become(c);
  select count(*) into rows from public.usage_daily;
  perform pg_temp.is('a signed-in account sees only its own rows', rows, 1);
  select tokens into n from public.usage_daily where user_id = c;
  perform pg_temp.is('and reads its own total', n, 42);
  begin
    update public.usage_daily set tokens = 0 where user_id = c;
    if found then raise exception 'FAILED: a signed-in account rewrote its own quota'; end if;
    raise notice 'ok  a signed-in account cannot write its own row';
  exception when insufficient_privilege then
    raise notice 'ok  a signed-in account cannot write its own row';
  end;
  reset role;
end $$;

-- ── who may call it ──────────────────────────────────────────────────────
do $$
begin
  if has_function_privilege('anon', 'public.add_tokens(uuid, text, bigint, bigint)', 'execute') then
    raise exception 'FAILED: a visitor can call add_tokens';
  end if;
  if has_function_privilege('authenticated', 'public.add_tokens(uuid, text, bigint, bigint)', 'execute') then
    raise exception 'FAILED: a signed-in account can call add_tokens';
  end if;
  if not has_function_privilege('service_role', 'public.add_tokens(uuid, text, bigint, bigint)', 'execute') then
    raise exception 'FAILED: the service role cannot call add_tokens';
  end if;
  raise notice 'ok  only the service role can call add_tokens';
end $$;

rollback;
